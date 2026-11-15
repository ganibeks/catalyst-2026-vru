# KMG adsorption / PSA SURROGATE for DWSIM Custom Unit Operation (IronPython).
# Paste EVERYTHING into the Custom UO Script Editor (not Script Manager).
# Connections: ims1 = compressed feed gas, oms1 = unadsorbed gas,
#              oms2 = regenerated/desorbed gas (cycle-averaged).
# Uses only Python 2.7-compatible syntax. No third-party packages.
#
# SCIENTIFIC LIMITATION:
# Illustrative competitive Langmuir working-capacity calculation.
# qmax and b coefficients BELOW ARE PLACEHOLDERS, NOT MEASURED KMG/ADSORBENT DATA.
# The low-pressure desorbate is approximated using feed gas composition.
# Neither real breakthrough, heat of adsorption, valve cycling, regeneration
# energy nor full pressure swing dynamics is calculated. Results MUST NOT
# be reported as measured/validated methane capture efficiency.
#
# Example units:
#   qmax[i] : mol adsorbate / kg adsorbent
#   b[i]    : 1 / bar
#   total gas molar flow : mol/s
#   bed adsorbent mass : kg
#   cycle time : s
#   pressures : Pa (DWSIM) or bar as converted in this model.

# ------------ Change these only after the first test ------------
BED_MASS_KG = 50.0          # mass of active adsorbent in one equivalent bed
CYCLE_TIME_S = 600.0       # full adsorption/regeneration cycle, seconds
CONTACT_FACTOR = 0.75      # assumed fraction of equilibrium working capacity used
DESORB_PRESSURE_PA = 101325.0   # hypothetical PSA regeneration pressure
PRODUCT_DP_PA = 5000.0     # pressure loss on product-gas side

# PLACEHOLDER parameters (must be fitted to your selected actual adsorbent!)
# See documentation for competitive Langmuir model assumptions.
QMAX = {
    'Methane': 1.5,
    'Ethane': 2.3,
    'Propane': 3.0,
    'N-butane': 3.5,
    'Nitrogen': 0.6,
    # Temporary bypass for leftover illustrative n-dodecane in old wet-feed flowsheet.
    # A real activated-carbon bed can strongly adsorb heavy hydrocarbons.
    # Do NOT use this zero-capacity assumption for engineering predictions.
    'N-dodecane': 0.0
}
B_BAR_INV = {
    'Methane': 0.15,
    'Ethane': 0.40,
    'Propane': 0.90,
    'N-butane': 1.60,
    'Nitrogen': 0.025,
    'N-dodecane': 0.0
}

# ------------ Read the connected DWSIM input stream ------------
if BED_MASS_KG <= 0.0 or CYCLE_TIME_S <= 0.0:
    raise Exception('BED_MASS_KG and CYCLE_TIME_S must be positive.')
if CONTACT_FACTOR < 0.0 or CONTACT_FACTOR > 1.0:
    raise Exception('CONTACT_FACTOR must be between 0 and 1.')

names = list(ims1.GetCompoundNames())
for name in names:
    if name not in QMAX or name not in B_BAR_INV:
        raise Exception('Add adsorption parameters for compound: ' + name)

T_K = float(ims1.GetTemperature())
P_IN_PA = float(ims1.GetPressure())
P_ADS_BAR = P_IN_PA / 100000.0
P_DES_BAR = DESORB_PRESSURE_PA / 100000.0

if P_IN_PA <= DESORB_PRESSURE_PA:
    raise Exception('Feed pressure must exceed desorption pressure.')
if P_IN_PA <= PRODUCT_DP_PA:
    raise Exception('Product pressure drop is too large.')

feed_kg_s = float(ims1.GetMassFlow())
feed_mol_s = float(ims1.Phases[0].Properties.molarflow)
if feed_kg_s <= 0.0 or feed_mol_s <= 0.0:
    raise Exception('Feed flow must be positive and calculated first.')

