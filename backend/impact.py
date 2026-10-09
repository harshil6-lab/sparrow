"""Impact engine: converts verified kWh changes into CO2. No hidden constants."""
import json
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def co2_kg(kwh_saved, factor):
    if factor is None:
        raise ValueError("grid emission factor not set; fill data/config.json from a cited source")
    if kwh_saved < 0:
        raise ValueError("kwh_saved must be >= 0")
    return kwh_saved * factor


def mission_result(baseline_units, new_units, min_drop_pct=5.0):
    """Verify a mission by comparing two bills. Units are kWh per month."""
    if baseline_units <= 0:
        raise ValueError("baseline_units must be > 0")
    saved = max(baseline_units - new_units, 0.0)
    drop_pct = 100.0 * (baseline_units - new_units) / baseline_units
    return {
        "kwh_saved": round(saved, 2),
        "drop_pct": round(drop_pct, 1),
        "verified": drop_pct >= min_drop_pct,
    }


def scale_projection(kwh_saved_per_home, homes):
    """A projection, not a measurement. Label it as such in the UI."""
    return kwh_saved_per_home * homes
