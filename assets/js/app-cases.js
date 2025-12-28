import { DROPDOWNS } from "./config/dropdowns.js";
import { qs, fillSelect, escapeHtml } from "./ui/dom.js";
import { caseRepository } from "./features/cases/caseRepository.js";

const els = {
  countLabel: qs("#countLabel"),
  searchInput: qs("#searchInput"),
  outcomeFilter: qs("#outcomeFilter"),
  inboundList: qs("#inboundList"),
  outboundList: qs("#outboundList"),
};

// Filter dropdown init
fillSelect(els.outcomeFilter, ["All outcomes", ...DROPDOWNS.outcome]);
els.outcomeFilter.value = "All outcomes";

function matchesFilters(c) {
  const q = els.searchInput.value.trim().toLowerCase();
  const out = els.outcomeFilter.value;

  const haystack = [
    c.customerCode,
    c.problemDescription,
    c.preAnalysis,
    c.actionsDone,
    c.todoRequired,
    c.outcome,
    c.interaction,
    c.customerCalled ? "called" : "",
  ]
    .join(" ")
    .toLowerCase();

  const okQuery = !q || haystack.includes(q);
  const okOutcome = out === "All outcomes" || c.outcome === out;

  return okQuery && okOutcome;
}

function render() {
  const all = caseRepository.getAll();

  const filtered = all
    .slice()
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .filter(matchesFilters);

  const inbound = filtered.filter((c) => c.interaction === "Inbound");
  const outbound = filtered.filter((c) => c.interaction !== "Inbound"); // alles niet-inbound

  els.countLabel.textContent = `${filtered.length} cases — ${inbound.length} inbound / ${outbound.length} outbound`;

  els.inboundList.innerHTML = inbound.length
    ? inbound.map(renderCard).join("")
    : `<div class="muted" style="padding:10px 14px;">No inbound cases</div>`;

  els.outboundList.innerHTML = outbound.length
    ? outbound.map(renderCard).join("")
    : `<div class="muted" style="padding:10px 14px;">No outbound cases</div>`;
}

function renderCard(c) {
  const title = c.customerCode ? `#${c.customerCode}` : "(No customer code)";
  const snippet = (c.problemDescription || c.preAnalysis || "—").slice(0, 100);
  const date = new Date(c.createdAt).toLocaleDateString();
  const outcome = c.outcome || "-";
  const interaction = c.interaction || "-";
  const called = c.customerCalled === true ? "Called ✓" : "";

  return `
    <div class="case-card">
      <div class="case-top">
        <div>
          <div class="case-code">${escapeHtml(title)}</div>
          <div class="case-snippet">${escapeHtml(snippet)}</div>
          <div class="case-meta">
            <span>${escapeHtml(date)}</span>
            <span>•</span>
            <span>${escapeHtml(outcome)}</span>
            <span>•</span>
            <span>${escapeHtml(interaction)}</span>
            ${called ? `<span>•</span><span><strong>${escapeHtml(called)}</strong></span>` : ""}
          </div>
        </div>

        <button class="btn danger ghost js-delete" type="button" data-id="${escapeHtml(c.id)}">
          Delete
        </button>
      </div>
    </div>
  `;
}

// Delete handler (event delegation)
function onListClick(e) {
  const btn = e.target.closest(".js-delete");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  const ok = confirm("Delete this case? This cannot be undone.");
  if (!ok) return;

  caseRepository.remove(id);
  render();
}

els.inboundList.addEventListener("click", onListClick);
els.outboundList.addEventListener("click", onListClick);

els.searchInput.addEventListener("input", render);
els.outcomeFilter.addEventListener("change", render);

/* =========================
   Export / Import (JSON/CSV)
   ========================= */

function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function toCsvValue(v) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

function casesToCsv(cases) {
  const headers = [
    "id",
    "handledAt",
    "createdAt",
    "updatedAt",
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

function sanitizeImportedCase(raw) {
  const ts = Date.now();
  const safe = typeof raw === "object" && raw ? raw : {};

  return {
    createdAt: Number.isFinite(safe.createdAt) ? safe.createdAt : ts,
    updatedAt: Number.isFinite(safe.updatedAt) ? safe.updatedAt : ts,
    handledAt: Number.isFinite(safe.handledAt)
      ? safe.handledAt
      : (Number.isFinite(safe.createdAt) ? safe.createdAt : ts),

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
  const t = Number.isFinite(c.handledAt)
    ? c.handledAt
    : (Number.isFinite(c.createdAt) ? c.createdAt : 0);

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
function addOnlyCases(nextCases) {
  const existing = caseRepository.getAll();
  const seen = new Set(existing.map(fingerprintCase));

  let added = 0;
  let skipped = 0;

  for (const c of nextCases) {
    const fp = fingerprintCase(c);

    if (seen.has(fp)) {
      skipped++;
      continue;
    }

    const created = caseRepository.create({
      customerCode: c.customerCode,
      problemDescription: c.problemDescription,
      preAnalysis: c.preAnalysis,
      interaction: c.interaction,
      contactType: c.contactType,
      outcome: c.outcome,
      customerCalled: c.customerCalled,
      actionsDone: c.actionsDone,
      ringRing: c.ringRing,
      technicianDate: c.technicianDate,
      todoRequired: c.todoRequired,
    });

    // timestamps correct zetten voor stats
    caseRepository.update(created.id, {
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      handledAt: c.handledAt,
    });

    seen.add(fp);
    added++;
  }

  return { added, skipped };
}

const exportJsonBtn = document.querySelector("#exportJsonBtn");
const importJsonInput = document.querySelector("#importJsonInput");
const exportCsvBtn = document.querySelector("#exportCsvBtn");

if (!exportJsonBtn || !importJsonInput || !exportCsvBtn) {
  console.error("Export/Import UI missing. Expected IDs: exportJsonBtn, importJsonInput, exportCsvBtn");
}

exportJsonBtn?.addEventListener("click", () => {
  const all = caseRepository.getAll();
  const payload = { version: 1, exportedAt: Date.now(), cases: all };

  downloadTextFile(
    `orange-mri-cases-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );

  alert("JSON exported ✅ (check your downloads)");
});

exportCsvBtn?.addEventListener("click", () => {
  const all = caseRepository.getAll();
  const csv = casesToCsv(all);

  downloadTextFile(
    `orange-mri-cases-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv"
  );

  alert("CSV exported ✅ (check your downloads)");
});

importJsonInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const arr = Array.isArray(parsed) ? parsed : parsed?.cases;
    if (!Array.isArray(arr)) {
      alert("Invalid JSON: expected an array or { cases: [...] }");
      return;
    }

    const sanitized = arr.map(sanitizeImportedCase);

    const ok = confirm(`This will ADD cases. Duplicates will be skipped.\n\nContinue?`);
    if (!ok) return;

    const result = addOnlyCases(sanitized);

    alert(`Import done ✅ Added ${result.added}, skipped duplicates: ${result.skipped}. Reloading...`);
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Import failed. Open Console (⌘⌥I) for details.");
  } finally {
    e.target.value = "";
  }
});

// boot
render();
