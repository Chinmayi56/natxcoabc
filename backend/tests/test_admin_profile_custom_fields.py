"""Tests for the dynamic Admin Profile custom-field system (Part 2, spec 20.11+).

These run against an in-memory Mongo (mongomock-motor) and a minimal FastAPI
app that mounts only `admin_profile.build_admin_profile_router`, so they do
not need a live MongoDB, the full server.py app, or network access — just
`pip install -r requirements-dev.txt` and `pytest`.
"""
import sys
import os
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from admin_profile import build_admin_profile_router  # noqa: E402

ADMIN_1 = {"id": "admin-1", "role": "admin", "name": "Admin One", "email": "a1@ntax.co"}
ADMIN_2 = {"id": "admin-2", "role": "admin", "name": "Admin Two", "email": "a2@ntax.co"}


def _make_client(current_user=None):
    db = AsyncMongoMockClient()["ntaxco_test"]
    state = {"user": current_user or ADMIN_1}

    async def get_current_user():
        return state["user"]

    app = FastAPI()
    app.include_router(build_admin_profile_router(db, get_current_user))
    client = TestClient(app)
    return client, state


CF = "/api/admin/profile/me/custom-fields"


def test_create_text_field_and_list():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "License Number", "field_type": "text", "value": "ABC123456"})
    assert r.status_code == 200, r.text
    body = r.json()["data"]
    assert body["field_name"] == "License Number"
    assert body["value"] == "ABC123456"
    assert body["has_value"] is True

    r = client.get(CF)
    assert r.status_code == 200
    assert len(r.json()["data"]) == 1


def test_duplicate_field_name_rejected():
    client, _ = _make_client()
    client.post(CF, json={"field_name": "Branch", "field_type": "text"})
    r = client.post(CF, json={"field_name": "branch", "field_type": "text"})  # case-insensitive dup
    assert r.status_code == 400


def test_required_field_needs_value():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "Emergency Contact", "field_type": "phone", "required": True})
    assert r.status_code == 400


def test_field_type_validation_number_email_url():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "Age", "field_type": "number", "value": "not-a-number"})
    assert r.status_code == 400

    r = client.post(CF, json={"field_name": "Contact Email", "field_type": "email", "value": "bad-email"})
    assert r.status_code == 400

    r = client.post(CF, json={"field_name": "Portal", "field_type": "url", "value": "not a url"})
    assert r.status_code == 400

    r = client.post(CF, json={"field_name": "Portal", "field_type": "url", "value": "https://example.com"})
    assert r.status_code == 200


def test_dropdown_requires_options_and_validates_value():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "Branch", "field_type": "dropdown", "options": []})
    assert r.status_code == 400

    r = client.post(CF, json={
        "field_name": "Branch", "field_type": "dropdown",
        "options": ["Anantapur", "Hyderabad"], "value": "Chennai",
    })
    assert r.status_code == 400  # not a configured option

    r = client.post(CF, json={
        "field_name": "Branch", "field_type": "dropdown",
        "options": ["Anantapur", "Hyderabad"], "value": "Hyderabad",
    })
    assert r.status_code == 200


def test_edit_field_update_value_and_delete():
    client, _ = _make_client()
    created = client.post(CF, json={"field_name": "Office Code", "field_type": "text", "value": "NTAX-001"}).json()["data"]
    field_id = created["id"]

    r = client.put(f"{CF}/{field_id}", json={"value": "NTAX-002"})
    assert r.status_code == 200
    assert r.json()["data"]["value"] == "NTAX-002"

    r = client.delete(f"{CF}/{field_id}")
    assert r.status_code == 200

    r = client.get(CF)
    assert r.json()["data"] == []


def test_delete_one_field_does_not_touch_others():
    client, _ = _make_client()
    f1 = client.post(CF, json={"field_name": "A", "field_type": "text", "value": "1"}).json()["data"]
    f2 = client.post(CF, json={"field_name": "B", "field_type": "text", "value": "2"}).json()["data"]

    client.delete(f"{CF}/{f1['id']}")

    remaining = client.get(CF).json()["data"]
    assert len(remaining) == 1
    assert remaining[0]["id"] == f2["id"]
    assert remaining[0]["value"] == "2"


def test_changing_field_type_clears_incompatible_value():
    client, _ = _make_client()
    created = client.post(CF, json={"field_name": "Score", "field_type": "text", "value": "hello"}).json()["data"]

    r = client.put(f"{CF}/{created['id']}", json={"field_type": "number"})
    assert r.status_code == 200
    assert r.json()["data"]["has_value"] is False  # old text value didn't survive the type change


def test_admin_cannot_see_another_admins_custom_fields():
    client1, state = _make_client(ADMIN_1)
    client1.post(CF, json={"field_name": "Private Note", "field_type": "text", "value": "secret"})

    state["user"] = ADMIN_2
    r = client1.get(CF)
    assert r.json()["data"] == []  # admin-2 sees nothing of admin-1's


def test_delete_nonexistent_field_404():
    client, _ = _make_client()
    r = client.delete(f"{CF}/does-not-exist")
    assert r.status_code == 404


def test_field_name_required_and_length_capped():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "  ", "field_type": "text"})
    assert r.status_code == 400

    r = client.post(CF, json={"field_name": "x" * 81, "field_type": "text"})
    assert r.status_code == 400


def test_checkbox_field_stores_boolean():
    client, _ = _make_client()
    r = client.post(CF, json={"field_name": "Subscribed", "field_type": "checkbox", "value": True})
    assert r.status_code == 200
    assert r.json()["data"]["value"] is True

    field_id = r.json()["data"]["id"]
    r = client.put(f"{CF}/{field_id}", json={"value": False})
    assert r.status_code == 200
    assert r.json()["data"]["value"] is False
