import {
  baseline, collectionProfile, defaults, economics, generatedPerDay, hourlyCsv,
  parseCsv, scenarioUrl, stateFromUrl, technologies,
} from "./model.mjs";
import { message, russian } from "./copy.mjs";
import { chartHour, drawFlowChart } from "./chart.mjs";

const get = id => document.getElementById(id);
const set = (id, value) => { get(id).textContent = value; };
const translated = [...document.querySelectorAll("[data-i]")].map(node => ({
  node, original: node.textContent, key: node.dataset.i,
}));
const collectionInputs = ["capacity", "access", "availability", "offtake"];
const costInputs = ["capex", "grid-savings", "running-cost", "credit-price", "credit-volume"];
const state = stateFromUrl(location.href);
const canvas = get("flow-chart");
let profile;
let selectedHour = baseline.fillingStartHour;
let simulationData;
let costBasis;
let simulationUnavailable = false;
let economicsUnavailable = false;
let currentEvidence;
let includeCredits = true;

const t = key => message(state.language, key);
const currency = value => (value < 0 ? "−$" : "$") + number(Math.abs(value));

function number(value, digits = 0) {
  return value.toLocaleString(state.language === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pressed(selector, key, value) {
  for (const button of document.querySelectorAll(selector)) {
    button.setAttribute("aria-pressed", String(button.dataset[key] === String(value)));
  }
}

function applyCopy() {
  document.documentElement.lang = state.language;
  for (const { node, key, original } of translated) {
    node.textContent = state.language === "ru" ? russian[key] ?? original : original;
  }
  set("language", state.language === "ru" ? "EN" : "RU");
  get("language").setAttribute("aria-label", state.language === "ru" ? "Switch to English" : "Переключить на русский");
  canvas.setAttribute("aria-label", t("chartLabel"));
  if (currentEvidence) set("evidence-title", t(currentEvidence));
}

const time = hour => String(hour).padStart(2, "0") + ":00";
const hourRange = hour => time(hour) + "–" + time(hour + 1);
const percent = share => number(share * 100, 1) + "%";

function renderGraph() {
  drawFlowChart(canvas, profile.hourly, state.capacity, selectedHour, number);
  const row = profile.hourly[selectedHour];
  set("chart-hour", hourRange(row.hour));
  set("chart-gross", t("generated") + " " + number(row.generated, 1));
  set("chart-collected", t("collected") + " " + number(row.collected, 1));
  set("chart-uncaptured", t("uncollected") + " " + number(row.bypass + row.overflow, 1) + " " + t("rateUnit"));
}

function renderHourly() {
  const table = get("hourly-data");
  const toggle = get("hourly-toggle");
  toggle.setAttribute("aria-expanded", String(!table.hidden));
  if (table.hidden) {
    set("hourly-toggle", state.language === "ru" ? russian.hourlyTable : "View hourly data");
    return;
  }
  set("hourly-toggle", t("hideHourly"));
  const rows = profile.hourly.map(row => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = hourRange(row.hour);
    tr.append(th);
    for (const amount of [row.generated, row.collected, row.bypass, row.overflow]) {
      const td = document.createElement("td");
      td.textContent = number(amount, 1);
      tr.append(td);
    }
    return tr;
  });
  get("hourly-rows").replaceChildren(...rows);
}

function renderCollection() {
  profile = collectionProfile(state);
  const sequential = collectionProfile({ ...state, schedule: "sequential" });
  const simultaneous = collectionProfile({ ...state, schedule: "simultaneous" });
  const gain = Math.max(0, (sequential.collectedShare - simultaneous.collectedShare) * 100);
  pressed("[data-schedule]", "schedule", state.schedule);
  pressed("[data-capacity]", "capacity", state.capacity);
  for (const key of collectionInputs) {
    get(key).value = state[key];
    set(key + "-value", number(state[key]) + (key === "capacity" ? "" : "%"));
  }
  set("chart-mode", t(state.schedule));
  set("captured-share", percent(profile.collectedShare));
  set("captured-detail", number(profile.collectedMethaneKg, 1) + " " + t("methaneDay") +
    " · " + number(profile.collected) + " / " + number(generatedPerDay) + " " + t("volumeUnit"));
  set("uncaptured-day", number(profile.uncollectedMethaneKg, 1) + " " + t("methaneDay"));
  set("uncaptured-detail", number(profile.overflow, 1) + " " + t("volumeUnit") + " " + t("overflow") +
    " · " + number(profile.bypass, 1) + " " + t("volumeUnit") + " " + t("bypass"));
  set("annual-utilized", number(profile.annualUtilizedT, 1) + " " + t("methaneYear"));
  set("annual-co2", number(profile.annualGrossCo2eT) + " " + t("co2Year"));
  set("sequential-share", percent(sequential.collectedShare));
  set("simultaneous-share", percent(simultaneous.collectedShare));
  set("schedule-impact", "+" + number(gain, 1) + " " + t("pointGain"));
  renderGraph();
  renderHourly();
}

function selectHour(hour) {
  if (selectedHour === hour) return;
  selectedHour = hour;
  renderGraph();
}

function downloadProfile() {
  const url = URL.createObjectURL(new Blob([hourlyCsv(profile.hourly)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vru-" + state.schedule + "-" + state.capacity + "-nm3h.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  set("announce", t("downloadReady"));
}

function showEvidence(title, src, model) {
  currentEvidence = title;
  set("evidence-title", t(title));
  const image = get("evidence-image");
  image.src = src;
  image.alt = t(title);
  get("evidence-source").href = src;
  const modelLink = get("evidence-model");
  modelLink.hidden = model === null;
  if (model) modelLink.href = model;
  get("evidence-dialog").showModal();
}

function renderTechnologyCard(row) {
  const card = document.createElement("article");
  card.className = "tech-card" + (row.technology === "compression-cooling" ? " selected" : "");
  const title = document.createElement("h3");
  title.textContent = t(row.technology);
  const basis = document.createElement("p");
  basis.className = "case-basis";
  basis.textContent = t(row.result_basis);
  const dl = document.createElement("dl");

  const metrics = [
    ["shaft", row.shaft_power_kw, " kW", 1],
    ["cooling", row.cooling_duty_kw_thermal, " " + t("thermal"), 1],
    ["methaneProduct", row.ch4_to_product_pct, "%", 0],
    ["vent", row.ch4_to_vent_kg_h, " kg/h", 1],
    [row.technology === "absorption" ? "leanOil" : "productMole",
      row.technology === "absorption" ? row.lean_oil_t_h : row.ch4_in_product_mol_pct,
      row.technology === "absorption" ? " " + t("tonneHour") : "%", 1],
  ];
  for (const [key, value, unit, digits] of metrics) {
    const metric = document.createElement("div");
    const label = document.createElement("dt");
    label.textContent = t(key);
    const display = document.createElement("dd");
    if (key === "methaneProduct") display.className = "emphasis";
    display.textContent = value === null ? "—" :
      (key === "methaneProduct" && value > 99.9 ? "≈" : "") + number(value, digits) + unit;
    metric.append(label, display);
    dl.append(metric);
  }

  const open = document.createElement("button");
  open.type = "button";
  open.className = "link-button";
  open.textContent = t("evidence");
  open.addEventListener("click", () => {
    const model = row.result_basis === "scaled-from-summer-peak" ? null :
      "./models/aspen-hysys/" + row.technology + "/" + row.scenario + ".hsc";
    showEvidence(row.technology, "./" + row.source, model);
  });
  card.append(title, basis, dl, open);
  return card;
}

function renderTechnology() {
  pressed("[data-case]", "case", state.operatingCase);
  if (!simulationData) {
    if (simulationUnavailable) set("data-status", t("dataError"));
    return;
  }
  const { results, feed } = simulationData;
  const selectedFeed = feed.find(row => row.scenario === state.operatingCase);
  set("case-feed", t("feed") + " " + number(selectedFeed.feed_temp_c) + " °C · " +
    number(selectedFeed.feed_pressure_kpa_abs, 1) + " " + t("pressure") + " · " +
    number(selectedFeed.feed_kmol_h, 3) + " " + t("kmolHour") + " · " +
    number(selectedFeed.water_mol_pct, 2) + " " + t("moisture"));
  const filtered = technologies.map(technology => results.find(
    row => row.technology === technology && row.scenario === state.operatingCase,
  ));
  get("tech-grid").replaceChildren(...filtered.map(renderTechnologyCard));
  get("data-status").hidden = true;
}

function renderEconomics() {
  if (!costBasis) {
    if (economicsUnavailable) set("econ-status", t("econError"));
    return;
  }
  const capex = get("capex").valueAsNumber;
  const savings = get("grid-savings").valueAsNumber;
  const runningCost = get("running-cost").valueAsNumber;
  const creditPrice = includeCredits ? get("credit-price").valueAsNumber : 0;
  const creditVolume = includeCredits ? get("credit-volume").valueAsNumber : 0;
  pressed("[data-credits]", "credits", includeCredits);
  get("credit-inputs").hidden = !includeCredits;
  set("capex-value", currency(capex));
  set("capex-low", currency(costBasis.minCapex));
  set("capex-high", currency(costBasis.maxCapex));
  const inputs = [[savings, 500000], [runningCost, 500000], [creditPrice, 200], [creditVolume, 4765]];
  const valid = inputs.every(([value, maximum]) => Number.isFinite(value) && value >= 0 && value <= maximum);
  get("econ-status").hidden = valid;
  if (!valid) {
    set("econ-status", t("invalidCost"));
    for (const id of ["net-savings", "payback-value", "required-savings", "creditless-net"]) set(id, "—");
    for (const id of ["payback-note", "payback-range", "credit-revenue", "creditless-payback"]) set(id, "");
    return;
  }
  const { creditRevenue, netSavings, payback, creditlessNet, creditlessPayback, requiredSavings } =
    economics({ capex, savings, runningCost, horizon: costBasis.horizon, creditPrice, creditVolume });
  const paybackText = years => years === null ? t("noPayback") : number(years, 1) + " " + t("years");
  const rangeText = net => net <= 0 ? t("noPayback") :
    number(costBasis.minCapex / net, 1) + "–" + number(costBasis.maxCapex / net, 1) + " " + t("years");
  set("net-savings", currency(netSavings) + t("perYear"));
  set("credit-revenue", t("creditRevenue") + " " + currency(creditRevenue) + t("perYear"));
  set("required-savings", currency(requiredSavings) + t("perYear"));
  set("payback-value", paybackText(payback));
  set("payback-range", t("acrossCapexRange") + " · " + rangeText(netSavings));
  set("creditless-net", currency(creditlessNet) + t("perYear"));
  set("creditless-payback", t("atSelectedCapex") + " · " + paybackText(creditlessPayback) +
    " / " + t("acrossCapexRange") + " · " + rangeText(creditlessNet));
  set("payback-note", t(payback === null ? "noPaybackReason" :
    payback > costBasis.horizon ? "beyondHorizon" : "withinHorizon"));
}

async function getCsv(name, numericFields) {
  const response = await fetch("./data/" + name + ".csv");
  if (!response.ok) throw new Error("Could not load " + name);
  return parseCsv(await response.text(), numericFields);
}

async function loadSimulation() {
  try {
    const [results, feed] = await Promise.all([
      getCsv("simulation-results", ["shaft_power_kw", "cooling_duty_kw_thermal", "ch4_to_product_pct",
        "ch4_to_vent_kg_h", "lean_oil_t_h", "ch4_in_product_mol_pct"]),
      getCsv("feed-basis", ["feed_temp_c", "feed_pressure_kpa_abs", "feed_kmol_h", "water_mol_pct"]),
    ]);
    for (const caseName of ["summer-average", "summer-peak", "winter"]) {
      if (!feed.some(row => row.scenario === caseName) ||
        !technologies.every(technology => results.some(row => row.scenario === caseName && row.technology === technology))) {
        throw new Error("A simulation case is missing");
      }
    }
    if (results.some(row => !/^evidence\/aspen-hysys\/[a-z-]+\/[a-z-]+\.png$/.test(row.source))) {
      throw new Error("Invalid simulation evidence path");
    }
    simulationData = { results, feed };
  } catch (error) {
    simulationUnavailable = true;
    console.warn(error.message);
  }
  renderTechnology();
}

async function loadEconomics() {
  try {
    const data = await getCsv("economics-deck", ["value_low", "value_high"]);
    const metrics = Object.fromEntries(data.map(row => [row.metric, row]));
    const { value_low: minCapex, value_high: maxCapex } = metrics.installed_capital_ex_vat;
    const horizon = metrics.analysis_horizon.value_low;
    const savings = metrics.annual_grid_power_savings.value_low;
    const running = metrics.annual_running_costs.value_low;
    const creditPrice = metrics.assumed_credit_price.value_low;
    const creditVolume = metrics.assumed_credit_volume.value_low;
    if (![minCapex, maxCapex, horizon, savings, running, creditPrice, creditVolume].every(Number.isFinite) ||
      horizon <= 0 || minCapex <= 0 || maxCapex < minCapex) throw new Error("Invalid cost basis");
    costBasis = { minCapex, maxCapex, horizon };
    const slider = get("capex");
    slider.min = minCapex;
    slider.max = maxCapex;
    slider.value = minCapex;
    get("grid-savings").value = savings;
    get("running-cost").value = running;
    get("credit-price").value = creditPrice;
    get("credit-volume").value = creditVolume;
    for (const id of costInputs) get(id).disabled = false;
  } catch (error) {
    economicsUnavailable = true;
    console.warn(error.message);
  }
  renderEconomics();
}

for (const key of collectionInputs) {
  get(key).addEventListener("input", event => {
    state[key] = event.target.valueAsNumber;
    renderCollection();
  });
}
for (const button of document.querySelectorAll("[data-schedule]")) {
  button.addEventListener("click", () => {
    state.schedule = button.dataset.schedule;
    selectedHour = baseline.fillingStartHour;
    renderCollection();
  });
}
for (const button of document.querySelectorAll("[data-capacity]")) {
  button.addEventListener("click", () => {
    state.capacity = Number(button.dataset.capacity);
    renderCollection();
  });
}
for (const button of document.querySelectorAll("[data-case]")) {
  button.addEventListener("click", () => {
    state.operatingCase = button.dataset.case;
    renderTechnology();
  });
}
for (const id of costInputs) {
  get(id).addEventListener("input", renderEconomics);
}
for (const button of document.querySelectorAll("[data-credits]")) {
  button.addEventListener("click", () => {
    includeCredits = button.dataset.credits === "true";
    renderEconomics();
  });
}

get("language").addEventListener("click", () => {
  state.language = state.language === "en" ? "ru" : "en";
  applyCopy();
  renderCollection();
  renderTechnology();
  renderEconomics();
});
get("reset").addEventListener("click", () => {
  state.schedule = defaults.schedule;
  for (const key of collectionInputs) state[key] = defaults[key];
  selectedHour = baseline.fillingStartHour;
  renderCollection();
});
get("hourly-toggle").addEventListener("click", () => {
  get("hourly-data").hidden = !get("hourly-data").hidden;
  renderHourly();
});
get("download-profile").addEventListener("click", downloadProfile);
get("open-pfd").addEventListener("click", () => showEvidence("pfd", "./dashboard/assets/team-pfd.webp", null));
get("share").addEventListener("click", async () => {
  const url = scenarioUrl(location.href, state);
  try {
    await navigator.clipboard.writeText(url);
    set("announce", t("copied"));
    set("share", t("copied"));
    window.setTimeout(() => {
      set("share", state.language === "ru" ? russian.share : "Copy scenario link");
    }, 1600);
  } catch {
    get("share-url").value = url;
    get("share-dialog").showModal();
    get("share-url").select();
  }
});

canvas.addEventListener("pointermove", event => {
  if (event.pointerType === "mouse") selectHour(chartHour(canvas, event.clientX));
});
canvas.addEventListener("click", event => selectHour(chartHour(canvas, event.clientX)));
canvas.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  if (event.key === "Home") selectHour(0);
  else if (event.key === "End") selectHour(23);
  else selectHour(Math.max(0, Math.min(23, selectedHour + (event.key === "ArrowLeft" ? -1 : 1))));
  set("announce", get("chart-readout").textContent);
});

applyCopy();
renderCollection();
renderTechnology();
new ResizeObserver(renderGraph).observe(canvas);
document.fonts.ready.then(renderGraph);
loadSimulation();
loadEconomics();
