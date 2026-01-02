import { DROPDOWNS } from "./config/dropdowns.js";
import { qs } from "./ui/dom.js";
import { toast } from "./ui/toast.js";
import { downloadTextFile } from "./ui/download.js";
import { caseRepository } from "./features/cases/caseRepository.js";

// DOM
const els = {
  list: qs("#casesList"),
  empty: qs("#casesEmpty"),
  exportJsonBtn: qs("#exportJsonBtn"),
  exportCsvBtn: qs("#exportCsvBtn"),
  importFile: qs("#importFile"),
  importBtn: qs("#importBtn"),
  clearBtn: qs("#clearBtn"),
  inboundList: qs("#inboundList"),
  outboundList: qs("#outboundList"),
};

// Filter dropdown init
function initDropdowns() {
  if (els.inboundList) els.inboundList.innerHTML = DROPDOWNS.interaction.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  if (els.outboundList) els.outboundList.innerHTML = DROPDOWNS.outcome.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const cases = caseRepository
    .getAll()
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

  if (!cases.length) {
    if (els.empty) els.empty.style.display = "block";
    if (els.list) els.list.innerHTML = "";
    return;
  }

  if (els.empty) els.empty.style.display = "none";

  if (!els.list) return;

  els.list.innerHTML = cases
    .map((c) => {
      const date = new Date(Number(c.createdAt)).toLocaleDateString();
      const time = new Date(Number(c.createdAt)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      return `
      <div class="case-card" data-id="${escapeHtml(c.id)}">
        <div class="case-card__top">
          <div class="case-card__meta">
            <div class="case-card__date">${escapeHtml(date)} • ${escapeHtml(time)}</div>
            <div class="case-card__code">${escapeHtml(c.customerCode || "")}</div>
          </div>
          <div class="case-card__pill">${escapeHtml(c.outcome || "")}</div>
        </div>

        <div class="case-card__desc">${escapeHtml(c.problemDescription || "")}</div>

        <div class="case-card__bottom">
          <div class="case-card__tags">
            <span class="tag">${escapeHtml(c.interaction || "")}</span>
            <span class="tag">${escapeHtml(c.contactType || "")}</span>
          </div>
          <button class="btn btn--danger btn--small js-delete">Delete</button>
        </div>
      </div>
    `;
    })
    .join("");

  // delete handlers
  els.list.querySelectorAll(".case-card .js-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".case-card");
      const id = card?.getAttribute("data-id");
      if (!id) return;

      if (confirm("Delete this case?")) {
        caseRepository.remove(id);
        toast("Case deleted");
        render();
      }
    });
  });

  // click card -> go to worklog (if you have this behavior)
  els.list.querySelectorAll(".case-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      // avoid clicking delete triggering navigation
      if (e.target.closest(".js-delete")) return;

      const id = card.getAttribute("data-id");
      if (!id) return;
      window.location.href = `index.html?caseId=${encodeURIComponent(id)}`;
    });
  });
}

