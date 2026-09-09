import { incidentRepository } from "./features/incidents/incidentRepository.js";
import { requireAuth, signOut } from "./core/auth.js";
import { formatDateTime } from "./ui/datetime.js";

const rowsEl = document.getElementById("rows");
if (!rowsEl) {
  console.warn("app-incidents.js loaded on a non-incidents page → skipping.");
} else {
  const els = {
    rows: rowsEl,
    emptyState: document.getElementById("emptyState"),
    summaryLine: document.getElementById("summaryLine"),

    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),

    titleInput: document.getElementById("titleInput"),
    btnAdd: document.getElementById("btnAdd"),
  };

  function normalize(s) {
    return String(s ?? "").trim().toLowerCase();
  }

  function badge(status) {
    const label = status === "closed" ? "Closed" : "Open";
    const cls = status === "closed" ? "closed" : "open";
    return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Bestaande incidenten (van vóór status/opened-by bestond) hebben geen
  // status-veld — die behandelen we gewoon als "open".
  function statusOf(it) {
    return it.status === "closed" ? "closed" : "open";
  }

  function load() {
    return incidentRepository.getAll();
  }

  function getFilteredSorted(items) {
    const q = normalize(els.searchInput.value);
    const status = els.statusFilter.value;

    let out = items.filter((it) => {
      if (status !== "all" && statusOf(it) !== status) return false;
      if (!q) return true;
      const hay = `${it.title} ${it.createdBy} ${it.closedBy}`.toLowerCase();
      return hay.includes(q);
    });

    // Nieuwste eerst
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }

  function updateSummary(items) {
    const total = items.length;
    const open = items.filter((i) => statusOf(i) === "open").length;
    const closed = items.filter((i) => statusOf(i) === "closed").length;

    els.summaryLine.textContent = `${total} total • ${open} open • ${closed} closed`;
  }

  function rowHtml(it) {
    const status = statusOf(it);
    const date = it.createdAt ? formatDateTime(it.createdAt) : "—";
    const toggleLabel = status === "open" ? "Close" : "Reopen";

    return `
      <tr data-id="${escapeHtml(it.id)}">
        <td>${date}</td>
        <td>${badge(status)}</td>
        <td><div class="title">${escapeHtml(it.title)}</div></td>
        <td>${escapeHtml(it.createdBy || "—")}</td>
        <td>${escapeHtml(it.closedBy || "—")}</td>
        <td style="text-align:right;">
          <div class="row-actions">
            <button class="btn small" data-action="toggle" type="button">${toggleLabel}</button>
            <button class="btn small danger" data-action="delete" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  function render() {
    const items = load();
    updateSummary(items);

    const view = getFilteredSorted(items);
    els.rows.innerHTML = view.map(rowHtml).join("");

    els.emptyState.style.display = items.length === 0 ? "block" : "none";
  }

  async function addItem() {
    const title = String(els.titleInput.value ?? "").trim();
    if (!title) return alert("Please enter a title.");

    await incidentRepository.create(title);
    els.titleInput.value = "";
    render();
  }

  async function onTableClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const tr = btn.closest("tr[data-id]");
    const id = tr?.dataset?.id;
    if (!id) return;

    const action = btn.dataset.action;
    const current = incidentRepository.getById(id);
    if (!current) return;

    if (action === "delete") {
      if (!confirm("Delete this incident?")) return;
      incidentRepository.remove(id);
      render();
      return;
    }

    if (action === "toggle") {
      const next = statusOf(current) === "open" ? "closed" : "open";
      await incidentRepository.setStatus(id, next);
      render();
    }
  }

  function bind() {
    els.btnAdd.addEventListener("click", addItem);
    els.titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addItem();
    });

    els.searchInput.addEventListener("input", render);
    els.statusFilter.addEventListener("change", render);

    els.rows.addEventListener("click", onTableClick);
  }

  async function init() {
    await requireAuth();
    document.getElementById("signOutBtn")?.addEventListener("click", signOut);

    await incidentRepository.init();
    bind();
    render();
  }

  init().catch((e) => console.error("Incidents init failed:", e));
}
