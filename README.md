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
- `ch4_to_product_pct` uses the methane that enters the modeled VRU as its denominator. It cannot establish the fraction collected from the entire tank farm. At deck precision the compression model sends approximately all its inlet CH₄ to fuel gas. Neither the 99.99% display figure nor the deck's 97–99% target establishes field capture performance.
- The absorption summer-average row scales the summer-peak run. The repository contains separately saved absorption cases for peak and winter. The reported vent flow is the offgas stream. Residual CH₄ in returning oil and condensate must be included when extending the mass balance to a closed regeneration loop.
- Aspen adsorption and membrane results use assumed component splits. The VSA 90% and membrane 95% reflect those inputs. DWSIM adsorption uses a separate illustrative Langmuir model.
- The Aspen evidence shows a feed with CO₂ and a hydrocarbon split that differs from the presentation's assumptions table. The CSVs follow the Aspen evidence. [compression-streams.csv](data/compression-streams.csv) keeps the higher-precision values shown in the three compression screenshots.
- [economics-deck.csv](data/economics-deck.csv) transcribes the latest presentation's gas-engine and methane credit assumptions. [scenario-assumptions.xlsx](workbooks/scenario-assumptions.xlsx) is an earlier fuel-gas scenario with different inputs. Keep the two cost bases and their methane denominators separate. A credit-price scenario does not establish credit eligibility or net verified reductions.
- [dwsim-gas-stream.csv](data/raw/dwsim-gas-stream.csv) is the original property export. Its stream tag, direct temperature and direct pressure were not included in the export.

## Dashboard development

The dashboard uses static HTML, CSS and JavaScript modules. GitHub Pages serves the root of `main`. For a local preview, run `python -m http.server 8000` in the repository and open `http://localhost:8000/`. Run `node --test dashboard/model.test.mjs` to verify the calculations and dataset links.

The collection model assumes 320 Nm³ of dry gas during filling and distributes the remaining daily volume over the other hours. It limits each hour by header access and VRU capacity. Annual utilization applies availability and fuel acceptance after daily collection. The economic calculator uses the deck's separate cost basis.

The illustrative tank photograph is from the [U.S. Department of Energy](https://commons.wikimedia.org/wiki/File:United_States_Strategic_Petroleum_Reserve_012.jpg) and is in the public domain. The process flow diagram comes from page 17 of the team's presentation. Font licenses are in [dashboard/assets/](dashboard/assets/).
