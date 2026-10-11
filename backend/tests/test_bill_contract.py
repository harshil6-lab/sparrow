import json
from pathlib import Path

import pytest

import validation


CONTRACT = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "bill-payloads.json").read_text(encoding="utf-8")
)


def validate_bill(payload):
    body = validation.only_fields(payload, validation.BILL_FIELDS)
    validation.month(body.get("month"))
    validation.integer(body.get("units"), "units", 1, 5000)
    if "amount" in body:
        validation.integer(body["amount"], "amount", 1, 100000)


def test_valid_bill_payloads_pass_backend_validation():
    for payload in CONTRACT["valid"]:
        validate_bill(payload)


def test_invalid_bill_payloads_are_rejected_by_backend_validation():
    for payload in CONTRACT["invalid"]:
        with pytest.raises(validation.HttpError):
            validate_bill(payload)
