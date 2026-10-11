"""GET/POST /bills: storage, ordering, the 120 cap, and verification maths."""

import json
from pathlib import Path

import impact
from backend.handlers import api
import store

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "bill-payloads.json").read_text(encoding="utf-8")
)


def _factor():
    return impact.load_config().get("grid_emission_factor_kg_per_kwh")


def test_list_is_empty_for_a_new_user(call, dynamo):
    status, body, _ = call("GET", "/bills")
    assert status == 200 and body == {"bills": []}


def test_first_bill_is_the_baseline(call, dynamo):
    status, body, _ = call("POST", "/bills", body={"month": "2026-08", "units": 200, "amount": 1500})
    assert status == 200
    assert body["verification"] == {"baseline": True}
    assert body["bill"]["month"] == "2026-08"
    assert body["bill"]["units"] == 200
    assert body["bill"]["amount"] == 1500
    assert body["bill"]["verified"] is False


def test_verification_against_the_previous_month(call, dynamo):
    call("POST", "/bills", body={"month": "2026-08", "units": 200, "amount": 1500})
    status, body, _ = call("POST", "/bills", body={"month": "2026-09", "units": 170})

    assert status == 200
    assert body["verification"]["kwh_saved"] == 30
    assert body["verification"]["drop_pct"] == 15.0
    assert body["verification"]["verified"] is True
    assert body["verification"]["rupees_saved"] == 225.0
    assert body["bill"]["verified"] is True
    if _factor() is not None:
        assert body["verification"]["co2_kg"] == round(30 * _factor(), 2)
    else:
        assert "co2_kg" not in body["verification"]


def test_verification_uses_its_own_previous_month_not_the_newest(call, dynamo):
    """August, then October: October compares to August (there is no September)."""
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    status, body, _ = call("POST", "/bills", body={"month": "2026-10", "units": 190})
    assert status == 200
    assert body["verification"] == {"baseline": True}


def test_missing_previous_month_is_a_baseline(call, dynamo):
    call("POST", "/bills", body={"month": "2026-09", "units": 170})
    status, body, _ = call("POST", "/bills", body={"month": "2026-07", "units": 150})
    assert status == 200 and body["verification"] == {"baseline": True}


def test_rupees_are_null_without_a_previous_amount(call, dynamo):
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    _, body, _ = call("POST", "/bills", body={"month": "2026-09", "units": 170})
    assert body["verification"]["rupees_saved"] is None
    assert body["verification"]["verified"] is True


def test_rising_usage_is_not_verified(call, dynamo):
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    _, body, _ = call("POST", "/bills", body={"month": "2026-09", "units": 220})
    assert body["verification"]["kwh_saved"] == 0
    assert body["verification"]["drop_pct"] == -10.0
    assert body["verification"]["verified"] is False


def test_co2_is_omitted_when_the_factor_is_null(call, dynamo, monkeypatch):
    """A null constant stays hidden - it is never replaced by a guess."""
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    monkeypatch.setattr(impact, "load_config", lambda: {"grid_emission_factor_kg_per_kwh": None})
    _, body, _ = call("POST", "/bills", body={"month": "2026-09", "units": 170})
    assert "co2_kg" not in body["verification"]
    assert body["verification"]["kwh_saved"] == 30


def test_upsert_replaces_the_same_month(call, dynamo):
    call("POST", "/bills", body={"month": "2026-08", "units": 200, "amount": 1500})
    call("POST", "/bills", body={"month": "2026-08", "units": 210, "amount": 1600})
    bills = call("GET", "/bills")[1]["bills"]
    assert len(bills) == 1 and bills[0]["units"] == 210 and bills[0]["amount"] == 1600


def test_same_month_upsert_preserves_existing_photo(call, dynamo):
    first = CONTRACT["valid"][0]
    assert call("POST", "/bills", body=first)[0] == 200
    item = store.get_bill_item("user-a", first["month"])
    item["photoKey"] = "u/user-a/bills/2026-08/existing.jpg"
    item["photoAt"] = "2026-08-20T00:00:00Z"
    store.table().put_item(Item=item)

    assert call("POST", "/bills", body=first)[0] == 200
    saved = store.get_bill_item("user-a", first["month"])
    assert saved["photoKey"] == item["photoKey"]
    assert saved["photoAt"] == item["photoAt"]


def test_list_is_sorted_by_month(call, dynamo):
    for month, units in (("2026-09", 170), ("2026-07", 210), ("2026-08", 200)):
        call("POST", "/bills", body={"month": month, "units": units})
    assert [bill["month"] for bill in call("GET", "/bills")[1]["bills"]] == [
        "2026-07",
        "2026-08",
        "2026-09",
    ]


def test_bill_limit_is_enforced(call, dynamo):
    for index in range(120):
        month = f"{2000 + index // 12:04d}-{index % 12 + 1:02d}"
        assert call("POST", "/bills", body={"month": month, "units": 100})[0] == 200
    status, body, _ = call("POST", "/bills", body={"month": "2030-01", "units": 100})
    assert status == 400 and "limit" in body["error"]
    # upserting an existing month is still allowed at the cap
    assert call("POST", "/bills", body={"month": "2000-01", "units": 120})[0] == 200


def test_bills_are_isolated_between_users(call, dynamo):
    call("POST", "/bills", sub="user-a", body={"month": "2026-08", "units": 200})
    assert call("GET", "/bills", sub="user-b")[1]["bills"] == []
    assert len(call("GET", "/bills", sub="user-a")[1]["bills"]) == 1


# --- validation ------------------------------------------------------------

def test_bill_validation(call, dynamo):
    assert call("POST", "/bills", body={"units": 100})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-8", "units": 100})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-13", "units": 100})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08"})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 0})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 5001})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 100, "amount": 0})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 100, "amount": 100001})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": True})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 100.5})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 100, "amount": None})[0] == 400
    assert call("POST", "/bills", body={"month": "2026-08", "units": 100, "user": "user-b"})[0] == 400


def test_bill_errors_are_json_not_stack_traces(call, dynamo):
    _, body, headers = call("POST", "/bills", body={"month": "nope", "units": 1})
    assert headers["Content-Type"].startswith("application/json")
    assert set(body) == {"error", "code"}
    assert body["code"] == "validation_error"
    assert "Traceback" not in json.dumps(body)


def test_post_bills_baseline_shape_is_json_serialisable(call, dynamo):
    _, body, _ = call("POST", "/bills", body={"month": "2026-08", "units": 200, "amount": 1500})
    assert json.loads(json.dumps(body)) == body


def test_previous_month_rolls_the_year_over():
    assert api.previous_month("2026-01") == "2025-12"
    assert api.previous_month("2026-10") == "2026-09"