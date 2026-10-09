import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import pytest
import impact


def test_mission_verified():
    r = impact.mission_result(200, 170)
    assert r["kwh_saved"] == 30 and r["drop_pct"] == 15.0 and r["verified"]


def test_mission_not_verified_small_drop():
    assert not impact.mission_result(200, 198)["verified"]


def test_no_negative_savings():
    assert impact.mission_result(100, 120)["kwh_saved"] == 0


def test_co2_requires_factor():
    with pytest.raises(ValueError):
        impact.co2_kg(10, None)


def test_co2_math_with_explicit_factor():
    assert impact.co2_kg(10, 0.5) == 5.0
