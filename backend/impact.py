"""Impact engine: converts verified kWh changes into CO2. No hidden constants."""
import json
from pathlib import Path

_HERE = Path(__file__).resolve().parent


def config_path():
    """Where data/config.json lives.

    The Lambda bundle ships its own copy at backend/data/config.json; in a
    checkout the sourced file stays at the repo's data/config.json.
    """
    bundled = _HERE / "data" / "config.json"
    if bundled.exists():
        return bundled
    return _HERE.parent / "data" / "config.json"


def load_config():
    with open(config_path(), encoding="utf-8") as f:
        return json.load(f)


def co2_kg(kwh_saved, factor):
    if factor is None:
        raise ValueError("grid emission factor not set; fill data/config.json from a cited source")
    if kwh_saved < 0:
        raise ValueError("kwh_saved must be >= 0")
    return kwh_saved * factor


def rupees_saved(kwh_saved, baseline_amount, baseline_units):
    """kWh saved -> rupees, at the household's own average rate from the baseline
    bill. Returns None when the baseline bill has no amount."""
    if baseline_amount is None:
        return None
    if baseline_units is None or baseline_units <= 0:
        return None
    if kwh_saved < 0:
        raise ValueError("kwh_saved must be >= 0")
    return kwh_saved * (baseline_amount / baseline_units)


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
