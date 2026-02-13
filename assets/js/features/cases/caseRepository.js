import { readJson, writeJson } from "../../core/storage.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.js";

const STORAGE_KEY = "bot_worklog_cases_v1";
const SYNC_META_KEY = "bot_worklog_sync_meta_v1"; // kleine meta voor debugging

function makeId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// ---------- Supabase REST helpers ----------
async function sb(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${txt}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function remoteList() {
  // enkel payload ophalen (payload bevat jouw volledige case object)
  const rows = await sb("worklog_cases?select=payload&order=updated_at.desc");
  return (rows || []).map((r) => r.payload);
}

async function remoteUpsertMany(cases) {
  if (!cases.length) return;

  const nowIso = new Date().toISOString();

  // Bulk upsert via PostgREST
  const rows = cases.map((c) => ({
    id: c.id,
    payload: c,
    updated_at: nowIso,
  }));

  await sb("worklog_cases?on_conflict=id", {
    method: "POST",
    body: rows,
    // merge duplicates = upsert
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function remoteDelete(id) {
  await sb(`worklog_cases?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
}

// ---------- Merge helper ----------
function mergeLocalRemote(localCases, remoteCases) {
  const map = new Map();

  // start met remote
  for (const c of remoteCases) {
    if (c?.id) map.set(c.id, c);
  }

  // merge local (neem nieuwste updatedAt)
  for (const c of localCases) {
    if (!c?.id) continue;

    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
      continue;
    }

    const a = Number(existing.updatedAt || 0);
    const b = Number(c.updatedAt || 0);

    // kies de “nieuwste”
    map.set(c.id, b >= a ? c : existing);
  }

  return Array.from(map.values());
}

// ---------- Repository ----------
export const caseRepository = {
  /**
   * Call this ONCE at app startup:
   * - pull from Supabase
   * - merge with local
   * - push merged back to Supabase (so beide devices gelijk lopen)
   */
  async init() {
    try {
      const local = this.getAll();
      const remote = await remoteList();

      const merged = mergeLocalRemote(local, remote);
      writeJson(STORAGE_KEY, merged);

      await remoteUpsertMany(merged);

      writeJson(SYNC_META_KEY, {
        lastInitOkAt: Date.now(),
        localCount: local.length,
        remoteCount: remote.length,
        mergedCount: merged.length,
      });
    } catch (e) {
      // Als Supabase faalt: app blijft werken op localStorage
      writeJson(SYNC_META_KEY, { lastInitErrorAt: Date.now(), message: String(e?.message || e) });
      console.warn("Supabase sync init failed, falling back to localStorage:", e);
    }
  },

  getAll() {
    return readJson(STORAGE_KEY, []);
  },

  getById(id) {
    const all = this.getAll();
    return all.find((c) => c.id === id) ?? null;
  },

  replaceAll(cases) {
    const safe = Array.isArray(cases) ? cases : [];
    writeJson(STORAGE_KEY, safe);

    // fire-and-forget push
    remoteUpsertMany(safe).catch((e) => console.warn("Supabase replaceAll push failed:", e));
  },

  create(caseData) {
    const all = this.getAll();
    const ts = Date.now();

    const newCase = {
      id: makeId(),
      createdAt: ts,
      updatedAt: ts,
      handledAt: ts, // ✅ tijd van “save / aangepakt”
      ...caseData,
    };

    all.push(newCase);
    writeJson(STORAGE_KEY, all);

    // fire-and-forget push
    remoteUpsertMany([newCase]).catch((e) => console.warn("Supabase create push failed:", e));

    return newCase;
  },

  update(id, patch) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    // ⛔ bescherm handledAt tegen overschrijven
    const { handledAt, ...safePatch } = patch;

    const updated = {
      ...all[idx],
      ...safePatch,
      updatedAt: Date.now(),
    };

    all[idx] = updated;
    writeJson(STORAGE_KEY, all);

    // fire-and-forget push
    remoteUpsertMany([updated]).catch((e) => console.warn("Supabase update push failed:", e));

    return updated;
  },

  remove(id) {
    const all = this.getAll();
    const next = all.filter((c) => c.id !== id);
    writeJson(STORAGE_KEY, next);

    // fire-and-forget delete
    remoteDelete(id).catch((e) => console.warn("Supabase delete failed:", e));

    return next.length !== all.length;
  },

  clearAll() {
    writeJson(STORAGE_KEY, []);
    // (optioneel later: remote “truncate” doen via RPC/SQL, maar voor nu laten we dit)
  },
};