function toCsvValue(v) {
  const s = String(v ?? "");
  // escape quotes by doubling them and wrap with quotes if needed
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function toCsv(cases) {
  const headers = [
    "id",
    "createdAt",
    "updatedAt",
    "handledAt",
    "customerCode",
    "interaction",
    "contactType",
    "outcome",
    "customerCalled",
    "problemDescription",
    "preAnalysis",
    "actionsDone",
    "ringRing",
    "technicianDate",
    "todoRequired",
  ];

  const rows = [headers.join(",")];
  for (const c of cases) {
    rows.push(headers.map((h) => toCsvValue(c[h])).join(","));
  }
  return rows.join("\n");
}

/**
 * Convert to a finite number if possible.
 * Accepts numbers and numeric strings (e.g. "1766991923359").
 */
function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeImportedCase(raw) {
  const ts = Date.now();
  const safe = typeof raw === "object" && raw ? raw : {};

  // Accept both numbers and numeric strings from imports. If missing/invalid, fall back safely.
  const createdAt = toFiniteNumber(safe.createdAt);
  const updatedAt = toFiniteNumber(safe.updatedAt);
  const handledAt = toFiniteNumber(safe.handledAt);

  const baseTs = createdAt ?? ts;

  return {
    createdAt: baseTs,
    updatedAt: updatedAt ?? baseTs,
    handledAt: handledAt ?? baseTs,

    customerCode: safe.customerCode ?? "",
    problemDescription: safe.problemDescription ?? "",
    preAnalysis: safe.preAnalysis ?? "",
    interaction: safe.interaction ?? "",
    contactType: safe.contactType ?? "",
    outcome: safe.outcome ?? "",
    customerCalled: Boolean(safe.customerCalled),
    actionsDone: safe.actionsDone ?? "",
    ringRing: safe.ringRing ?? "",
    technicianDate: safe.technicianDate ?? "",
    todoRequired: safe.todoRequired ?? "",
  };
}

function fingerprintCase(c) {
  const norm = (v) => String(v ?? "").trim().toLowerCase();
  const t = toFiniteNumber(c.handledAt) ?? toFiniteNumber(c.createdAt) ?? 0;

  return [
    t,
    norm(c.customerCode),
    norm(c.interaction),
    norm(c.contactType),
    norm(c.outcome),
    c.customerCalled === true ? "1" : "0",
    norm(c.problemDescription),
    norm(c.preAnalysis),
    norm(c.actionsDone),
    norm(c.todoRequired),
  ].join("|");
}

// ADD ONLY + DUPLICATE PROOF
function mergeCases(existing, imported) {
  const seen = new Set(existing.map(fingerprintCase));
  const merged = [...existing];

  let added = 0;
  for (const raw of imported) {
    const c = sanitizeImportedCase(raw);
    const fp = fingerprintCase(c);
    if (seen.has(fp)) continue;

    seen.add(fp);
    merged.push(c);
    added++;
  }

  return { merged, added };
}

function exportJson() {
  const data = {
    version: 1,
    exportedAt: Date.now(),
    cases: caseRepository.getAll(),
  };
  downloadTextFile(
    `orange-mri-cases-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(data, null, 2),
    "application/json"
  );
  toast("Exported JSON");
}

function exportCsv() {
  const csv = toCsv(caseRepository.getAll());
  downloadTextFile(
    `orange-mri-cases-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv"
  );
  toast("Exported CSV");
}

async function readFileAsText(file) {
  return await file.text();
}

async function importCasesFromFile(file) {
  const rawText = await readFileAsText(file);

  // Try JSON first
  try {
    const parsed = JSON.parse(rawText);
    const importedCases = Array.isArray(parsed) ? parsed : parsed.cases;

    if (!Array.isArray(importedCases)) throw new Error("Invalid JSON structure");

    const existing = caseRepository.getAll();
    const { merged, added } = mergeCases(existing, importedCases);

    caseRepository.replaceAll(merged);
    toast(`Imported ${added} new cases (duplicates skipped)`);
    render();
    return;
  } catch (e) {
    // continue to CSV fallback
  }

  // CSV fallback
  // Expected headers must match exportCsv headers
  const lines = rawText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV looks empty");

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1);

  const importedCases = rows.map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx];
    });

    // Coerce booleans if present
    if (obj.customerCalled != null) {
      obj.customerCalled = obj.customerCalled === "1" || obj.customerCalled === "true";
    }

    return obj;
  });

  const existing = caseRepository.getAll();
  const { merged, added } = mergeCases(existing, importedCases);
  caseRepository.replaceAll(merged);
  toast(`Imported ${added} new cases (duplicates skipped)`);
  render();
}

function bindEvents() {
  if (els.exportJsonBtn) els.exportJsonBtn.addEventListener("click", exportJson);
  if (els.exportCsvBtn) els.exportCsvBtn.addEventListener("click", exportCsv);

  if (els.importBtn && els.importFile) {
    els.importBtn.addEventListener("click", async () => {
      const file = els.importFile.files?.[0];
      if (!file) {
        toast("Choose a file first");
        return;
      }
      try {
        await importCasesFromFile(file);
      } catch (e) {
        console.error(e);
        toast("Import failed (see console)");
      } finally {
        els.importFile.value = "";
      }
    });
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", () => {
      if (!confirm("This will delete ALL cases. Continue?")) return;
      caseRepository.replaceAll([]);
      toast("All cases cleared");
      render();
    });
  }
}

function init() {
  initDropdowns();
  bindEvents();
  render();
}

init();
