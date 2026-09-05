import { qs } from "./ui/dom.js";
import { caseRepository } from "./features/cases/caseRepository.js";
import { requireAuth, signOut } from "./core/auth.js";
await requireAuth();
document.getElementById("signOutBtn")?.addEventListener("click", signOut);
await caseRepository.init();

console.log("app-stats.js loaded ✅");

window.addEventListener("error", (e) => {
  console.error("JS error:", e.message);
});

const els = {
  rangeLabel: qs("#rangeLabel"),

  periodSegmented: qs("#periodSegmented"),
  dayPickerWrap: qs("#dayPickerWrap"),
  monthPickerWrap: qs("#monthPickerWrap"),
  yearPickerWrap: qs("#yearPickerWrap"),
  dayPicker: qs("#dayPicker"),
  monthMonthSelect: qs("#monthMonthSelect"),
  monthYearSelect: qs("#monthYearSelect"),
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

// -------- period state (replaces the old native <select>/<input type=month>)
let currentPeriod = "day";
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" })
);

function fillMonthMonthSelect() {
  els.monthMonthSelect.innerHTML = MONTH_NAMES.map(
    (name, i) => `<option value="${i + 1}">${name}</option>`
  ).join("");
}

// -------- picker helpers
function getYearsFromCases(allCases) {
  const years = new Set();
  const nowY = new Date().getFullYear();
  years.add(nowY);
  for (const c of allCases) {
    const t = caseTime(c);
    if (t) years.add(new Date(t).getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

function fillYearPicker(allCases) {
  const sorted = getYearsFromCases(allCases);
  const yearOptions = sorted.map((y) => `<option value="${y}">${y}</option>`).join("");

  const prevYear = els.yearPicker.value;
  els.yearPicker.innerHTML = yearOptions;
  if (prevYear && sorted.includes(Number(prevYear))) els.yearPicker.value = prevYear;

  const prevMonthYear = els.monthYearSelect.value;
  els.monthYearSelect.innerHTML = yearOptions;
  if (prevMonthYear && sorted.includes(Number(prevMonthYear))) els.monthYearSelect.value = prevMonthYear;
}

function setPickerVisibility(period) {
  els.dayPickerWrap.style.display = period === "day" ? "" : "none";
  els.monthPickerWrap.style.display = period === "month" ? "" : "none";
  els.yearPickerWrap.style.display = period === "year" ? "" : "none";

  els.periodSegmented.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });
}

function getRange(period) {
  const now = new Date();

  if (period === "day") {
    const d = els.dayPicker.value ? new Date(els.dayPicker.value + "T00:00:00") : now;
    return { fromTs: startOfDay(d), toTs: endOfDay(d), label: d.toLocaleDateString() };
  }
  if (period === "month") {
    const y = Number(els.monthYearSelect.value || now.getFullYear());
    const mIndex = Number(els.monthMonthSelect.value || now.getMonth() + 1) - 1;
    const fromTs = startOfMonth(y, mIndex);
    const toTs = endOfMonth(y, mIndex);
    const label = new Date(y, mIndex, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
    return { fromTs, toTs, label };
  }
  const y = Number(els.yearPicker.value || now.getFullYear());
  return { fromTs: startOfYear(y), toTs: endOfYear(y), label: String(y) };
}

// -------- Chart.js helpers
// Zelfde kleuren als de vernieuwde Cases-pagina: oranje voor outbound/brand,
// blauw voor inbound. Canvas kent geen CSS var(), dus hier letterlijk.
const CHART_ORANGE = "#f97316";
const CHART_BLUE = "#2563eb";
const CHART_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function hexWithAlpha(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "rgba(2,6,23,0.55)",
          font: { size: 11, family: CHART_FONT },
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(2,6,23,0.06)" },
        ticks: {
          precision: 0,
          color: "rgba(2,6,23,0.55)",
          font: { size: 11, family: CHART_FONT },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleFont: { family: CHART_FONT, weight: "600" },
        bodyFont: { family: CHART_FONT },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} case${ctx.parsed.y === 1 ? "" : "s"}`,
        },
      },
    },
  };
}

function renderBarChart(canvas, labels, values, color) {
  if (!canvas) return;
  destroyChart(canvas.id);
  chartInstances[canvas.id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: color,
          hoverBackgroundColor: color,
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    },
    options: baseChartOptions(),
  });
}

function renderLineChart(canvas, labels, values, color) {
  if (!canvas) return;
  destroyChart(canvas.id);
  chartInstances[canvas.id] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: color,
          backgroundColor: hexWithAlpha(color, "26"),
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: "#fff",
        },
      ],
    },
    options: baseChartOptions(),
  });
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

  const period = currentPeriod;
  setPickerVisibility(period);

  if (period === "day" && !els.dayPicker.value) els.dayPicker.value = toDateInputValue(new Date());
  if (period === "month" && !els.monthYearSelect.value) {
    els.monthMonthSelect.value = String(new Date().getMonth() + 1);
    els.monthYearSelect.value = String(new Date().getFullYear());
  }
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
  // "Customers called" telt over Inbound + Outbound samen — of je nu een
  // outbound of inbound case aanvinkt als "Customer contacted", het moet
  // hier altijd meetellen. De outbound call rate hieronder blijft wel
  // specifiek outbound, want dat is een outbound-metric.
  const allCalled = items.filter((c) => c.customerCalled === true);

  els.rangeLabel.textContent = `Showing: ${period.toUpperCase()} — ${label}`;

  els.totalCases.textContent = String(total);
  els.totalSub.textContent = `total in ${period}`;

  els.inboundCases.textContent = String(inbound.length);
  els.inboundSub.textContent = total ? `${pct(inbound.length, total)}% of total` : "—";

  els.outboundCases.textContent = String(outbound.length);
  els.outboundSub.textContent = total ? `${pct(outbound.length, total)}% of total` : "—";

  els.calledCustomers.textContent = String(allCalled.length);
  els.calledSub.textContent = total ? `${pct(allCalled.length, total)}% of total` : "—";

  const rate = pct(outboundCalled.length, outbound.length);
  els.callRateLabel.textContent = `${rate}%`;
  els.callRateBar.style.width = `${rate}%`;
  els.callRateSub.textContent = `${outboundCalled.length} / ${outbound.length} outbound`;

  // Charts — blauw zodra je specifiek naar Inbound filtert, anders oranje
  // (zelfde kleurtaal als de Cases-pagina).
  const chartColor = flow === "inbound" ? CHART_BLUE : CHART_ORANGE;

  const hourBins = groupByHour(filteredAll, fromTs, toTs);
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  renderLineChart(els.chartHour, hourLabels, hourBins, chartColor);

  const day = groupLastNDays(filteredAll, toTs, 14);
  renderBarChart(els.chartDay, day.labels, day.values, chartColor);

  const week = groupLastNWeeks(filteredAll, toTs, 8);
  renderBarChart(els.chartWeek, week.labels, week.values, chartColor);

  const month = groupLastNMonths(filteredAll, toTs, 12);
  renderBarChart(els.chartMonth, month.labels, month.values, chartColor);
}

function setToday() {
  currentPeriod = "day";
  setPickerVisibility("day");
  els.dayPicker.value = toDateInputValue(new Date());
  render();
}

// events
fillMonthMonthSelect();

els.periodSegmented.addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-btn");
  if (!btn) return;
  currentPeriod = btn.dataset.period;
  setPickerVisibility(currentPeriod);
  render();
});

els.dayPicker.addEventListener("change", render);
els.monthMonthSelect.addEventListener("change", render);
els.monthYearSelect.addEventListener("change", render);
els.yearPicker.addEventListener("change", render);
els.flowFilter?.addEventListener("change", render);
els.btnToday.addEventListener("click", setToday);

// boot
setToday();