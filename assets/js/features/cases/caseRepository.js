import { readJson, writeJson } from "../../core/storage.js";

const STORAGE_KEY = "bot_worklog_cases_v1";

function makeId() {
  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export const caseRepository = {
  getAll() {
    return readJson(STORAGE_KEY, []);
  },

  getById(id) {
    const all = this.getAll();
    return all.find(c => c.id === id) ?? null;
  },

  create(caseData) {
    const all = this.getAll();
    const ts = Date.now();

    const newCase = {
      id: makeId(),
      createdAt: ts,
      updatedAt: ts,
      handledAt: ts,        // ✅ NIEUW: tijd van “save / aangepakt”
      ...caseData,
    };
    

    all.push(newCase);
    writeJson(STORAGE_KEY, all);
    return newCase;
  },

  update(id, patch) {
    const all = this.getAll();
    const idx = all.findIndex(c => c.id === id);
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
    return updated;
  },
  

  remove(id) {
    const all = this.getAll();
    const next = all.filter(c => c.id !== id);
    writeJson(STORAGE_KEY, next);
    return next.length !== all.length;
  },

  clearAll() {
    writeJson(STORAGE_KEY, []);
  },
};
