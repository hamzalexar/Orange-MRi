import { qs } from "./ui/dom.js";
import { caseRepository } from "./features/cases/caseRepository.js";

const els = {
  rangeLabel: qs("#rangeLabel"),

  periodSelect: qs("#periodSelect"),
  dayPicker: qs("#dayPicker"),
  monthPicker: qs("#monthPicker"),
  yearPicker: qs("#yearPicker"),
  btnToday: qs("#btnToday"),

  totalCases: qs("#totalCases"),
  totalSub: qs("#totalSub"),

  inboundCases: qs("#inboundCases"),
  inboundSub: qs("#inboundSub"),

  outboundCases: qs("#outboundCases"),
  outboundSub: qs("#outboundSub"),

  calledCustomers: qs("#calledCustomers"),
  calledSub: qs("#calledSub"),

  callRateBar: qs("#callRateBar"),
  callRateLabel: qs("#callRateLabel"),
  callRateSub: qs("#callRateSub"),
};

// YYYY-MM-DD for <input type="date">
function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// YYYY-MM for <input type="month">
function toMonthInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}
function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function startOfMonth(y, mIndex) {
  return new Date(y, mIndex, 1, 0, 0, 0, 0).getTime();
}
function endOfMonth(y, mIndex) {
  return new Date(y, mIndex + 1, 0, 23, 59, 59, 999).getTime();
}

function startOfYear(y) {
  return new Date(y, 0, 1, 0, 0, 0, 0).getTime();
}
function endOfYear(y) {
  return new Date(y, 11, 31, 23, 59, 59, 999).getTime();
}

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function isInbound(c) {
  return c.interaction === "Inbound";
}
function isOutbound(c) {
  return c.interaction !== "Inbound";
}

function caseTime(c) {
  return c.handledAt ?? c.createdAt ?? 0;
}

function inRange(c, fromTs, toTs) {
  const t = caseTime(c);
  return t >= fromTs && t <= toTs;
}

function fillYearPicker(allCases) {
  const years = new Set();
  const nowY = new Date().getFullYear();
  years.add(nowY);

  for (const c of allCases) {
    const t = caseTime(c);
    if (t) years.add(new Date(t).getFullYear());
  }

  const sorted = Array.from(years).sort((a, b) => b - a);

  els.yearPicker.innerHTML = "";
  for (const y of sorted) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    els.yearPicker.appendChild(opt);
  }
}

function setPickerVisibility(period) {
  els.dayPicker.style.display = period === "day" ? "" : "none";
  els.monthPicker.style.display = period === "month" ? "" : "none";
  els.yearPicker.style.display = period === "year" ? "" : "none";
}

function getRange(period) {
  const now = new Date();

  if (period === "day") {
    const d = els.dayPicker.value ? new Date(els.dayPicker.value + "T00:00:00") : now;
    return { fromTs: startOfDay(d), toTs: endOfDay(d), label: d.toLocaleDateString() };
  }

  if (period === "month") {
    const val = els.monthPicker.value || toMonthInputValue(now); // "YYYY-MM"
    const [yStr, mStr] = val.split("-");
    const y = Number(yStr);
    const mIndex = Number(mStr) - 1;
    const fromTs = startOfMonth(y, mIndex);
    const toTs = endOfMonth(y, mIndex);
    const label = new Date(y, mIndex, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
    return { fromTs, toTs, label };
  }

  // year
  const y = Number(els.yearPicker.value || now.getFullYear());
  return { fromTs: startOfYear(y), toTs: endOfYear(y), label: String(y) };
}

function render() {
  const all = caseRepository.getAll();

  // ensure pickers have sane defaults
  fillYearPicker(all);

  const period = els.periodSelect.value || "day";
  setPickerVisibility(period);

  if (period === "day" && !els.dayPicker.value) els.dayPicker.value = toDateInputValue(new Date());
  if (period === "month" && !els.monthPicker.value) els.monthPicker.value = toMonthInputValue(new Date());
  if (period === "year" && !els.yearPicker.value) els.yearPicker.value = String(new Date().getFullYear());

  const { fromTs, toTs, label } = getRange(period);

  const items = all.filter(c => inRange(c, fromTs, toTs));

  const total = items.length;
  const inbound = items.filter(isInbound);
  const outbound = items.filter(isOutbound);

  const outboundCalled = outbound.filter(c => c.customerCalled === true);

  els.rangeLabel.textContent = `Showing: ${period.toUpperCase()} — ${label}`;

  // General (inbound+outbound samen)
  els.totalCases.textContent = String(total);
  els.totalSub.textContent = `total cases in selected ${period}`;

  // Inbound/Outbound tonen we nog steeds (handig), maar total is samen
  els.inboundCases.textContent = String(inbound.length);
  els.inboundSub.textContent = total ? `${pct(inbound.length, total)}% of total` : "—";

  els.outboundCases.textContent = String(outbound.length);
  els.outboundSub.textContent = total ? `${pct(outbound.length, total)}% of total` : "—";

  // Customers called (outbound only)
  els.calledCustomers.textContent = String(outboundCalled.length);
  els.calledSub.textContent = "outbound called";

  const rate = pct(outboundCalled.length, outbound.length);
  els.callRateLabel.textContent = `${rate}%`;
  els.callRateBar.style.width = `${rate}%`;
  els.callRateSub.textContent = `${outboundCalled.length} / ${outbound.length} outbound`;
}

function setToday() {
  els.periodSelect.value = "day";
  setPickerVisibility("day");
  els.dayPicker.value = toDateInputValue(new Date());
  render();
}

// events
els.periodSelect.addEventListener("change", render);
els.dayPicker.addEventListener("change", render);
els.monthPicker.addEventListener("change", render);
els.yearPicker.addEventListener("change", render);
els.btnToday.addEventListener("click", setToday);

// boot
setToday();

