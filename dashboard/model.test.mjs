import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";
import {
  baseline, collectionProfile, defaults, economics, enginePowerBasis, generatedPerDay, hourlyCsv,
  operatingCases, parseCsv, scenarioUrl, stateFromUrl, technologies,
} from "./model.mjs";

const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, String(actual));
const profileFor = overrides => collectionProfile({ ...defaults, ...overrides });

test("default schedules conserve the same daily generation and reproduce collection shares", () => {
  const sequential = profileFor({ schedule: "sequential" });
  const simultaneous = profileFor({ schedule: "simultaneous" });
  assert.equal(Math.round(sequential.collectedShare * 100), 89);
  assert.equal(Math.round(simultaneous.collectedShare * 100), 71);
  for (const profile of [sequential, simultaneous]) {
    assert.equal(profile.hourly.length, 24);
    almost(profile.collected + profile.bypass + profile.overflow, generatedPerDay);
    almost(profile.collectedMethaneKg + profile.uncollectedMethaneKg, 480);
    almost(profile.annualGrossCo2eT, profile.annualUtilizedT * baseline.methaneGwp100);
    assert.equal(hourlyCsv(profile.hourly).trim().split(/\r?\n/).length, 25);
  }
  assert.equal(sequential.hourly[8].generated, 80);
  assert.equal(simultaneous.hourly[8].generated, 160);
  assert.equal(sequential.hourly[8].collected, 70);
  assert.equal(simultaneous.hourly[8].collected, 70);
});

test("capacity, header access and annual consumption constrain distinct stages", () => {
  almost(profileFor({ capacity: 160, access: 90 }).collectedShare, 0.9);
  almost(profileFor({ capacity: 160, access: 100 }).collectedShare, 1);
  almost(profileFor({ access: 0 }).collectedShare, 0);
  almost(profileFor({ offtake: 0 }).annualUtilizedT, 0);
  almost(profileFor({ availability: 0 }).collectedShare, profileFor({}).collectedShare);
});

test("gas-engine economics reports distinct payback with and without credits", () => {
  const cost = { capex: 224500, savings: 88400, runningCost: 31700, horizon: 15 };
  const withCredits = economics({ ...cost, creditPrice: 10, creditVolume: 4670 });
  assert.equal(withCredits.creditRevenue, 46700);
  assert.equal(withCredits.netSavings, 103400);
  assert.equal(withCredits.payback, 224500 / 103400);
  assert.equal(withCredits.creditlessNet, 56700);
  assert.equal(withCredits.creditlessPayback, 224500 / 56700);
  assert.equal(economics(cost).requiredSavings, 31700 + 224500 / 15);
  assert.equal(economics({ ...cost, savings: 31700 }).payback, null);
});

test("fuel balance converts the wet Aspen stream and reconciles the deck's electricity target", () => {
  const fuel = { wetFuelKmolH: 1.5, waterMoleFraction: 0.0202, lowerHeatingValueMjNm3: 38, annualElectricityMWh: 1090 };
  const fullYear = enginePowerBasis({ ...fuel, operatingHours: 8760 });
  almost(fullYear.dryFuelNm3H, 32.9418558);
  almost(fullYear.annualFuelMWh, 3046.02359964);
  almost(fullYear.requiredElectricityShare * fullYear.annualFuelMWh, 1090);
  const shorterYear = enginePowerBasis({ ...fuel, operatingHours: 8000 });
  assert.ok(shorterYear.requiredElectricityShare > fullYear.requiredElectricityShare);
});

test("share links restore scenario settings and reject invalid inputs", () => {
  const base = "https://example.test/catalyst-2026-vru/";
  const state = { ...defaults, capacity: 160, availability: 0, schedule: "simultaneous", operatingCase: "winter", language: "ru" };
  assert.deepEqual(stateFromUrl(scenarioUrl(base, state)), state);
  assert.deepEqual(stateFromUrl(base + "?capacity=999&schedule=constructor&access=-1&case=demo"), defaults);
});

test("published results have one row per technology and case with resolvable evidence", async () => {
  const location = new URL("../data/simulation-results.csv", import.meta.url);
  const rows = parseCsv(await readFile(location, "utf8"), ["shaft_power_kw", "ch4_to_product_pct"]);
  assert.equal(rows.length, technologies.length * operatingCases.length);
  for (const technology of technologies) {
    for (const scenario of operatingCases) {
      const matching = rows.filter(row => row.technology === technology && row.scenario === scenario);
      assert.equal(matching.length, 1);
      await access(new URL("../" + matching[0].source, import.meta.url));
    }
  }
  const estimate = rows.find(row => row.technology === "absorption" && row.scenario === "summer-average");
  assert.equal(estimate.result_basis, "scaled-from-summer-peak");
});
