
import { followupRepository } from "./features/followups/followupRepository.js";

await followupRepository.init();



const els = {
  rows: document.getElementById("rows"),
  emptyState: document.getElementById("emptyState"),
  summaryLine: document.getElementById("summaryLine"),

  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  sortSelect: document.getElementById("sortSelect"),

  titleInput: document.getElementById("titleInput"),
  dueInput: document.getElementById("dueInput"),
  statusInput: document.getElementById("statusInput"),
  detailsInput: document.getElementById("detailsInput"),
  btnAdd: document.getElementById("btnAdd"),

  btnExportJson: document.getElementById("btnExportJson"),
  importJsonInput: document.getElementById("importJsonInput"),
};

function uid() {
  return (crypto?.randomUUID?.() ?? String(Math.random()).slice(2)) + "-" + Date.now();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalize(s) {
  return String(s ?? "").trim().toLowerCase();
}

function formatDate(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  // keep it simple; your inputs are YYYY-MM-DD
  const [y, m, d] = String(yyyyMmDd).split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}-${m}-${y}`;
}

function isOverdue(item) {
  if (!item.dueDate) return false;
  if (item.status === "done") return false;
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(item.dueDate + "T00:00:00").getTime();
  return due < t;
}

function badge(status) {
  const label = status === "todo" ? "To do" : status === "tbc" ? "To be checked" : "Done";
  return `<span class="badge ${status}"><span class="dot"></span>${label}</span>`;
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getFilteredSorted(items) {
  const q = normalize(els.searchInput.value);
  const status = els.statusFilter.value;
  const sort = els.sortSelect.value;

  let out = items.filter((it) => {
    if (status !== "all" && it.status !== status) return false;
    if (!q) return true;
    const hay = `${it.title} ${it.details} ${it.status} ${it.dueDate}`.toLowerCase();
    return hay.includes(q);
  });

  const dueVal = (it) => (it.dueDate ? new Date(it.dueDate + "T00:00:00").getTime() : Number.POSITIVE_INFINITY);

  const statusWeight = (it) => (it.status === "done" ? 1 : 0);

out.sort((a, b) => {
  // ✅ Always push "done" to bottom
  const w = statusWeight(a) - statusWeight(b);
  if (w !== 0) return w;

  // Normal sorting for the rest
  if (sort === "dueAsc") return dueVal(a) - dueVal(b);
  if (sort === "dueDesc") return dueVal(b) - dueVal(a);
  if (sort === "createdAsc") return a.createdAt - b.createdAt;
  return b.createdAt - a.createdAt; // createdDesc
});


  return out;
}

function updateSummary(items) {
  const total = items.length;
  const todo = items.filter((i) => i.status === "todo").length;
  const tbc = items.filter((i) => i.status === "tbc").length;
  const done = items.filter((i) => i.status === "done").length;
  const overdue = items.filter((i) => isOverdue(i)).length;

  els.summaryLine.textContent = `${total} total • ${todo} to do • ${tbc} to be checked • ${done} done${overdue ? ` • ${overdue} overdue` : ""}`;
}

function rowHtml(it) {
  const due = it.dueDate ? formatDate(it.dueDate) : "—";
  const overdue = isOverdue(it) ? `<span class="overdue">Overdue</span>` : "";
  const details = it.details ? `<div class="sub">${escapeHtml(it.details)}</div>` : "";

  return `
    <tr data-id="${escapeHtml(it.id)}">
      <td>${due} ${overdue ? `<div class="sub">${overdue}</div>` : ""}</td>
      <td>${badge(it.status)}</td>
      <td>
        <div class="title">${escapeHtml(it.title)}</div>
        ${details}
      </td>
      <td style="text-align:right;">
        <div class="row-actions">
          <button class="btn small" data-action="cycle" type="button">Change status</button>
          <button class="btn small" data-action="edit" type="button">Edit</button>
          <button class="btn small danger" data-action="delete" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `;
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
  const items = load();
  updateSummary(items);

  const view = getFilteredSorted(items);
  els.rows.innerHTML = view.map(rowHtml).join("");

  const empty = items.length === 0;
  els.emptyState.style.display = empty ? "block" : "none";
}

function addItem() {
  const title = String(els.titleInput.value ?? "").trim();
  if (!title) return alert("Please enter a title.");

  const item = {
    id: uid(),
    title,
    details: String(els.detailsInput.value ?? "").trim(),
    dueDate: els.dueInput.value || "",
    status: els.statusInput.value || "todo",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const items = load();
  items.unshift(item);
  save(items);

  els.titleInput.value = "";
  els.detailsInput.value = "";
  els.dueInput.value = "";
  els.statusInput.value = "todo";

  render();
}

function cycleStatus(current) {
  if (current === "todo") return "tbc";
  if (current === "tbc") return "done";
  return "todo";
}

function onTableClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const tr = btn.closest("tr[data-id]");
  const id = tr?.dataset?.id;
  if (!id) return;

  const action = btn.dataset.action;
  const items = load();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return;

  if (action === "delete") {
    if (!confirm("Delete this follow-up?")) return;
    items.splice(idx, 1);
    save(items);
    render();
    return;
  }

  if (action === "cycle") {
    items[idx].status = cycleStatus(items[idx].status);
    items[idx].updatedAt = Date.now();
    save(items);
    render();
    return;
  }

  if (action === "edit") {
    const t = prompt("Title:", items[idx].title);
    if (t === null) return;

    const d = prompt("Details (optional):", items[idx].details || "");
    if (d === null) return;

    const due = prompt("Due date (YYYY-MM-DD) or empty:", items[idx].dueDate || "");
    if (due === null) return;

    const s = prompt("Status (todo / tbc / done):", items[idx].status);
    if (s === null) return;

    const status = ["todo", "tbc", "done"].includes(s.trim()) ? s.trim() : items[idx].status;

    items[idx] = {
      ...items[idx],
      title: t.trim() || items[idx].title,
      details: d.trim(),
      dueDate: due.trim(),
      status,
      updatedAt: Date.now(),
    };

    save(items);
    render();
  }
}

function exportJson() {
  const items = load();
  downloadTextFile("followups.json", JSON.stringify(items, null, 2), "application/json");
}

async function importJsonFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert("Invalid JSON");
    return;
  }
  if (!Array.isArray(parsed)) {
    alert("JSON must be an array");
    return;
  }

  const cleaned = parsed
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: String(x.id ?? uid()),
      title: String(x.title ?? "").trim() || "Untitled",
      details: String(x.details ?? ""),
      dueDate: String(x.dueDate ?? ""),
      status: ["todo", "tbc", "done"].includes(String(x.status)) ? String(x.status) : "todo",
      createdAt: Number(x.createdAt) || Date.now(),
      updatedAt: Number(x.updatedAt) || Date.now(),
    }));

  save(cleaned);
  render();
}

function bind() {
  els.btnAdd.addEventListener("click", addItem);

  els.searchInput.addEventListener("input", render);
  els.statusFilter.addEventListener("change", render);
  els.sortSelect.addEventListener("change", render);

  els.rows.addEventListener("click", onTableClick);

  els.btnExportJson.addEventListener("click", exportJson);

  els.importJsonInput.addEventListener("change", async () => {
    const file = els.importJsonInput.files?.[0];
    if (!file) return;
    await importJsonFile(file);
    els.importJsonInput.value = "";
  });
}

function init() {
  bind();
  render();
}

init();
