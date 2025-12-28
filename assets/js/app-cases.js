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

// filter dropdown init
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
  const outbound = filtered.filter((c) => c.interaction !== "Inbound"); // ✅ alles wat niet inbound is

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
          </div>
        </div>
      </div>
    </div>
  `;
}

els.searchInput.addEventListener("input", render);
els.outcomeFilter.addEventListener("change", render);

render();

