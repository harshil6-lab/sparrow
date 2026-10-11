"""The sourced constants must not drift between the repo file and the copy that
ships inside the Lambda bundle (backend/data is the bundled one).

Mirrors frontend/src/lib/__tests__/config.test.ts: a null constant stays null
and the API hides it rather than inventing a number.
"""

import json
from pathlib import Path

import impact

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "config.json"
BUNDLED = ROOT / "backend" / "data" / "config.json"


def test_bundled_config_matches_the_sourced_file():
    assert BUNDLED.read_bytes() == SOURCE.read_bytes(), (
        "backend/data/config.json must be a byte-for-byte copy of data/config.json "
        "(it is what the deployed Lambda reads)"
    )


def test_load_config_reads_the_bundled_copy():
    assert impact.config_path() == BUNDLED
    assert impact.load_config() == json.loads(SOURCE.read_text(encoding="utf-8"))


def test_grid_emission_factor_is_sourced():
    config = impact.load_config()
    factor = config["grid_emission_factor_kg_per_kwh"]
    assert factor == 0.71
    assert "CEA" in config["grid_emission_factor_source"]
    assert config["grid_emission_factor_url"].startswith("https://cea.nic.in/")


def test_null_factor_still_hides_co2():
    """A null constant is never replaced with a guess."""
    import pytest

    with pytest.raises(ValueError):
        impact.co2_kg(10, None)