y = {}
w = {}
for name in names:
    y[name] = float(ims1.Phases[0].Compounds[name].MoleFraction)
    w[name] = float(ims1.Phases[0].Compounds[name].MassFraction)

# ------------ Simplified competitive Langmuir equilibrium ------------
# Assumes the same normalized gas composition at both pressure limits.
# A real cyclic PSA calculation needs coupled bed + desorption gas balances.
denom_ads = 1.0
nden_des = 1.0
for name in names:
    denom_ads += B_BAR_INV[name] * y[name] * P_ADS_BAR
    nden_des += B_BAR_INV[name] * y[name] * P_DES_BAR

raff_mass = {}
desorb_mass = {}
for name in names:
    p_ads = y[name] * P_ADS_BAR
    p_des = y[name] * P_DES_BAR
    q_ads = QMAX[name] * B_BAR_INV[name] * p_ads / denom_ads
    q_des = QMAX[name] * B_BAR_INV[name] * p_des / nden_des
    usable_q = max(0.0, q_ads - q_des) * CONTACT_FACTOR  # mol/kg
    # Equivalent cycle-averaged desorbed molar flow, mol/s
    capacity_mol_s = BED_MASS_KG * usable_q / CYCLE_TIME_S
    inlet_i_mol_s = max(0.0, feed_mol_s * y[name])
    ads_i_mol_s = min(inlet_i_mol_s, capacity_mol_s)
    frac = ads_i_mol_s / inlet_i_mol_s if inlet_i_mol_s > 0.0 else 0.0
    inlet_i_kg_s = feed_kg_s * w[name]
    desorb_mass[name] = inlet_i_kg_s * frac
    raff_mass[name] = inlet_i_kg_s - desorb_mass[name]

# ------------ Write DWSIM outlet streams ------------
# SetOverallCompoundMassFlow is an official DWSIM stream method, kg/s.
# Assign copies property-package context and other basic settings.
oms1.Assign(ims1)
oms2.Assign(ims1)

for name in names:
    oms1.SetOverallCompoundMassFlow(name, raff_mass[name])
    oms2.SetOverallCompoundMassFlow(name, desorb_mass[name])

# Simplified isothermal outlets; does NOT include adsorption heat.
oms1.SetTemperature(T_K)
oms1.SetPressure(P_IN_PA - PRODUCT_DP_PA)
oms1.SetFlashSpec('PT')
oms1.Calculate()

oms2.SetTemperature(T_K)
oms2.SetPressure(DESORB_PRESSURE_PA)
oms2.SetFlashSpec('PT')
oms2.Calculate()

# ------------ Diagnostic variables shown in UO results ------------
feed_total_kg_h = feed_kg_s * 3600.0
raffinate_kg_h = float(oms1.GetMassFlow()) * 3600.0
desorbate_kg_h = float(oms2.GetMassFlow()) * 3600.0
mass_balance_error_kg_h = feed_total_kg_h - raffinate_kg_h - desorbate_kg_h

if 'Methane' in names:
    inlet_ch4_kg_h = feed_kg_s * w['Methane'] * 3600.0
    desorbed_ch4_kg_h = desorb_mass['Methane'] * 3600.0
    unadsorbed_ch4_kg_h = raff_mass['Methane'] * 3600.0
    methane_adsorbed_pct = 100.0 * desorbed_ch4_kg_h / inlet_ch4_kg_h if inlet_ch4_kg_h > 0 else 0.0
else:
    inlet_ch4_kg_h = 0.0
    desorbed_ch4_kg_h = 0.0
    unadsorbed_ch4_kg_h = 0.0
    methane_adsorbed_pct = 0.0

if abs(mass_balance_error_kg_h) > max(0.0001, 0.0001 * feed_total_kg_h):
    raise Exception('Mass balance failed: ' + str(mass_balance_error_kg_h) + ' kg/h')
