"""GET /missions and POST /missions/{id}/complete.

A completed mission records an action only: it never touches bills, and so it
can never move the world state (that comes from verified bills alone).
"""

import store
from backend.handlers import api
from conftest import make_event


def test_no_missions_for_a_new_user(call, dynamo):
    status, body, _ = call("GET", "/missions")
    assert status == 200 and body == {"missions": []}


def test_complete_records_the_mission(call, dynamo):
    status, body, _ = call("POST", "/missions/{id}/complete", path_params={"id": "ac"})
    assert status == 200
    assert body == {"id": "ac", "date": store.today()}
    assert call("GET", "/missions")[1]["missions"] == [{"id": "ac", "date": store.today()}]


def test_every_allowlisted_mission_is_accepted(call, dynamo):
    for mission_id in ("standby_sweep", "ac", "daylight", "geyser"):
        assert call("POST", "/missions/{id}/complete", path_params={"id": mission_id})[0] == 200
    assert len(call("GET", "/missions")[1]["missions"]) == 4


def test_completing_twice_on_the_same_day_is_idempotent(call, dynamo):
    call("POST", "/missions/{id}/complete", path_params={"id": "ac"})
    call("POST", "/missions/{id}/complete", path_params={"id": "ac"})
    assert len(call("GET", "/missions")[1]["missions"]) == 1


def test_unknown_mission_is_404(call, dynamo):
    status, body, _ = call("POST", "/missions/{id}/complete", path_params={"id": "free_the_whales"})
    assert status == 404 and body["error"]
    assert call("GET", "/missions")[1]["missions"] == []


def test_missing_path_parameter_is_400(call, dynamo):
    status, body, _ = call("POST", "/missions/{id}/complete", path_params={})
    assert status == 400 and "path parameter" in body["error"]


def test_completing_a_mission_does_not_move_the_world_state(call, dynamo):
    call("POST", "/bills", body={"month": "2026-08", "units": 200, "amount": 1500})
    call("POST", "/bills", body={"month": "2026-09", "units": 170})
    before_bills = call("GET", "/bills")[1]
    before_profile = call("GET", "/me")[1]

    call("POST", "/missions/{id}/complete", path_params={"id": "standby_sweep"})

    assert call("GET", "/bills")[1] == before_bills
    assert call("GET", "/me")[1] == before_profile
    # the world state is a pure function of the bills, so it is unchanged too
    assert call("GET", "/bills")[1]["bills"][-1]["verified"] is True


def test_missions_are_isolated_between_users(call, dynamo):
    call("POST", "/missions/{id}/complete", sub="user-a", path_params={"id": "ac"})
    assert call("GET", "/missions", sub="user-b")[1]["missions"] == []
    assert len(call("GET", "/missions", sub="user-a")[1]["missions"]) == 1


def test_missions_need_a_token(call, dynamo):
    assert call("GET", "/missions", claims=False)[0] == 401
    assert call("POST", "/missions/{id}/complete", path_params={"id": "ac"}, claims=False)[0] == 401


def test_public_hello_still_works():
    response = api.hello(make_event("GET", "/hello"), None)
    assert response["statusCode"] == 200