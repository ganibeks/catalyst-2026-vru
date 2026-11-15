# Team Sunkar — Catalyst 2026 VRU

Engineering case study for a vapor recovery unit (VRU) serving six 5,000 m³ crude-oil tanks. The latest team presentation assumes recovered gas fuels an existing on-site gas engine and displaces grid electricity. The case basis is 20 kg CH₄/h across the tank farm and 175.2 t CH₄/year if that rate represents the full year.

[Open the interactive dashboard](https://ganibeks.github.io/catalyst-2026-vru/) · [Download the dashboard QR code](presentation/dashboard-qr.png)

## Repository contents

| Directory | Contents |
|---|---|
| [models/aspen-hysys/](models/aspen-hysys/) | 11 Aspen HYSYS V12 simulation cases for compression/cooling, absorption, adsorption and compression/membrane |
| [models/dwsim/](models/dwsim/) | DWSIM compression/cooling and adsorption flowsheets |
| [evidence/aspen-hysys/](evidence/aspen-hysys/) | 15 PNGs with process diagrams and simulation output |
| [data/](data/) | Machine-readable results, model inputs, deck economics and the original DWSIM stream export |
| [workbooks/](workbooks/) | Normalized Excel results and a separate scenario workbook for filling, methane balance and economics |
| [scripts/](scripts/) | The IronPython screening script embedded in the DWSIM adsorption model |
| [presentation/](presentation/) | Team Sunkar's presentation export |

Open `.hsc` files in Aspen HYSYS V12 and `.dwxmz` files in DWSIM. The archive's Aspen cases are the source for the results dataset. The two supplied DWSIM files named `Absorption` and `Compression(Cooling)` contained identical compression/cooling flowsheets. One copy is included. The absorption models here are the Aspen cases. The DWSIM adsorption script runs inside the DWSIM Custom Unit Operation with its connected streams and uses placeholder adsorption coefficients.

## Dashboard data

Use [simulation-results.csv](data/simulation-results.csv) as the primary table and join [feed-basis.csv](data/feed-basis.csv) on `scenario`. Each row in `simulation-results.csv` represents one technology and operating condition. The `source` column gives its relative evidence path. Empty fields mean the metric was not tabulated. Columns ending in `_pct` and `_mol_pct` store percentages as numbers on a 0–100 scale.

- `shaft_power_kw` covers the modeled compressor, vacuum compressor and solvent pump where applicable. `cooling_duty_kw_thermal` reports the heat removed. Utility and whole-site electricity demand require a separate accounting boundary.
- `ch4_to_product_pct` uses the methane entering the modeled equipment as its denominator. The reported 99.99% for compression describes methane routed to fuel gas within that process balance. The 97–99% on slide 15 is a site-wide project target that requires field verification.
- The absorption summer-average row scales the summer-peak run. The repository contains separately saved absorption cases for peak and winter. The reported vent flow is the offgas stream. Residual CH₄ in returning oil and condensate must be included when extending the mass balance to a closed regeneration loop.
- Aspen adsorption and membrane results use assumed component splits. The VSA 90% and membrane 95% reflect those inputs. DWSIM adsorption uses a separate illustrative Langmuir model.
- The Aspen evidence shows a feed with CO₂ and a hydrocarbon split that differs from the presentation's assumptions table. The CSVs follow the Aspen evidence. [compression-streams.csv](data/compression-streams.csv) keeps the higher-precision values shown in the three compression screenshots.
- Slide 11 reports 70% adiabatic compressor efficiency for Aspen. Slide 5 lists 75%. The archived DWSIM compression model uses 75% efficiency and a 10 °C cooler outlet, reporting 2.56 kW shaft power and 2.92 kW thermal duty. Aspen Case 2 cools to 45 °C and reports 2.9 kW and 3.1 kW thermal.
- [economics-deck.csv](data/economics-deck.csv) transcribes the latest presentation's gas-engine and methane credit assumptions. [scenario-assumptions.xlsx](workbooks/scenario-assumptions.xlsx) is an earlier fuel-gas scenario with different inputs. Keep the two cost bases and their methane denominators separate. A credit-price scenario does not establish credit eligibility or net verified reductions.
- The deck uses a GWP₁₀₀ of 27.2 to convert methane to gross CO₂-equivalent. [IPCC AR6 WGI Table 7.15](https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/) gives 29.8 for fossil methane. Credit eligibility depends on the applicable methodology and verified project emissions.
- [dwsim-gas-stream.csv](data/raw/dwsim-gas-stream.csv) is the original property export. Its stream tag, direct temperature and direct pressure were not included in the export.

## Dashboard development

The dashboard uses static HTML, CSS and JavaScript modules. GitHub Pages serves the root of `main`. For a local preview, run `python -m http.server 8000` in the repository and open `http://localhost:8000/`. Run `node --test dashboard/model.test.mjs` to verify the calculations and dataset links.

The filling calculator is an illustrative sensitivity case based on the earlier workbook. It assumes 320 Nm³ of dry gas during filling, distributes the remaining volume over the other hours and limits each hour by header access and modeled VRU capacity. With the default 90% header access, the theoretical daily collection ceiling is 90%. Annual utilization applies availability and fuel acceptance after daily collection. The project economics use the presentation's gas-engine case.

The process flow diagram comes from page 17 of the team's presentation. Font licenses are in [dashboard/assets/](dashboard/assets/). The archived tank photograph in that folder is a public-domain [U.S. Department of Energy image](https://commons.wikimedia.org/wiki/File:United_States_Strategic_Petroleum_Reserve_012.jpg).
