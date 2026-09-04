import { DROPDOWNS } from "./config/dropdowns.js";
import { qs, fillSelect } from "./ui/dom.js";
import { copyToClipboard } from "./ui/clipboard.js";
import { caseRepository } from "./features/cases/caseRepository.js";
import { formatDateTime } from "./ui/datetime.js";
import { draftRepository } from "./features/cases/draftRepository.js";
import { initNavbar } from "./ui/navbar.js";
initNavbar();
await caseRepository.init();



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
  majorOutage: qs("#majorOutage"),
  interruptBtn: qs("#interruptBtn"),
resumeBtn: qs("#resumeBtn"),


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
    majorOutage: els.majorOutage.checked,
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
  els.majorOutage.checked = Boolean(data.majorOutage);
}

const MAJOR_OUTAGE_YES = "There is a Major outage";
const MAJOR_OUTAGE_NO = "There is no major outage";
const MAJOR_OUTAGE_LINE_RE = /^There is( a)?( no)? Major outage$/i;

// Houdt enkel de eerste regel van (Pre-)Analysis gesynchroniseerd met de
// checkbox; de rest van wat je daar zelf typt blijft onaangeroerd.
function syncMajorOutageLine() {
  const line = els.majorOutage.checked ? MAJOR_OUTAGE_YES : MAJOR_OUTAGE_NO;
  const lines = els.preAnalysis.value.split("\n");

  if (lines.length && MAJOR_OUTAGE_LINE_RE.test(lines[0].trim())) {
    lines[0] = line;
  } else {
    lines.unshift(line);
  }

  els.preAnalysis.value = lines.join("\n");
}

function getDraftData() {
  // we saven alles wat in het form zit + context
  return {
    selectedId,
    form: getFormData(),
    savedAt: Date.now(),
  };
}

function loadDraft(draft) {
  if (!draft) return;
  selectedId = draft.selectedId ?? null;
  setFormData(draft.form ?? {});
  els.editLabel.textContent = selectedId
    ? `Editing (resumed): ${draft.form?.customerCode || selectedId}`
    : "Resumed draft (new case)";
}

function updateResumeButton() {
  const count = draftRepository.peekStackCount();
  els.resumeBtn.disabled = count === 0;
  els.resumeBtn.textContent = count === 0 ? "Resume previous" : `Resume previous (${count})`;
}


function resetForm() {
  selectedId = null;
  els.editLabel.textContent = "Create a new case";
  setFormData({});
  syncMajorOutageLine();
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

els.resetBtn.addEventListener("click", resetForm);

// Autosave gebeurt al via de form-brede "change"-listener verderop.
els.majorOutage.addEventListener("change", syncMajorOutageLine);

els.saveBtn.addEventListener("click", () => {
  const data = getFormData();

  if (!selectedId) {
    const created = caseRepository.create(data);
    selectedId = created.id;
    els.editLabel.textContent = `Saved: ${created.customerCode || created.id}`;
  } else {
    const updated = caseRepository.update(selectedId, data);
    els.editLabel.textContent = `Updated: ${updated?.customerCode || selectedId}`;
  }
});

els.copyBtn.addEventListener("click", async () => {
  const data = getFormData();
  const text = buildWorklogText(data);

  if (!text.trim()) {
    els.copyBtn.textContent = "Nothing to copy";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 900);
    return;
  }

  try {
    await copyToClipboard(text);
    els.copyBtn.textContent = "Copied ✓";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 900);
  } catch {
    els.copyBtn.textContent = "Copy failed";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 900);
  }
});

els.interruptBtn.addEventListener("click", () => {
  // bewaar huidige case op de stack
  draftRepository.pushToStack(getDraftData());

  // start nieuwe (interrupt) case
  resetForm();

  const lastDraft = draftRepository.getDraft();
  if (lastDraft?.form) {
    loadDraft(lastDraft);
  }
  updateResumeButton();
  

  // bewaar ook deze lege start als "current draft"
  draftRepository.saveDraft(getDraftData());

  updateResumeButton();
  els.editLabel.textContent = "New interrupt case (fresh)";
});

els.resumeBtn.addEventListener("click", () => {
  const prev = draftRepository.popFromStack();
  if (!prev) return;

  loadDraft(prev);
  draftRepository.saveDraft(getDraftData());
  updateResumeButton();
});





const caseIdFromUrl = new URLSearchParams(window.location.search).get("caseId");
const caseFromUrl = caseIdFromUrl ? caseRepository.getById(caseIdFromUrl) : null;

if (caseFromUrl) {
  selectedId = caseFromUrl.id;
  setFormData(caseFromUrl);
  els.editLabel.textContent = `Editing: ${caseFromUrl.customerCode || caseFromUrl.id}`;
} else {
  resetForm();
}

let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    // current draft (not stack) = latest state (optional but useful)
    draftRepository.saveDraft(getDraftData());
    updateResumeButton();
  }, 400);
}

// autosave op input/change
const formEl = qs("#worklogForm");
formEl.addEventListener("input", scheduleAutosave);
formEl.addEventListener("change", scheduleAutosave);


