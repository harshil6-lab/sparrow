import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
import impact

HEADERS = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}


def _resp(code, body):
    return {"statusCode": code, "headers": HEADERS, "body": json.dumps(body, ensure_ascii=False)}


def hello(event, context):
    return _resp(200, {"ok": True, "service": "chiri"})


def mission(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        res = impact.mission_result(float(body["baseline_units"]), float(body["new_units"]))
        cfg = impact.load_config()
        factor = cfg.get("grid_emission_factor_kg_per_kwh")
        if factor is not None:
            res["co2_kg"] = round(impact.co2_kg(res["kwh_saved"], factor), 2)
            res["co2_source"] = cfg["grid_emission_factor_source"]
        return _resp(200, res)
    except (KeyError, ValueError, TypeError) as e:
        return _resp(400, {"error": str(e)})
