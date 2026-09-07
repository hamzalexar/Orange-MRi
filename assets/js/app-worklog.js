import { DROPDOWNS } from "./config/dropdowns.js";
import { qs, fillSelect } from "./ui/dom.js";
import { copyToClipboard } from "./ui/clipboard.js";
import { caseRepository } from "./features/cases/caseRepository.js";
import { incidentRepository } from "./features/incidents/incidentRepository.js";
import { formatDateTime } from "./ui/datetime.js";
import { initNavbar } from "./ui/navbar.js";
import { requireAuth } from "./core/auth.js";
initNavbar();
const session = await requireAuth();
await caseRepository.init();
await incidentRepository.init();

// Formulier blijft staan tot je expliciet op Reset drukt, ook als je
// tussendoor naar een andere pagina navigeert. Per-gebruiker sleutel,
// zelfde patroon als caseRepository, zodat een collega op hetzelfde
// toestel dit nooit te zien krijgt.
const DRAFT_KEY = `bot_worklog_draft_v2::${session.user.id}`;

function saveDraftState() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedId, form: getFormData() }));
}

function clearDraftState() {
  localStorage.removeItem(DRAFT_KEY);
}

function loadDraftState() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}



const els = {
  editLabel: qs("#editLabel"),
  saveBtn: qs("#saveBtn"),
  resetBtn: qs("#resetBtn"),
  copyBtn: qs("#copyBtn"),

  customerCode: qs("#customerCode"),
  task:qs("#task"),
  problemDescription: qs("#problemDescription"),
  preAnalysis: qs("#preAnalysis"),
  interaction: qs("#interaction"),
  contactType: qs("#contactType"),
  outcome: qs("#outcome"),
  actionsDone: qs("#actionsDone"),
  ringRing: qs("#ringRing"),
  technicianDate: qs("#technicianDate"),
  todoRequired: qs("#todoRequired"),
  customerCalled: qs("#customerCalled"),
  majorOutageYes: qs("#majorOutageYes"),
  majorOutageNo: qs("#majorOutageNo"),
  outboundBtn: qs("#outboundBtn"),
  inboundBtn: qs("#inboundBtn"),
  incidentBtn: qs("#incidentBtn"),
};

let selectedId = null;

// init dropdowns
fillSelect(els.interaction, DROPDOWNS.interaction);
fillSelect(els.contactType, DROPDOWNS.contactType);
fillSelect(els.outcome, DROPDOWNS.outcome);

function getFormData() {
  return {
    customerCode: els.customerCode.value.trim(),
    task: els.task.value.trim(),
    problemDescription: els.problemDescription.value.trim(),
    preAnalysis: els.preAnalysis.value.trim(),
    interaction: els.interaction.value,
    contactType: els.contactType.value,
    outcome: els.outcome.value,
    customerCalled: els.customerCalled.checked, // ✅ NIEUW
    majorOutage: els.majorOutageYes.checked,
    actionsDone: els.actionsDone.value.trim(),
    ringRing: els.ringRing.value.trim(),
    technicianDate: els.technicianDate.value.trim(),
    todoRequired: els.todoRequired.value.trim(),
  };
}


function setFormData(data) {
  els.customerCode.value = data.customerCode ?? "";
  els.task.value = data.task ?? "";
  els.problemDescription.value = data.problemDescription ?? "";
  els.preAnalysis.value = data.preAnalysis ?? "";
  els.interaction.value = data.interaction ?? DROPDOWNS.interaction[0];
  els.contactType.value = data.contactType ?? DROPDOWNS.contactType[0];
  els.outcome.value = data.outcome ?? DROPDOWNS.outcome[0];
  els.actionsDone.value = data.actionsDone ?? "";
  els.ringRing.value = data.ringRing ?? "";
  els.technicianDate.value = data.technicianDate ?? "";
  els.todoRequired.value = data.todoRequired ?? "";
  els.customerCalled.checked = Boolean(data.customerCalled);
  // Ongekozen (undefined) laat beide radio's leeg i.p.v. te forceren naar "No".
  els.majorOutageYes.checked = data.majorOutage === true;
  els.majorOutageNo.checked = data.majorOutage === false;
}

const MAJOR_OUTAGE_YES = "There is a Major outage";
const MAJOR_OUTAGE_NO = "There is no major outage";
const MAJOR_OUTAGE_LINE_RE = /^There is( a)?( no)? Major outage$/i;

// Houdt enkel de eerste regel van (Pre-)Analysis gesynchroniseerd met de
// Yes/No-keuze; de rest van wat je daar zelf typt blijft onaangeroerd.
function syncMajorOutageLine() {
  const line = els.majorOutageYes.checked ? MAJOR_OUTAGE_YES : MAJOR_OUTAGE_NO;
  const lines = els.preAnalysis.value.split("\n");

  if (lines.length && MAJOR_OUTAGE_LINE_RE.test(lines[0].trim())) {
    lines[0] = line;
  } else {
    lines.unshift(line);
  }

  els.preAnalysis.value = lines.join("\n");
}

