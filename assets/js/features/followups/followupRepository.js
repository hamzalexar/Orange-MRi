import { readJson, writeJson } from "../../core/storage.js";
import { supabase } from "../../config.js";

const LEGACY_STORAGE_KEY = "bot_worklog_followups_v1";
const SYNC_META_KEY = "bot_worklog_followups_sync_meta_v1";
const TABLE = "worklog_followups";

// Zelfde eenmalige migratie als bij caseRepository: de originele gebruiker
// krijgt zijn bestaande lokale data overgezet naar zijn eigen sleutel.
const OWNER_EMAIL = "lexar.hamza@gmail.com";

let currentStorageKey = LEGACY_STORAGE_KEY;

function storageKeyFor(userId) {
  return `bot_worklog_followups_v1::${userId}`;
}

function migrateLegacyDataIfOwner(user) {
  if (!user || user.email !== OWNER_EMAIL) return;

  const scopedKey = storageKeyFor(user.id);
  if (localStorage.getItem(scopedKey) != null) return; // al gemigreerd op dit toestel

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy != null) {
    localStorage.setItem(scopedKey, legacy);
  }
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

export const followupRepository = {
  async init() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        migrateLegacyDataIfOwner(user);
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
      console.warn("Followups supabase init failed → localStorage fallback:", e);
    }
  },

  getAll() {
    return readJson(currentStorageKey, []);
  },

  getById(id) {
    return this.getAll().find((x) => x.id === id) ?? null;
  },

  replaceAll(items) {
    const safe = Array.isArray(items) ? items : [];
    writeJson(currentStorageKey, safe);
    remoteUpsertMany(safe).catch((e) => console.warn("Followups replaceAll push failed:", e));
  },

  create(data) {
    const all = this.getAll();
    const ts = Date.now();

    const item = {
      id: makeId(),
      createdAt: ts,
      updatedAt: ts,
      ...data,
    };

    all.push(item);
    writeJson(currentStorageKey, all);

    remoteUpsertMany([item]).catch((e) => console.warn("Followups create push failed:", e));
    return item;
  },

  update(id, patch) {
    const all = this.getAll();
    const idx = all.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const updated = { ...all[idx], ...patch, updatedAt: Date.now() };
    all[idx] = updated;
    writeJson(currentStorageKey, all);

    remoteUpsertMany([updated]).catch((e) => console.warn("Followups update push failed:", e));
    return updated;
  },

  remove(id) {
    const all = this.getAll();
    const next = all.filter((x) => x.id !== id);
    writeJson(currentStorageKey, next);

    remoteDelete(id).catch((e) => console.warn("Followups delete failed:", e));
    return next.length !== all.length;
  },

  clearAll() {
    writeJson(currentStorageKey, []);
  },
};
