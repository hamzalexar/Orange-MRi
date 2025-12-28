import { qs } from "./ui/dom.js";
import { caseRepository } from "./features/cases/caseRepository.js";
import { initNavbar } from "./ui/navbar.js";
initNavbar();


const els = {
  rangeLabel: qs("#rangeLabel"),
  dayPicker: qs("#dayPicker"),
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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
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

function inRange(c, fromTs, toTs) {
  // handledAt is “moment you saved / worked on it” (beste voor stats)
  const t = c.handledAt ?? c.createdAt ?? 0;
  return t >= fromTs && t <= toTs;
}

function render() {
  const all = caseRepository.getAll();

  const selected = els.dayPicker.value
    ? new Date(els.dayPicker.value + "T00:00:00")
    : new Date();

  const fromTs = startOfDay(selected);
  const toTs = endOfDay(selected);

  const items = all.filter(c => inRange(c, fromTs, toTs));

  const total = items.length;
  const inbound = items.filter(isInbound);
  const outbound = items.filter(isOutbound);

  // “customers called” = outbound cases with customerCalled true
  const outboundCalled = outbound.filter(c => c.customerCalled === true);

  els.rangeLabel.textContent = `Showing: ${selected.toLocaleDateString()}`;

  els.totalCases.textContent = String(total);
  els.totalSub.textContent = "cases in selected day";

  els.inboundCases.textContent = String(inbound.length);
  els.inboundSub.textContent = total ? `${pct(inbound.length, total)}% of total` : "—";

  els.outboundCases.textContent = String(outbound.length);
  els.outboundSub.textContent = total ? `${pct(outbound.length, total)}% of total` : "—";

  els.calledCustomers.textContent = String(outboundCalled.length);
  els.calledSub.textContent = "outbound called";

  const rate = pct(outboundCalled.length, outbound.length);
  els.callRateLabel.textContent = `${rate}%`;
  els.callRateBar.style.width = `${rate}%`;
  els.callRateSub.textContent = `${outboundCalled.length} / ${outbound.length} outbound`;
}

function setToday() {
  els.dayPicker.value = toDateInputValue(new Date());
  render();
}

els.dayPicker.addEventListener("change", render);
els.btnToday.addEventListener("click", setToday);

// boot
setToday();