function resetForm() {
  selectedId = null;
  els.editLabel.textContent = "Create a new case";
  setFormData({});
  // Geen syncMajorOutageLine() hier: (Pre-)Analysis blijft leeg tot je
  // bewust Yes/No kiest voor Major outage.
}

function addSection(lines, label, value) {
  const v = String(value ?? "").trim();
  if (!v) return;                 // ✅ skip leeg
  lines.push(`${label}: ${v}`);
  lines.push("");                 // lege lijn tussen blokken
}

function buildWorklogText(data) {
  const lines = [];

  addSection(lines, "Customer Code", data.customerCode);
  addSection(lines, "Task", data.task);
  addSection(lines, "Problem Description", data.problemDescription);
  addSection(lines, "(Pre-)Analysis", data.preAnalysis);

  // dropdowns: alleen toevoegen als je ze niet leeg wil
  // (hier gaan we er van uit dat ze altijd een waarde hebben)
  addSection(lines, "Interaction", data.interaction);
  addSection(lines, "Contact Type", data.contactType);
  addSection(lines, "Outcome", data.outcome);
  addSection(lines, "Actions Done", data.actionsDone);
  addSection(lines, "Ring Ring (if available)", data.ringRing);
  addSection(lines, "Technician Date (if booked)", data.technicianDate);
  addSection(lines, "To Do / Required Actions", data.todoRequired);
  if (data.handledAt) {
    addSection(lines, "Handled at", formatDateTime(data.handledAt));
  }

  // remove laatste lege lijn
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
}

// Slaat het huidige formulier op (nieuw of update) en geeft de case terug.
function saveCurrentCase(data) {
  if (!selectedId) {
    const created = caseRepository.create(data);
    selectedId = created.id;
    return created;
  }
  return caseRepository.update(selectedId, data) ?? caseRepository.getById(selectedId);
}

els.resetBtn.addEventListener("click", () => {
  resetForm();
  clearDraftState();
});

// Autosave: elke wijziging in het formulier blijft bewaard tot Reset.
const formEl = qs("#worklogForm");
formEl.addEventListener("input", saveDraftState);
formEl.addEventListener("change", saveDraftState);

els.majorOutageYes.addEventListener("change", syncMajorOutageLine);
els.majorOutageNo.addEventListener("change", syncMajorOutageLine);

els.outboundBtn.addEventListener("click", () => {
  els.interaction.value = "Outbound";
  saveDraftState();
});
els.inboundBtn.addEventListener("click", () => {
  els.interaction.value = "Inbound";
  saveDraftState();
});

els.incidentBtn.addEventListener("click", () => {
  const title = prompt("Incident title:");
  if (title === null) return; // geannuleerd
  if (!title.trim()) return;

  incidentRepository.create(title);
  els.incidentBtn.textContent = "Incident saved ✓";
  setTimeout(() => (els.incidentBtn.textContent = "Incident"), 1200);
});

els.saveBtn.addEventListener("click", () => {
  const data = getFormData();
  const wasNew = !selectedId;
  const saved = saveCurrentCase(data);
  els.editLabel.textContent = `${wasNew ? "Saved" : "Updated"}: ${saved?.customerCode || saved?.id || ""}`;
  saveDraftState(); // ✅ nu weet de draft ook het (eventueel nieuwe) selectedId
});

// Copy slaat de case ook meteen op (nieuw of update), zodat je nooit een
// gekopieerde worklog hebt die niet ook in Cases/Stats terechtkomt.
els.copyBtn.addEventListener("click", async () => {
  const data = getFormData();
  const text = buildWorklogText(data);

  if (!text.trim()) {
    els.copyBtn.textContent = "Nothing to copy";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 900);
    return;
  }

  const saved = saveCurrentCase(data);
  els.editLabel.textContent = `Saved: ${saved?.customerCode || saved?.id || ""}`;
  saveDraftState(); // ✅ nu weet de draft ook het (eventueel nieuwe) selectedId

  try {
    await copyToClipboard(text);
    els.copyBtn.textContent = "Saved & copied ✓";
  } catch {
    els.copyBtn.textContent = "Saved, copy failed";
  }
  setTimeout(() => (els.copyBtn.textContent = "Copy"), 1200);
});

const caseIdFromUrl = new URLSearchParams(window.location.search).get("caseId");
const caseFromUrl = caseIdFromUrl ? caseRepository.getById(caseIdFromUrl) : null;

if (caseFromUrl) {
  selectedId = caseFromUrl.id;
  setFormData(caseFromUrl);
  els.editLabel.textContent = `Editing: ${caseFromUrl.customerCode || caseFromUrl.id}`;
} else {
  const draft = loadDraftState();
  if (draft?.form) {
    selectedId = draft.selectedId ?? null;
    setFormData(draft.form);
    els.editLabel.textContent = selectedId
      ? `Editing: ${draft.form.customerCode || selectedId}`
      : "Create a new case";
  } else {
    resetForm();
  }
}
