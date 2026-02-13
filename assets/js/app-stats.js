import { qs } from "./ui/dom.js";
import { caseRepository } from "./features/cases/caseRepository.js";
await caseRepository.init();

console.log("app-stats.js loaded ✅");

window.addEventListener("error", (e) => {
  console.error("JS error:", e.message);
});

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

  chartHour: qs("#chartHour"),
  chartDay: qs("#chartDay"),
  chartWeek: qs("#chartWeek"),
  chartMonth: qs("#chartMonth"),

  flowFilter: qs("#flowFilter"),
};

// -------- date helpers
function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
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
function addDays(ts, days) {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}
function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function caseTime(c) {
  return c.handledAt ?? c.createdAt ?? 0;
}
function inRange(c, fromTs, toTs) {
  const t = caseTime(c);
  return t >= fromTs && t <= toTs;
}
function isInbound(c) {
  return c.interaction === "Inbound";
}
function isOutbound(c) {
  return c.interaction !== "Inbound";
}

function matchesFlow(c, flow) {
  if (flow === "inbound") return isInbound(c);
  if (flow === "outbound") return isOutbound(c);
  return true; // all
}

// -------- picker helpers
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
    const val = els.monthPicker.value || toMonthInputValue(now); // YYYY-MM
    const [yStr, mStr] = val.split("-");
    const y = Number(yStr);
    const mIndex = Number(mStr) - 1;
    const fromTs = startOfMonth(y, mIndex);
    const toTs = endOfMonth(y, mIndex);
    const label = new Date(y, mIndex, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
    return { fromTs, toTs, label };
  }
  const y = Number(els.yearPicker.value || now.getFullYear());
  return { fromTs: startOfYear(y), toTs: endOfYear(y), label: String(y) };
}

// -------- SVG chart helpers (no libs)
function svgWrap(inner, w = 620, h = 220) {
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="chart">${inner}</svg>`;
}
function maxVal(arr) {
  let m = 0;
  for (const v of arr) if (v > m) m = v;
  return m;
}

function renderBarChart(container, labels, values) {
  if (!container) return;
  const w = 620, h = 220;
  const padL = 34, padR = 14, padT = 14, padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(values.length, 1);
  const m = Math.max(maxVal(values), 1);

  const gap = 8;
  const barW = Math.max(6, (innerW - gap * (n - 1)) / n);

  const grid = [0.0, 0.5, 1.0]
    .map((p) => {
      const y = padT + innerH - innerH * p;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(0,0,0,0.08)" />`;
    })
    .join("");

  const bars = values
    .map((v, i) => {
      const x = padL + i * (barW + gap);
      const bh = (v / m) * innerH;
      const y = padT + (innerH - bh);
      return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="8" fill="var(--accent)"></rect>`;
    })
    .join("");

  const tickEvery = n > 16 ? Math.ceil(n / 8) : 1;
  const xLabels = labels
    .map((t, i) => {
      if (i % tickEvery !== 0) return "";
      const x = padL + i * (barW + gap) + barW / 2;
      return `<text x="${x}" y="${h - 16}" text-anchor="middle" font-size="12" fill="rgba(2,6,23,0.65)">${t}</text>`;
    })
    .join("");

  const yMax = `<text x="${padL - 8}" y="${padT + 10}" text-anchor="end" font-size="12" fill="rgba(2,6,23,0.65)">${m}</text>`;
  const yZero = `<text x="${padL - 8}" y="${padT + innerH}" text-anchor="end" font-size="12" fill="rgba(2,6,23,0.65)">0</text>`;

  container.innerHTML = svgWrap(`${grid}${bars}${xLabels}${yMax}${yZero}`, w, h);
}

function renderLineChart(container, labels, values) {
  if (!container) return;
  const w = 620, h = 220;
  const padL = 34, padR = 14, padT = 14, padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(values.length, 1);
  const m = Math.max(maxVal(values), 1);

  const grid = [0.0, 0.5, 1.0]
    .map((p) => {
      const y = padT + innerH - innerH * p;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(0,0,0,0.08)" />`;
    })
    .join("");

  const pts = values.map((v, i) => {
    const x = padL + (n === 1 ? 0 : (i / (n - 1)) * innerW);
    const y = padT + innerH - (v / m) * innerH;
    return { x, y };
  });

  const poly = `<polyline fill="none" stroke="var(--accent)" stroke-width="3" points="${pts
    .map((p) => `${p.x},${p.y}`)
    .join(" ")}" />`;

  const dots = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" />`).join("");

  const tickEvery = n > 16 ? Math.ceil(n / 8) : 1;
  const xLabels = labels
    .map((t, i) => {
      if (i % tickEvery !== 0) return "";
      const x = padL + (n === 1 ? 0 : (i / (n - 1)) * innerW);
      return `<text x="${x}" y="${h - 16}" text-anchor="middle" font-size="12" fill="rgba(2,6,23,0.65)">${t}</text>`;
    })
    .join("");

  const yMax = `<text x="${padL - 8}" y="${padT + 10}" text-anchor="end" font-size="12" fill="rgba(2,6,23,0.65)">${m}</text>`;
  const yZero = `<text x="${padL - 8}" y="${padT + innerH}" text-anchor="end" font-size="12" fill="rgba(2,6,23,0.65)">0</text>`;

  container.innerHTML = svgWrap(`${grid}${poly}${dots}${xLabels}${yMax}${yZero}`, w, h);
}

