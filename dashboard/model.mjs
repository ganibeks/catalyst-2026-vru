export const baseline = Object.freeze({
  methaneKgPerHour: 20,
  dryMethaneMoleFraction: 0.85,
  methaneMolarMassKgPerKmol: 16.043,
  normalMolarVolumeM3PerKmol: 22.414,
  hoursPerYear: 8760,
  methaneGwp100: 27.2,
  dailyFillingVaporNm3: 320,
  fillingStartHour: 8,
});

export const defaults = Object.freeze({
  schedule: "sequential",
  capacity: 70,
  access: 90,
  availability: 95,
  offtake: 85,
  operatingCase: "summer-average",
  language: "en",
});

export const schedules = Object.freeze({ sequential: 4, simultaneous: 2 });
export const operatingCases = ["summer-average", "summer-peak", "winter"];
export const technologies = ["compression-cooling", "absorption", "adsorption", "hybrid-membrane"];

const hoursPerDay = 24;
const methaneKgPerNormalM3 = baseline.dryMethaneMoleFraction *
  baseline.methaneMolarMassKgPerKmol / baseline.normalMolarVolumeM3PerKmol;
export const generatedPerDay = baseline.methaneKgPerHour * hoursPerDay / methaneKgPerNormalM3;

export function collectionProfile({ schedule, capacity, access, availability, offtake }) {
  const fillHours = schedules[schedule];
  if (!Number.isInteger(fillHours)) throw new RangeError("Unknown filling schedule");

  const fillEnd = baseline.fillingStartHour + fillHours;
  const fillRate = baseline.dailyFillingVaporNm3 / fillHours;
  const normalRate = (generatedPerDay - baseline.dailyFillingVaporNm3) / (hoursPerDay - fillHours);
  const hourly = Array.from({ length: hoursPerDay }, (_, hour) => {
    const generated = hour >= baseline.fillingStartHour && hour < fillEnd ? fillRate : normalRate;
    const atHeader = generated * access / 100;
    const collected = Math.min(atHeader, capacity);
    return { hour, generated, atHeader, collected, bypass: generated - atHeader, overflow: atHeader - collected };
  });
  const collected = hourly.reduce((sum, row) => sum + row.collected, 0);
  const bypass = hourly.reduce((sum, row) => sum + row.bypass, 0);
  const overflow = hourly.reduce((sum, row) => sum + row.overflow, 0);
  const collectedShare = collected / generatedPerDay;
  const annualUtilizedT = baseline.methaneKgPerHour * baseline.hoursPerYear / 1000 *
    collectedShare * availability / 100 * offtake / 100;

  return {
    hourly,
    collected,
    bypass,
    overflow,
    collectedShare,
    collectedMethaneKg: collected * methaneKgPerNormalM3,
    uncollectedMethaneKg: (bypass + overflow) * methaneKgPerNormalM3,
    annualUtilizedT,
    annualGrossCo2eT: annualUtilizedT * baseline.methaneGwp100,
  };
}

export function economics({ capex, savings, runningCost, horizon, creditPrice = 0, creditVolume = 0 }) {
  const creditRevenue = creditPrice * creditVolume;
  const creditlessNet = savings - runningCost;
  const netSavings = creditlessNet + creditRevenue;
  const payback = netSavings > 0 ? capex / netSavings : null;
  const creditlessPayback = creditlessNet > 0 ? capex / creditlessNet : null;
  const requiredSavings = Math.max(0, runningCost + capex / horizon - creditRevenue);
  return { creditRevenue, netSavings, payback, creditlessNet, creditlessPayback, requiredSavings };
}

function urlInteger(params, key, fallback, min, max) {
  const value = params.get(key);
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return number >= min && number <= max ? number : fallback;
}

export function stateFromUrl(url) {
  const params = new URL(url).searchParams;
  const schedule = params.get("schedule");
  const operatingCase = params.get("case");
  return {
    schedule: Object.hasOwn(schedules, schedule) ? schedule : defaults.schedule,
    capacity: urlInteger(params, "capacity", defaults.capacity, 30, 200),
    access: urlInteger(params, "access", defaults.access, 0, 100),
    availability: urlInteger(params, "availability", defaults.availability, 0, 100),
    offtake: urlInteger(params, "offtake", defaults.offtake, 0, 100),
    operatingCase: operatingCases.includes(operatingCase) ? operatingCase : defaults.operatingCase,
    language: params.get("lang") === "ru" ? "ru" : "en",
  };
}

export function scenarioUrl(href, state) {
  const url = new URL(href);
  url.search = "";
  for (const key of ["schedule", "capacity", "access", "availability", "offtake"]) {
    url.searchParams.set(key, state[key]);
  }
  url.searchParams.set("case", state.operatingCase);
  if (state.language !== "en") url.searchParams.set("lang", state.language);
  url.hash = "capture";
  return url.href;
}

export function parseCsv(text, numericFields) {
  const [header, ...lines] = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const keys = header.split(",");
  if (keys.length < 2 || text.includes('"') || numericFields.some(key => !keys.includes(key))) {
    throw new Error("Unexpected dashboard CSV schema");
  }
  return lines.map(line => {
    const fields = line.split(",");
    if (fields.length !== keys.length) throw new Error("Unexpected dashboard CSV row");
    return Object.fromEntries(keys.map((key, index) => {
      const field = fields[index];
      if (field === "") return [key, null];
      if (!numericFields.includes(key)) return [key, field];
      const value = Number(field);
      if (!Number.isFinite(value)) throw new Error("Invalid numeric dashboard value");
      return [key, value];
    }));
  });
}

export function hourlyCsv(hourly) {
  const headers = "hour,generated_nm3_h,at_header_nm3_h,collected_nm3_h,bypass_nm3_h,overflow_nm3_h";
  return [headers, ...hourly.map(row => [
    row.hour,
    row.generated.toFixed(3),
    row.atHeader.toFixed(3),
    row.collected.toFixed(3),
    row.bypass.toFixed(3),
    row.overflow.toFixed(3),
  ].join(","))].join("\r\n") + "\r\n";
}
