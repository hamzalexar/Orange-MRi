import { DROPDOWNS } from "./config/dropdowns.js";
import { qs } from "./ui/dom.js";
import { toast } from "./ui/toast.js";
import { downloadTextFile } from "./ui/download.js";
import { caseRepository } from "./features/cases/caseRepository.js";

/**
 * cases.html DOM (current)
 * - #outboundList (div)
 * - #inboundList (div)
 * - #searchInput (input)
 * - #outcomeFilter (select)
 * - #countLabel (div)
 * - #exportJsonBtn (button)
 * - #exportCsvBtn (button)
 * - #importJsonInput (file input)
 */

const els = {
  outboundList: qs("#outboundList"),
  inboundList: qs("#inboundList"),

  searchInput: document.querySelector("#searchInput"),
  outcomeFilter: document.querySelector("#outcomeFilter"),
  countLabel: document.querySelector("#countLabel"),

  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  importJsonInput: document.querySelector("#importJsonInput"),
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(v) {
  return String(v ?? "").trim().toLowerCase();
}

function isOutboundCase(c) {
  // Robust categorization for your existing data.
  // If your interaction dropdown uses values like "Outbound", "Inbound", "CMR", ...
  // this will still work.
  const interaction = normalizeText(c?.interaction);
  const contactType = normalizeText(c?.contactType);
  const outcome = normalizeText(c?.outcome);

  const hay = `${interaction} ${contactType} ${outcome}`;

  // Treat anything mentioning outbound or cmr as outbound
  if (hay.includes("outbound")) return true;
  if (hay.includes("cmr")) return true;

  // Otherwise, default to inbound
  return false;
}

function formatDate(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString();
}

function formatTime(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initOutcomeFilter() {
  if (!els.outcomeFilter) return;

  const opts = [
    { value: "", label: "All outcomes" },
    ...(Array.isArray(DROPDOWNS?.outcome) ? DROPDOWNS.outcome : []),
  ];

  els.outcomeFilter.innerHTML = opts
    .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
    .join("");
}

function getFilteredCases() {
  const all = caseRepository
    .getAll()
    .slice()
    .sort((a, b) => (Number(b.updatedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.createdAt) || 0));

  const q = normalizeText(els.searchInput?.value);
  const outcomeFilter = els.outcomeFilter?.value ?? "";

  return all.filter((c) => {
    if (outcomeFilter && String(c.outcome ?? "") !== outcomeFilter) return false;

    if (!q) return true;

    const hay = [
      c.customerCode,
      c.problemDescription,
      c.preAnalysis,
      c.actionsDone,
      c.todoRequired,
      c.interaction,
      c.contactType,
      c.outcome,
    ]
      .map(normalizeText)
      .join(" ");

    return hay.includes(q);
  });
}

function buildCaseCard(c) {
  const ts = Number(c.createdAt) || 0;
  const date = new Date(ts).toLocaleDateString();
  const time = new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `
    <div class="case-card" data-id="${escapeHtml(c.id)}" role="button" tabindex="0">
      <div class="case-top">
        <div>
          <div class="case-code">${escapeHtml(c.customerCode || "")}</div>
          <div class="case-meta">
            <span>${escapeHtml(date)} • ${escapeHtml(time)}</span>
            <span>${escapeHtml(c.outcome || "")}</span>
          </div>
        </div>
      </div>

      <div class="case-snippet">
        ${escapeHtml(c.problemDescription || "")}
      </div>

      <div class="case-meta case-meta-bottom">
        <span>${escapeHtml(c.interaction || "")}</span>
        <span>${escapeHtml(c.contactType || "")}</span>
        <button class="btn danger js-delete" type="button" style="margin-left:auto;">Delete</button>
      </div>
    </div>
  `;
}


function render() {
  const filtered = getFilteredCases();

  const outbound = [];
  const inbound = [];

  for (const c of filtered) {
    (isOutboundCase(c) ? outbound : inbound).push(c);
  }

  els.outboundList.innerHTML = outbound.map(buildCaseCard).join("") || `<div class="muted">No outbound cases</div>`;
  els.inboundList.innerHTML = inbound.map(buildCaseCard).join("") || `<div class="muted">No inbound cases</div>`;

  if (els.countLabel) {
    const total = caseRepository.getAll().length;
    const shown = filtered.length;
    els.countLabel.textContent = shown === total ? `${total} cases` : `${shown} / ${total} cases`;
  }
}

// Event delegation for both lists
function bindListEvents(container) {
  container.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".js-delete");
    const card = e.target.closest(".case-card");
    if (!card) return;

    const id = card.getAttribute("data-id");
    if (!id) return;

    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (confirm("Delete this case?")) {
        caseRepository.remove(id);
        toast("Case deleted");
        render();
      }
      return;
    }

    // Navigate to edit/view worklog
    window.location.href = `index.html?caseId=${encodeURIComponent(id)}`;
  });

  // Enter/Space to open
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".case-card");
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (!id) return;
    e.preventDefault();
    window.location.href = `index.html?caseId=${encodeURIComponent(id)}`;
  });
}

function toCsvValue(v) {
  const s = String(v ?? "");
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

  const createdAt = toFiniteNumber(safe.createdAt);
  const updatedAt = toFiniteNumber(safe.updatedAt);
  const handledAt = toFiniteNumber(safe.handledAt);

  // ✅ createdAt is heilig; als missing → pak handledAt, anders updatedAt, anders import-moment
  const baseTs = createdAt ?? handledAt ?? updatedAt ?? ts;

  const customerCalled =
    safe.customerCalled === true ||
    safe.customerCalled === "true" ||
    safe.customerCalled === 1 ||
    safe.customerCalled === "1";

  return {
    id: safe.id ?? crypto.randomUUID?.() ?? String(Math.random()).slice(2),

    createdAt: baseTs,
    updatedAt: updatedAt ?? baseTs,
    handledAt: handledAt ?? baseTs,

    customerCode: safe.customerCode ?? "",
    problemDescription: safe.problemDescription ?? "",
    preAnalysis: safe.preAnalysis ?? "",
    interaction: safe.interaction ?? "",
    contactType: safe.contactType ?? "",
    outcome: safe.outcome ?? "",
    customerCalled,

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
  // Filters
  if (els.searchInput) els.searchInput.addEventListener("input", render);
  if (els.outcomeFilter) els.outcomeFilter.addEventListener("change", render);

  // Export
  if (els.exportJsonBtn) els.exportJsonBtn.addEventListener("click", exportJson);
  if (els.exportCsvBtn) els.exportCsvBtn.addEventListener("click", exportCsv);

  // Import (auto on file select)
  if (els.importJsonInput) {
    els.importJsonInput.addEventListener("change", async () => {
      const file = els.importJsonInput.files?.[0];
      if (!file) return;

      try {
        await importCasesFromFile(file);
      } catch (e) {
        console.error(e);
        toast("Import failed (see console)");
      } finally {
        els.importJsonInput.value = "";
      }
    });
  }

  // Lists
  bindListEvents(els.outboundList);
  bindListEvents(els.inboundList);
}

function init() {
  initOutcomeFilter();
  bindEvents();
  render();
}

init();
