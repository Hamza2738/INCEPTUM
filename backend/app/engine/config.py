"""Every tunable constant of the engine lives here.

Values tagged ASSUMPTION are design hypotheses, not measurements. They must be checked against
the cited publication or a local source before they are shown to a judge or a farmer.
The API returns the list of assumptions used with every result (see ASSUMPTION_NOTES).
"""

# ---- Water balance (FAO-56) -------------------------------------------------------------
EFF_RAIN_FACTOR = 0.8          # ASSUMPTION: share of rain that is effective when rain > threshold
EFF_RAIN_MIN_MM = 2.0          # ASSUMPTION
IRRIGATION_EFFICIENCY = {      # ASSUMPTION: typical application efficiencies
    "drip": 0.90, "sprinkler": 0.75, "pivot": 0.80, "surface": 0.60, "paddy": 0.50,
}
TRIGGER_FRACTION = 0.95        # irrigate when depletion reaches 95% of RAW
INITIAL_DEPLETION_OF_RAW = 0.4  # ASSUMPTION: depletion 14 days ago, as a fraction of RAW

# ---- Salinity (FAO Paper 29, Ayers and Westcot; Maas-Hoffman) ------------------------------
ECE_PER_ECW = 1.5              # ECe is about 1.5 x ECw for a leaching fraction of 15-20%
LEACH_CAP = 0.40               # above this leaching requirement the plan is flagged infeasible
YIELD_OK, YIELD_RISKY = 90, 50  # relative yield thresholds for OK / RISKY / NOT_SUITABLE

# ---- Nitrogen and soil salt forecast ----------------------------------------------------------
N_PPM_TO_KG_HA = 3.9           # 0-30 cm layer, bulk density 1.3 g/cm3
NUE = 0.6                      # ASSUMPTION: nitrogen use efficiency of the applied dose
OM_MINERAL_KG_PER_PCT = 10.0   # ASSUMPTION: kg N/ha per season released per 1% organic matter
N_AVAILABLE_FRACTION = 0.3     # ASSUMPTION: share of the mineral N in the top 30 cm that the crop can still use (the rest is leachable)
N_LEACH_L0_MM = 150.0          # ASSUMPTION: drainage depth scale for nitrate leaching
N_VOL_LOSS = 0.10              # ASSUMPTION: volatilisation loss of applied N
SALT_ECE_PER_KG_N = 0.0015     # ASSUMPTION: rise of ECe (dS/m) per kg N applied, for a 0.6 m root zone
N_COVER_DAYS = 14              # fertilise so that the pool covers the next 14 days of uptake
N_SPLIT_CAP = 0.35             # a single application never exceeds 35% of the seasonal demand
N_MIN_GAP_DAYS = 10
HEAVY_RAIN_MM = 15.0           # postpone fertiliser if this much rain is forecast within 48 h
SIM_HORIZON_PERENNIAL = 240   # days simulated for perennial crops
SIM_HORIZON_MIN = 30
N_EMBEDDED_KWH_PER_KG = 15.3   # ASSUMPTION: about 55 MJ of energy to make 1 kg of nitrogen fertiliser

# ---- Energy ---------------------------------------------------------------------------------
PUMP_FRICTION_M = 10.0         # ASSUMPTION: friction and delivery head added to the well depth
RO_CURVE = [(0.5, 0.30), (1.0, 0.40), (2.0, 0.60), (3.0, 0.80), (5.0, 1.10), (8.0, 1.60), (12.0, 2.20)]
#            ASSUMPTION: (feed EC dS/m, kWh per m3 of permeate) for brackish-water RO. Verify with a supplier datasheet.
PERMEATE_EC = 0.2              # ASSUMPTION
RO_RECOVERY = 0.75             # ASSUMPTION
TARGET_LR = 0.15               # blend raw and RO water so that the leaching requirement is about 15%
PV_PR = 0.78                   # performance ratio (doc: 0.75-0.85)
PV_TILT_GAIN = 1.10            # ASSUMPTION: tilted plane vs horizontal radiation
PV_SIZING = 1.2                # PV peak power = 1.2 x peak pumping power
IRRIGATION_HOURS = 8           # hours per day available to run pumps in the sizing step
MIDDAY = list(range(11, 16))
FORBIDDEN_HOURS_BY_TYPE = {"drip": [], "sprinkler": MIDDAY, "pivot": MIDDAY, "surface": MIDDAY, "paddy": []}
#            ASSUMPTION: no irrigation 11:00-15:59 for systems that lose water to evaporation (not for drip or paddy)
BASELINE_HOURS = list(range(8, 18))     # ASSUMPTION: the farmer irrigates 08:00-17:59 without optimisation (same forbidden hours apply)
PV_HOURLY_CF = [0, 0, 0, 0, 0, 0.02, 0.12, 0.30, 0.50, 0.68, 0.82, 0.90, 0.92, 0.88, 0.78, 0.62, 0.42, 0.22, 0.06, 0, 0, 0, 0, 0]
#            ASSUMPTION: capacity factor of a PV array on a clear day, per hour

# ---- Uncertainty ------------------------------------------------------------------------------
MC_RUNS = 500
MC_SPREAD = 0.15               # +/-15% uniform on uncertain inputs

# ---- Economics ------------------------------------------------------------------------------
DISCOUNT = {"TN": 0.08, "JP": 0.02}   # ASSUMPTION
ENERGY_CO2_KG_PER_KWH = {"TN": 0.45, "JP": 0.45}   # ASSUMPTION: grid emission factor

ASSUMPTION_NOTES = [
    "Irrigation efficiency, effective rain, soil water at field capacity are typical values",
    "Soil nitrogen supply, nitrogen use efficiency and leaching coefficients are simplified assumptions",
    "RO energy curve, PV capex and electricity tariff are placeholders to verify with local sources",
    "Weather beyond 16 days uses a climatology fallback, not a forecast",
]
