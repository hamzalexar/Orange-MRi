import { DROPDOWNS } from "./config/dropdowns.js";
import { toast } from "./ui/toast.js";
import { downloadTextFile } from "./ui/download.js";
import { caseRepository } from "./features/cases/caseRepository.js";

/**
 * cases.html DOM
 * - #outboundList (div)
 * - #inboundList (div)
 * - #searchInput (input)
 * - #outcomeFilter (select)
 * - #countLabel (div)
 * - #exportJsonBtn (button)
 * - #exportCsvBtn (button)
 * - #importJsonInput (file input)
 */

/** ✅ Guard: als dit niet cases.html is, stop meteen (geen crash). */
const outboundListEl = document.querySelector("#outboundList");
const inboundListEl = document.querySelector("#inboundList");
if (!outboundListEl || !inboundListEl) {
  console.warn("app-cases.js loaded on a non-cases page → skipping.");
} else {
  const els = {
    outboundList: outboundListEl,
    inboundList: inboundListEl,

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
    const interaction = normalizeText(c?.interaction);
    const contactType = normalizeText(c?.contactType);
    const outcome = normalizeText(c?.outcome);
    const hay = `${interaction} ${contactType} ${outcome}`;

    if (hay.includes("outbound")) return true;
    if (hay.includes("cmr")) return true;

    return false;
  }

  function getFilteredCases() {
    const all = caseRepository
      .getAll()
      .slice()
      .sort(
        (a, b) =>
          (Number(b.updatedAt || b.createdAt) || 0) -
          (Number(a.updatedAt || a.createdAt) || 0)
      );

    const q = normalizeText(els.searchInput?.value);
    const outcomeFilter = els.outcomeFilter?.value ?? "";

    return all.filter((c) => {
      if (outcomeFilter && String(c.outcome ?? "") !== outcomeFilter) return false;
      if (!q) return true;

      const hay = [
        c.customerCode,
        c.task,
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
    const date = ts
  ? new Date(ts).toLocaleDateString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  : "";

const time = ts
  ? new Date(ts).toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  : "";

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
 ${escapeHtml(c.task || "")}
 ${c.task && c.problemDescription ? "<br/>" : ""}
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

  function render() {
    const filtered = getFilteredCases();

    const outbound = [];
    const inbound = [];

    for (const c of filtered) {
      (isOutboundCase(c) ? outbound : inbound).push(c);
    }

    els.outboundList.innerHTML =
      outbound.map(buildCaseCard).join("") || `<div class="muted">No outbound cases</div>`;
    els.inboundList.innerHTML =
      inbound.map(buildCaseCard).join("") || `<div class="muted">No inbound cases</div>`;

    if (els.countLabel) {
      const total = caseRepository.getAll().length;
      const shown = filtered.length;
      els.countLabel.textContent = shown === total ? `${total} cases` : `${shown} / ${total} cases`;
    }
  }

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

      window.location.href = `index.html?caseId=${encodeURIComponent(id)}`;
    });

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

  async function importCasesFromFile(file) {
    const rawText = await file.text();

    // JSON
    try {
      const parsed = JSON.parse(rawText);
      const importedCases = Array.isArray(parsed) ? parsed : parsed.cases;
      if (!Array.isArray(importedCases)) throw new Error("Invalid JSON structure");

      caseRepository.replaceAll(importedCases);
      toast(`Imported ${importedCases.length} cases`);
      render();
      return;
    } catch {
      // fallthrough to CSV
    }

    throw new Error("Only JSON import supported (for now)");
  }

  function bindEvents() {
    if (els.searchInput) els.searchInput.addEventListener("input", render);
    if (els.outcomeFilter) els.outcomeFilter.addEventListener("change", render);

    if (els.exportJsonBtn) els.exportJsonBtn.addEventListener("click", exportJson);
    if (els.exportCsvBtn) els.exportCsvBtn.addEventListener("click", exportCsv);

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

    bindListEvents(els.outboundList);
    bindListEvents(els.inboundList);
  }

  async function init() {
    // ✅ Supabase sync (als beschikbaar)
    if (typeof caseRepository.init === "function") {
      await caseRepository.init();
    }

    initOutcomeFilter();
    bindEvents();
    render();
  }

  init().catch((e) => {
    console.error("Cases init failed:", e);
    toast("Cases page failed to start (see console)");
  });
}
