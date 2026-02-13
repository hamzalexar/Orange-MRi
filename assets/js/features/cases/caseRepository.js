import { readJson, writeJson } from "../../core/storage.js";
import { supabase } from "../../config.js";
const STORAGE_KEY = "bot_worklog_cases_v1";

/**
 * ✅ Vul dit in met jouw gegevens
 */


function makeId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// ------------------ Remote helpers ------------------
async function remoteList() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((r) => r.payload);
}

async function remoteUpsertMany(cases) {
  if (!cases?.length) return;

  const nowIso = new Date().toISOString();
  const rows = cases.map((c) => ({
    id: c.id,
    payload: c,
    updated_at: nowIso,
  }));

  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

async function remoteDelete(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

// ------------------ Merge helper ------------------
function mergeLocalRemote(localCases, remoteCases) {
  const map = new Map();

  // start met remote
  for (const c of remoteCases || []) {
    if (c?.id) map.set(c.id, c);
  }

  // merge local: neem de nieuwste updatedAt
  for (const c of localCases || []) {
    if (!c?.id) continue;

    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
      continue;
    }

    const a = Number(existing.updatedAt || 0);
    const b = Number(c.updatedAt || 0);
    map.set(c.id, b >= a ? c : existing);
  }

  return Array.from(map.values());
}

export const caseRepository = {
  /**
   * ✅ Call this ONCE at startup (per pagina):
   * await caseRepository.init();
   */
  async init() {
    try {
      const local = this.getAll();
      const remote = await remoteList();

      const merged = mergeLocalRemote(local, remote);

      // schrijf lokaal zodat je UI meteen de juiste lijst heeft
      writeJson(STORAGE_KEY, merged);

      // push merged terug (zodat devices gelijk lopen)
      await remoteUpsertMany(merged);

      writeJson(SYNC_META_KEY, {
        lastInitOkAt: Date.now(),
        localCount: local.length,
        remoteCount: remote.length,
        mergedCount: merged.length,
      });
    } catch (e) {
      // fallback: app blijft werken via localStorage
      writeJson(SYNC_META_KEY, {
        lastInitErrorAt: Date.now(),
        message: String(e?.message || e),
      });
      console.warn("Supabase init sync failed → localStorage fallback:", e);
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

    // fire-and-forget
    remoteUpsertMany(safe).catch((e) =>
      console.warn("Supabase replaceAll push failed:", e)
    );
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

    // fire-and-forget
    remoteUpsertMany([newCase]).catch((e) =>
      console.warn("Supabase create push failed:", e)
    );

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

    // fire-and-forget
    remoteUpsertMany([updated]).catch((e) =>
      console.warn("Supabase update push failed:", e)
    );

    return updated;
  },

  remove(id) {
    const all = this.getAll();
    const next = all.filter((c) => c.id !== id);
    writeJson(STORAGE_KEY, next);

    // fire-and-forget
    remoteDelete(id).catch((e) =>
      console.warn("Supabase delete failed:", e)
    );

    return next.length !== all.length;
  },

  clearAll() {
    writeJson(STORAGE_KEY, []);
    // (remote clear doen we later eventueel via RPC/SQL)
  },
};
