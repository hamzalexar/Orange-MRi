import { readJson, writeJson } from "../../core/storage.js";
import { supabase } from "../../config.js";

const LEGACY_STORAGE_KEY = "bot_worklog_incidents_v1";
const SYNC_META_KEY = "bot_worklog_incidents_sync_meta_v1";
const TABLE = "worklog_incidents";

let currentStorageKey = LEGACY_STORAGE_KEY;

function storageKeyFor(userId) {
  return `bot_worklog_incidents_v1::${userId}`;
}

function makeId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

async function remoteList() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((r) => r.payload);
}

async function remoteUpsertMany(items) {
  if (!items?.length) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // niet ingelogd: geen remote sync, blijft lokaal

  const nowIso = new Date().toISOString();
  const rows = items.map((x) => ({
    id: x.id,
    user_id: user.id,
    payload: x,
    updated_at: nowIso,
  }));

  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

async function remoteDelete(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

function mergeLocalRemote(localItems, remoteItems) {
  const map = new Map();

  for (const x of remoteItems || []) if (x?.id) map.set(x.id, x);

  for (const x of localItems || []) {
    if (!x?.id) continue;
    const existing = map.get(x.id);
    if (!existing) {
      map.set(x.id, x);
      continue;
    }
    const a = Number(existing.updatedAt || 0);
    const b = Number(x.updatedAt || 0);
    map.set(x.id, b >= a ? x : existing);
  }

  return Array.from(map.values());
}

export const incidentRepository = {
  async init() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        currentStorageKey = storageKeyFor(user.id);
      }

      const local = this.getAll();
      const remote = await remoteList();

      const merged = mergeLocalRemote(local, remote);

      writeJson(currentStorageKey, merged);
      await remoteUpsertMany(merged);

      writeJson(SYNC_META_KEY, {
        lastInitOkAt: Date.now(),
        localCount: local.length,
        remoteCount: remote.length,
        mergedCount: merged.length,
      });
    } catch (e) {
      writeJson(SYNC_META_KEY, {
        lastInitErrorAt: Date.now(),
        message: String(e?.message || e),
      });
      console.warn("Incidents supabase init failed → localStorage fallback:", e);
    }
  },

  getAll() {
    return readJson(currentStorageKey, []);
  },

  getById(id) {
    return this.getAll().find((x) => x.id === id) ?? null;
  },

  create(title) {
    const all = this.getAll();
    const ts = Date.now();

    const item = {
      id: makeId(),
      title: String(title ?? "").trim(),
      createdAt: ts,
      updatedAt: ts,
    };

    all.push(item);
    writeJson(currentStorageKey, all);

    remoteUpsertMany([item]).catch((e) => console.warn("Incident create push failed:", e));
    return item;
  },

  remove(id) {
    const all = this.getAll();
    const next = all.filter((x) => x.id !== id);
    writeJson(currentStorageKey, next);

    remoteDelete(id).catch((e) => console.warn("Incident delete failed:", e));
    return next.length !== all.length;
  },
};