// -------- aggregations for dashboard charts
function groupByHour(cases, fromTs, toTs) {
  const bins = Array.from({ length: 24 }, () => 0);
  for (const c of cases) {
    const t = caseTime(c);
    if (t < fromTs || t > toTs) continue;
    bins[new Date(t).getHours()]++;
  }
  return bins;
}

function groupLastNDays(cases, endTs, days = 14) {
  const labels = [];
  const values = [];
  const startTs = startOfDay(new Date(addDays(endTs, -(days - 1))));
  for (let i = 0; i < days; i++) {
    const dayStart = addDays(startTs, i);
    const dayEnd = endOfDay(new Date(dayStart));
    const count = cases.filter((c) => inRange(c, dayStart, dayEnd)).length;
    labels.push(new Date(dayStart).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" }));
    values.push(count);
  }
  return { labels, values };
}

function weekKey(ts) {
  const d = new Date(ts);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return { y: tmp.getUTCFullYear(), w: weekNo };
}

function groupLastNWeeks(cases, endTs, weeks = 8) {
  const end = endTs;
  const labels = [];
  const values = [];

  const keys = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const t = addDays(end, -7 * i);
    const { y, w } = weekKey(t);
    keys.push(`${y}-W${String(w).padStart(2, "0")}`);
  }

  const map = new Map(keys.map((k) => [k, 0]));
  for (const c of cases) {
    const t = caseTime(c);
    if (t > end) continue;
    const { y, w } = weekKey(t);
    const k = `${y}-W${String(w).padStart(2, "0")}`;
    if (map.has(k)) map.set(k, map.get(k) + 1);
  }

  for (const k of keys) {
    labels.push(k.split("-W")[1]);
    values.push(map.get(k) ?? 0);
  }
  return { labels, values };
}

function groupLastNMonths(cases, endTs, months = 12) {
  const end = new Date(endTs);
  const labels = [];
  const values = [];

  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const map = new Map(keys.map((k) => [k, 0]));
  for (const c of cases) {
    const t = caseTime(c);
    const d = new Date(t);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (map.has(k)) map.set(k, map.get(k) + 1);
  }

  for (const k of keys) {
    const [y, m] = k.split("-");
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "short" });
    labels.push(label);
    values.push(map.get(k) ?? 0);
  }
  return { labels, values };
}

// -------- render main dashboard
function render() {
  const all = caseRepository.getAll();

  fillYearPicker(all);

  const period = els.periodSelect.value || "day";
  setPickerVisibility(period);

  if (period === "day" && !els.dayPicker.value) els.dayPicker.value = toDateInputValue(new Date());
  if (period === "month" && !els.monthPicker.value) els.monthPicker.value = toMonthInputValue(new Date());
  if (period === "year" && !els.yearPicker.value) els.yearPicker.value = String(new Date().getFullYear());

  const { fromTs, toTs, label } = getRange(period);

  const flow = els.flowFilter?.value || "all";

  // KPI range + flow
  const items = all.filter((c) => inRange(c, fromTs, toTs) && matchesFlow(c, flow));

  // charts should also respect flow
  const filteredAll = all.filter((c) => matchesFlow(c, flow));

  console.log("render() cases:", all.length, "flow:", flow, "items:", items.length);

  const total = items.length;
  const inbound = items.filter(isInbound);
  const outbound = items.filter(isOutbound);
  const outboundCalled = outbound.filter((c) => c.customerCalled === true);

  els.rangeLabel.textContent = `Showing: ${period.toUpperCase()} — ${label}`;

  els.totalCases.textContent = String(total);
  els.totalSub.textContent = `total in ${period}`;

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

  // Charts
  const hourBins = groupByHour(filteredAll, fromTs, toTs);
  const hourLabels = Array.from({ length: 24 }, (_, i) => String(i));
  renderLineChart(els.chartHour, hourLabels, hourBins);

  const day = groupLastNDays(filteredAll, toTs, 14);
  renderBarChart(els.chartDay, day.labels, day.values);

  const week = groupLastNWeeks(filteredAll, toTs, 8);
  renderBarChart(els.chartWeek, week.labels, week.values);

  const month = groupLastNMonths(filteredAll, toTs, 12);
  renderBarChart(els.chartMonth, month.labels, month.values);
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
els.flowFilter?.addEventListener("change", render);
els.btnToday.addEventListener("click", setToday);

// boot
setToday();