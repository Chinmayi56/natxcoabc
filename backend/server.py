from dotenv import load_dotenv
from pathlib import Path
import os
import re
import asyncio
import logging
import uuid
import jwt
import bcrypt

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body, Query
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

import security
from otp_guard import otp_send_guard


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.getenv("MONGO_URL")


def _mask_mongo_url(url: str) -> str:
    """Redact any credentials in a mongodb:// or mongodb+srv:// URL before
    it ever hits logs — e.g. mongodb+srv://user:pass@host -> mongodb+srv://***@host.
    Previously this was printed to logs unmasked, which leaks DB credentials
    into any log aggregator in production."""
    return re.sub(r"//[^@/]+@", "//***@", url or "")


print("DEBUG MONGO_URL =", _mask_mongo_url(mongo_url))

if not mongo_url:
    raise Exception("MONGO_URL is missing")

# serverSelectionTimeoutMS: fail fast (8s) instead of Motor's 30s default.
# Without this, a wrong/unreachable MONGO_URL (e.g. MongoDB not started
# locally, or a typo'd Atlas URI) makes every DB-touching request hang for
# 30s before erroring — which reads as a generic "Network Error"/timeout in
# the browser with no clue why. See the startup ping below for the actual
# diagnostic message.
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=8000)

db = client[os.getenv("DB_NAME", "ntaxco")]

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # Fail loudly and specifically at startup rather than with a bare
    # KeyError. A missing required env var here crashes the whole process
    # on boot — on most hosting platforms that means the platform's own
    # reverse proxy/load balancer will return a raw 502 Bad Gateway (with
    # no CORS headers, since the app never started) for every single
    # request, which the browser reports as a generic "Network Error".
    # This message is what should show up in the deployment's backend
    # logs when that happens.
    raise Exception(
        "JWT_SECRET is missing. Set it in the backend's environment "
        "variables (backend/.env locally, or the hosting platform's env "
        "var settings in production) and restart the backend."
    )
JWT_ALGORITHM = "HS256"
FIXED_ADMIN_PASSWORD = "Admin@12"

# ---------------- Twilio Verify (real SMS OTP) ----------------
# Credentials are read from the environment only — never hard-coded, never
# sent to the frontend, never included in API responses/logs.
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID")

print(f"[OTP] TWILIO_ACCOUNT_SID loaded: {bool(TWILIO_ACCOUNT_SID)}", flush=True)
print(f"[OTP] TWILIO_AUTH_TOKEN loaded: {bool(TWILIO_AUTH_TOKEN)}", flush=True)
print(f"[OTP] TWILIO_VERIFY_SERVICE_SID loaded: {bool(TWILIO_VERIFY_SERVICE_SID)}", flush=True)

_twilio_client: Optional[TwilioClient] = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    # Don't crash the whole backend on import (other routes / dev work should
    # still function); mobile OTP endpoints will fail loudly and safely if
    # actually called without credentials configured.
    logging.getLogger(__name__).warning(
        "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — mobile OTP login "
        "will not work until Twilio credentials are configured in .env"
    )


def get_twilio_client() -> TwilioClient:
    if _twilio_client is None or not TWILIO_VERIFY_SERVICE_SID:
        raise HTTPException(
            status_code=503,
            detail="Mobile OTP login is not configured on the server. Please contact support.",
        )
    return _twilio_client


def mask_mobile(mobile: str) -> str:
    """Safe-for-logs representation of a mobile number, e.g. 90******58."""
    m = str(mobile or "")
    if len(m) <= 4:
        return "*" * len(m)
    return f"{m[:2]}{'*' * (len(m) - 4)}{m[-2:]}"

PORTAL_ROLES = {"admin", "employee", "customer", "agent"}

PORTAL_ROLE_NAMES = {
    "admin": "Super Admin",
    "employee": "Employee",
    "customer": "Customer",
    "agent": "Tax Consultant",
}


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


app = FastAPI(
    title="NTAXCO ERP API",
    version="1.0.0"
)


@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "NTAXCO ERP Backend is running"
    }


@app.get("/api/health")
async def api_health():
    """Non-secret deployment check: confirms this process serves the /api
    routes the Admin frontend needs (a stale/older backend revision will
    404 here or list fewer features). Exposes no credentials or data."""
    paths = {getattr(r, "path", "") for r in app.routes}
    wanted = {
        "admin_dashboard": "/api/admin/dashboard",
        "admin_analytics": "/api/admin/analytics/summary",
        "admin_profile": "/api/admin/profile/me",
        "dynamic_config": "/api/admin/dynamic-config",
        "dynamic_records": "/api/dynamic-records/{module_key}",
        "admin_security": "/api/admin/security/overview",
        # Admin -> Customers module. If either is false the process answering this port is a stale
        # backend revision (the symptom: GET /admin/customers/summary -> 404 while the plain customer
        # list still works). Restart uvicorn from THIS project's backend/ folder.
        "customer_summary": "/api/admin/customers/summary",
        "workflow_drag_drop": "/api/admin/workflows/drag-drop",
    }
    return {
        "status": "ok",
        "db_name": os.getenv("DB_NAME", "ntaxco"),
        "features": {k: (v in paths) for k, v in wanted.items()},
    }


_cors_origins_env = os.getenv("CORS_ORIGINS")

if _cors_origins_env:
    _cors_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
else:
    # No insecure "allow everything" default. If CORS_ORIGINS isn't set,
    # assume local development (matches frontend/.env's default of
    # http://localhost:3000) rather than silently opening the API to any
    # origin in production. In production this MUST be set explicitly to
    # the deployed frontend's exact origin (scheme + host, no trailing
    # slash), e.g. CORS_ORIGINS=https://your-frontend-domain.vercel.app —
    # otherwise every request from the real deployed frontend will be
    # blocked by the browser and show up there as a generic "Network
    # Error", even though the backend itself is healthy.
    _cors_origins = ["http://localhost:3000", "http://localhost:3001"]
    logger.warning(
        "CORS_ORIGINS is not set — defaulting to local dev origins %s. "
        "Set CORS_ORIGINS to the deployed frontend's exact URL in production.",
        _cors_origins,
    )

print(f"[CORS] Allowed origins: {_cors_origins}", flush=True)

# LAN dev access (e.g. opening the frontend via its "Network" IP like
# http://192.168.1.23:3000 instead of http://localhost:3000):
#
# The exact-match _cors_origins list above can't include that IP because
# it's assigned by the router/DHCP and changes machine to machine and
# network to network — hard-coding one would break for everyone else and
# need editing every time it changes. Instead of falling back to a
# wildcard ("*", which Starlette also refuses to combine with
# allow_credentials=True), allow_origin_regex is used to match ONLY
# private, non-routable LAN addresses (RFC 1918: 192.168.x.x, 10.x.x.x,
# 172.16-31.x.x) plus localhost/127.0.0.1, on the frontend dev ports this
# project actually uses (3000, 3001). A real public domain used in
# production will never match this pattern, so it adds no risk there.
# Override with CORS_ORIGIN_REGEX in .env if a project needs something
# different; leave unset to keep this safe default.
_cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX") or (
    r"^http://("
    r"localhost"
    r"|127\.0\.0\.1"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r"):(3000|3001)$"
)

print(f"[CORS] LAN origin pattern: {_cors_origin_regex}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


api_router = APIRouter(prefix="/api")

class DynamicConfigModel(BaseModel):
    name: str
    key: Optional[str] = None
    description: Optional[str] = ""
    enabled: bool = True
    fields: List[dict] = []
    options: List[dict] = []
    sections: List[dict] = []
    content: List[dict] = []


# ---------------- Dynamic (Admin-created) ERP modules ----------------
# Slugs that must never be handed out to an admin-created module because
# they already correspond to a real, hard-coded route/collection elsewhere
# in the app. Without this a module named e.g. "Employees" would silently
# shadow (or be shadowed by) the real Employees module.
RESERVED_MODULE_SLUGS = {
    "dashboard", "employees", "leave-requests", "customers", "agents", "bookings",
    "services", "projects", "gst", "income-tax", "itr", "tds", "roc", "accounting",
    "invoices", "payments", "documents", "reports", "notifications", "security",
    "settings", "modules", "dynamic-records", "dynamic-config", "attendance", "leave",
    "tasks", "payslips", "calendar", "meetings", "performance", "profile", "admin-profile", "leads",
    "onboarding", "appointments", "commission", "commissions", "home", "login",
    "support", "messages", "journal", "site-images", "images",
}

# Field types the dynamic-module form builder and record editor understand.
DYNAMIC_FIELD_TYPES = {"text", "textarea", "number", "select", "date"}


def _slugify(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-")
    return s or "module"


def _normalize_dynamic_fields(fields: List[dict]) -> List[dict]:
    """Validate + normalize an admin-submitted field list into a safe,
    consistent shape: {key, label, type, required, options}. Unknown field
    types fall back to plain text instead of erroring, so a small typo in
    the type never breaks module creation. Field keys are de-duplicated so
    two fields can never silently overwrite each other's data."""
    normalized = []
    seen_keys = set()
    for f in (fields or []):
        if not isinstance(f, dict):
            continue
        label = str(f.get("label") or f.get("name") or "").strip()
        if not label:
            continue
        ftype = str(f.get("type") or "text").strip().lower()
        if ftype not in DYNAMIC_FIELD_TYPES:
            ftype = "text"
        key = re.sub(r"[^a-z0-9]+", "_", str(f.get("key") or label).lower()).strip("_") or "field"
        base_key, n = key, 2
        while key in seen_keys:
            key = f"{base_key}_{n}"; n += 1
        seen_keys.add(key)
        options = [str(o).strip() for o in (f.get("options") or []) if str(o).strip()] if ftype == "select" else []
        normalized.append({
            "key": key, "label": label, "type": ftype,
            "required": bool(f.get("required", False)), "options": options,
        })
    return normalized


def _validate_dynamic_record(fields: List[dict], body: dict) -> dict:
    """Validate a submitted record's values against a module's field
    configuration (required-ness, number parsing, dropdown membership)
    and return the clean, storable field->value dict."""
    data, errors = {}, []
    for f in fields:
        key, label, ftype = f["key"], f["label"], f["type"]
        val = body.get(key, "")
        if ftype == "number":
            if val in ("", None):
                if f.get("required"):
                    errors.append(f"{label} is required")
                data[key] = None
            else:
                try:
                    num = float(val)
                    data[key] = int(num) if num.is_integer() else num
                except (TypeError, ValueError):
                    errors.append(f"{label} must be a number")
        else:
            sval = "" if val is None else str(val)
            if f.get("required") and not sval.strip():
                errors.append(f"{label} is required")
            if ftype == "select" and sval and f.get("options") and sval not in f["options"]:
                errors.append(f"{label} must be one of: {', '.join(f['options'])}")
            data[key] = sval
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return data

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        session_id = payload.get("sid")
        if session_id:
            if not await security.is_session_active(db, session_id):
                raise HTTPException(status_code=401, detail="Session expired. Please login again.")
            # Best-effort, throttled — never blocks the request on failure.
            await security.touch_session_activity(db, session_id)
        # Transient only (not persisted): lets /auth/logout and other
        # endpoints know which session this request's token belongs to.
        user["_session_id"] = session_id
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")



@api_router.get("/admin/dynamic-config")
async def list_dynamic_configs(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    return await db.dynamic_configs.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/admin/dynamic-config")
async def create_dynamic_config(payload: DynamicConfigModel, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Module name is required")

    existing_all = await db.dynamic_configs.find({}, {"_id": 0}).to_list(1000)
    if any((c.get("name") or "").strip().lower() == name.lower() for c in existing_all):
        raise HTTPException(status_code=409, detail=f"A module named '{name}' already exists")

    doc = payload.model_dump()
    doc["name"] = name
    doc["fields"] = _normalize_dynamic_fields(doc.get("fields"))

    # Generate a safe, unique, URL-friendly slug — never trust a
    # client-supplied key as-is, and never collide with a reserved/existing
    # route so the new module can't shadow (or be shadowed by) another page.
    base_key = _slugify(doc.get("key") or name)
    existing_keys = {c.get("key") for c in existing_all}
    key, n = base_key, 2
    while key in existing_keys or key in RESERVED_MODULE_SLUGS:
        key = f"{base_key}-{n}"; n += 1
    doc["key"] = key

    doc["id"] = str(uuid.uuid4())
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dynamic_configs.insert_one(doc); doc.pop("_id", None)
    return doc

@api_router.put("/admin/dynamic-config/{config_id}")
async def update_dynamic_config(config_id: str, payload: DynamicConfigModel, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    existing = await db.dynamic_configs.find_one({"id": config_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Configuration not found")

    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Module name is required")

    others = await db.dynamic_configs.find({"id": {"$ne": config_id}}, {"_id": 0}).to_list(1000)
    if any((c.get("name") or "").strip().lower() == name.lower() for c in others):
        raise HTTPException(status_code=409, detail=f"A module named '{name}' already exists")

    doc = payload.model_dump()
    doc["name"] = name
    doc["fields"] = _normalize_dynamic_fields(doc.get("fields"))
    # The slug/key is the module's permanent identity (sidebar route, record
    # storage) — it's set once at creation and never changes on edit, so
    # existing links and saved records never silently break.
    doc["key"] = existing["key"]
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dynamic_configs.update_one({"id": config_id}, {"$set": doc})
    return {"id": config_id, **doc}

@api_router.delete("/admin/dynamic-config/{config_id}")
async def delete_dynamic_config(config_id: str, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    existing = await db.dynamic_configs.find_one({"id": config_id}, {"_id": 0})
    await db.dynamic_configs.delete_one({"id": config_id})
    if existing and existing.get("key"):
        # Cascade-delete this module's records so deleting a module doesn't
        # leave orphaned data behind under a now-unreachable module_key.
        await db.dynamic_records.delete_many({"module_key": existing["key"]})
    return {"success": True}

@api_router.get("/public/dynamic-config")
async def public_dynamic_configs():
    return await db.dynamic_configs.find({"enabled":True},{"_id":0}).to_list(1000)


# Publicly-readable, admin-managed images (Settings → Images) for the
# customer site. Unlike the generic /site-images CRUD (which requires an
# authenticated session), this powers pages visitors can see before logging
# in — e.g. the marketing Home page — so it intentionally takes no auth
# dependency and only ever returns Active images.
VALID_SITE_IMAGE_PLACEMENTS = {"home", "dashboard", "projects", "services"}

@api_router.get("/public/site-images")
async def public_site_images(placement: Optional[str] = Query(None)):
    query = {"status": "Active"}
    if placement:
        placement = placement.strip().lower()
        if placement not in VALID_SITE_IMAGE_PLACEMENTS:
            raise HTTPException(status_code=400, detail=f"Placement must be one of: {', '.join(sorted(VALID_SITE_IMAGE_PLACEMENTS))}")
        query["placement"] = placement
    items = await db["erp_site_images"].find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"success": True, "data": items}


# ---------------- Customer/Home page images (Settings → Images) ----------------
# The Customer/Home page has always shown exactly 3 fixed images (hero,
# analytics, office). This makes those 3 — and ONLY those 3 — editable from
# Admin Settings → Images, using the same upload/validate/store approach as
# the existing site-images feature above. This is intentionally a separate,
# fixed-slot collection (erp_home_images) rather than the generic
# erp_site_images list: the 3 slots are stable identifiers an admin edits in
# place, not an open-ended gallery, and none of this touches the existing
# Featured Images (site-images/placement="home") functionality.
HOME_IMAGE_DEFAULTS = {
    "customer_home_image_1": {
        "label": "Home Page Image 1",
        "image": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=srgb&fm=jpg&q=85",
    },
    "customer_home_image_2": {
        "label": "Home Page Image 2",
        "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&q=85",
    },
    "customer_home_image_3": {
        "label": "Home Page Image 3",
        "image": "https://images.unsplash.com/photo-1560179707-f14e90ef3623?crop=entropy&cs=srgb&fm=jpg&q=85",
    },
}
# Same ~5MB-of-base64 ceiling used by the existing site-images feature, kept
# as its own constant here since this file loads before erp.py is imported.
MAX_HOME_IMAGE_DATA_LEN = 7_000_000

async def _ensure_home_image_defaults() -> None:
    """Lazily create the 3 fixed home-page-image records the first time
    they're needed, seeded with the exact images the Customer/Home page has
    always shown — so enabling this feature causes zero visual change until
    an admin actually edits one."""
    existing_ids = {d["id"] async for d in db["erp_home_images"].find({}, {"_id": 0, "id": 1})}
    missing = [key for key in HOME_IMAGE_DEFAULTS if key not in existing_ids]
    if not missing:
        return
    now = datetime.now(timezone.utc).isoformat()
    docs = [{
        "id": key,
        "label": HOME_IMAGE_DEFAULTS[key]["label"],
        "image": HOME_IMAGE_DEFAULTS[key]["image"],
        "status": "Active",
        "created_at": now,
        "updated_at": now,
    } for key in missing]
    if docs:
        await db["erp_home_images"].insert_many(docs)

@api_router.get("/admin/home-images")
async def list_home_images(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    await _ensure_home_image_defaults()
    items = await db["erp_home_images"].find({}, {"_id": 0}).sort("id", 1).to_list(10)
    return {"success": True, "data": items}

@api_router.put("/admin/home-images/{image_key}")
async def update_home_image(image_key: str, body: dict = Body(...), user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    if image_key not in HOME_IMAGE_DEFAULTS:
        raise HTTPException(status_code=404, detail="Unknown home page image slot")
    await _ensure_home_image_defaults()
    update = {}
    if "image" in body:
        image = str(body.get("image") or "").strip()
        if not image:
            raise HTTPException(status_code=400, detail="An image (file upload or URL) is required")
        if len(image) > MAX_HOME_IMAGE_DATA_LEN:
            raise HTTPException(status_code=400, detail="Image is too large. Please upload an image under ~5MB.")
        update["image"] = image
    if "status" in body:
        status = str(body.get("status") or "Active").strip() or "Active"
        if status not in ("Active", "Inactive"):
            raise HTTPException(status_code=400, detail="Status must be Active or Inactive")
        update["status"] = status
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db["erp_home_images"].update_one({"id": image_key}, {"$set": update})
    item = await db["erp_home_images"].find_one({"id": image_key}, {"_id": 0})
    return {"success": True, "message": "Home page image updated", "data": item}

@api_router.get("/public/home-images")
async def public_home_images():
    """Unauthenticated — powers the Customer/Home page for logged-out
    visitors. Only returns Active slots; the frontend falls back to its
    built-in default image for any slot that's missing/inactive, so the
    3 existing Home page positions never go blank."""
    await _ensure_home_image_defaults()
    items = await db["erp_home_images"].find({"status": "Active"}, {"_id": 0}).to_list(10)
    return {"success": True, "data": {item["id"]: item["image"] for item in items}}


# ---------------- Generic dynamic-module record CRUD ----------------
# One reusable set of endpoints backs EVERY admin-created dynamic module —
# nothing here is specific to any particular module name. Records for all
# dynamic modules live in a single `dynamic_records` collection, scoped by
# `module_key`, and are always validated against that module's *current*
# saved field configuration before being written.

async def _get_dynamic_module_or_404(module_key: str) -> dict:
    config = await db.dynamic_configs.find_one({"key": module_key}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Module not found")
    return config

@api_router.get("/dynamic-records/{module_key}")
async def list_dynamic_records(module_key: str, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    await _get_dynamic_module_or_404(module_key)
    items = await db.dynamic_records.find({"module_key": module_key}, {"_id": 0}).to_list(5000)
    return _ok(items)

@api_router.post("/dynamic-records/{module_key}")
async def create_dynamic_record(module_key: str, body: dict = Body(...), user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    config = await _get_dynamic_module_or_404(module_key)
    if config.get("enabled") is False:
        raise HTTPException(status_code=403, detail="This module is currently disabled")
    data = _validate_dynamic_record(config.get("fields") or [], body)
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": f"REC-{uuid.uuid4().hex[:8].upper()}", "module_key": module_key, **data, "created_at": now, "updated_at": now}
    await db.dynamic_records.insert_one({**doc}); doc.pop("_id", None)
    return _ok(doc, message="Record created")

@api_router.put("/dynamic-records/{module_key}/{record_id}")
async def update_dynamic_record(module_key: str, record_id: str, body: dict = Body(...), user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    config = await _get_dynamic_module_or_404(module_key)
    existing = await db.dynamic_records.find_one({"id": record_id, "module_key": module_key}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")
    data = _validate_dynamic_record(config.get("fields") or [], body)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.dynamic_records.update_one({"id": record_id, "module_key": module_key}, {"$set": data})
    item = await db.dynamic_records.find_one({"id": record_id, "module_key": module_key}, {"_id": 0})
    return _ok(item, message="Record updated")

@api_router.delete("/dynamic-records/{module_key}/{record_id}")
async def delete_dynamic_record(module_key: str, record_id: str, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin", "superadmin"):
        raise HTTPException(403, "Admin access required")
    res = await db.dynamic_records.delete_one({"id": record_id, "module_key": module_key})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return _ok({"id": record_id}, message="Record deleted")



# ---------------- helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str, role: str, token_type: str = "access", session_id: str = None) -> str:
    delta = timedelta(minutes=60) if token_type == "access" else timedelta(days=7)
    payload = {
        "sub": user_id,
        "role": role,
        "type": token_type,
        "exp": datetime.now(timezone.utc) + delta,
        "iat": datetime.now(timezone.utc),
    }
    if session_id:
        # Ties this otherwise-stateless JWT to a backend-managed
        # UserSession record (see security.py) so Active Sessions /
        # session termination can actually take effect on future requests.
        payload["sid"] = session_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc.get("email"),
        "mobile": doc.get("mobile"),
        "role": doc["role"],
        "avatar": doc.get("avatar"),
        "meta": doc.get("meta", {}),
    }


def is_valid_indian_mobile(mobile: str) -> bool:
    m = mobile.replace("+91", "").replace(" ", "").strip()
    return len(m) == 10 and m[0] in "6789" and m.isdigit()


def normalize_mobile(mobile: str) -> str:
    return mobile.replace("+91", "").replace(" ", "").strip()


def to_e164_india(mobile: str) -> str:
    """Convert a normalized 10-digit Indian mobile number to E.164, e.g.
    9014564558 -> +919014564558. Assumes is_valid_indian_mobile() already
    passed for this value."""
    return f"+91{mobile}"


# ---------------- schemas ----------------
class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class PortalEmailLogin(BaseModel):
    email: EmailStr
    password: str
    role: str


class SendOtp(BaseModel):
    mobile: str
    role: str


class VerifyOtp(BaseModel):
    mobile: str
    otp: str
    role: str


class RefreshReq(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    mobile: Optional[str] = None


# Roles that the public /api/auth/register endpoint is allowed to create.
# "admin" (Super Admin) must never be reachable through public
# registration — it is intentionally left out of this set.
PUBLIC_REGISTRATION_ROLES = {"employee", "customer", "agent"}


# ---------------- auth endpoints ----------------
async def auth_response(user: dict, *, method: str, request: Request = None):
    """Builds the standard login response AND, as a side effect, creates a
    backend-managed UserSession + LOGIN_SUCCESS LoginAudit record for the
    Security module (see security.py). This runs for every successful
    login across all four portals and both authentication methods."""
    session = await security.create_user_session(db, user=user, method=method, request=request)
    sid = session.get("session_id")
    access_token = create_token(user["id"], user["role"], "access", session_id=sid)
    refresh_token = create_token(user["id"], user["role"], "refresh", session_id=sid)
    await security.record_login_audit(
        db, mask_mobile=mask_mobile, event_type="LOGIN_SUCCESS", status="SUCCESS", method=method,
        user=user, role=user.get("role"),
        mobile=user.get("mobile") if method == "MOBILE_OTP" else None,
        email=user.get("email") if method == "EMAIL_PASSWORD" else None,
        request=request, session_id=sid,
    )
    if user.get("role") == "customer":
        from erp import notify_customer_login
        await notify_customer_login(db, user, session_id=sid)
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "user": public_user(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/auth/register")
async def register(body: RegisterRequest, request: Request = None):
    """
    Real Email + Password account creation for the Employee / Customer /
    Agent portals.

    This is NOT a second auth system: it writes into the same `users`
    collection as every other login path, hashes passwords with the same
    bcrypt helper (hash_password/verify_password) used elsewhere in this
    file, and a successfully registered account authenticates through the
    existing /api/auth/portal/login endpoint (see the `meta.registered`
    branch there) and the existing JWT issuance in auth_response().

    Super Admin accounts can never be created here — see
    PUBLIC_REGISTRATION_ROLES.
    """
    full_name = str(body.full_name or "").strip()
    if not full_name:
        raise HTTPException(status_code=422, detail="Full name is required.")

    # EmailStr already guarantees a structurally valid address; also
    # trim + lowercase it, same normalization used by every other login
    # endpoint in this file.
    email = str(body.email).strip().lower()

    password = str(body.password or "")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")

    role = str(body.role or "").strip().lower()
    if role not in PUBLIC_REGISTRATION_ROLES:
        raise HTTPException(
            status_code=422,
            detail="Invalid role. Allowed roles for registration: employee, customer, agent.",
        )

    mobile = None
    if body.mobile and str(body.mobile).strip():
        mobile = normalize_mobile(str(body.mobile))
        if not is_valid_indian_mobile(mobile):
            raise HTTPException(
                status_code=422,
                detail="Enter a valid 10-digit Indian mobile number starting with 6-9.",
            )

    # A real account can register once per email + role. Existing accounts
    # are upgraded only when they have not yet been given a real password.
    existing = await db.users.find_one({"email": email, "role": role}, {"_id": 0})
    if existing and (existing.get("meta") or {}).get("registered"):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please login instead.",
        )

    password_hash = hash_password(password)
    now = datetime.now(timezone.utc)

    try:
        if existing:
            # Upgrade an account created by a verified onboarding flow instead
            # of creating a second, disconnected user record.
            update = {
                "name": full_name,
                "password_hash": password_hash,
                "mobile": mobile or existing.get("mobile"),
                "status": "active",
                "updated_at": now,
                "meta.registered": True,
                "meta.fixed_login": False,
            }
            await db.users.update_one({"id": existing["id"]}, {"$set": update})
            user = await db.users.find_one({"id": existing["id"]}, {"_id": 0})
        else:
            user = {
                "id": f"{role.upper()}-{uuid.uuid4().hex[:8].upper()}",
                "name": full_name,
                "email": email,
                "mobile": mobile,
                "role": role,
                "password_hash": password_hash,
                "avatar": None,
                "meta": {"registered": True},
                "status": "active",
                "created_at": now,
                "updated_at": now,
            }
            await db.users.insert_one(user)
    except PyMongoError:
        # Covers a rare race: two requests registering the same email+role
        # concurrently both pass the find_one() check above. The partial
        # unique index on (email, role) for registered accounts (created
        # at startup — see create_security_indexes-style setup below)
        # rejects the second insert/update.
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please login instead.",
        )

    if role == "customer":
        customer_id = f"CUS-{uuid.uuid4().hex[:8].upper()}"
        await db["erp_customers"].insert_one({
            "id": customer_id, "cust_id": customer_id, "business_name": full_name,
            "owner": full_name, "email": email, "mobile": mobile, "status": "Active",
            "onboarding_status": "Pending", "filing_status": "Pending", "notes": "Self-registered customer",
        })
        await db.users.update_one({"id": user["id"]}, {"$set": {"meta.customer_id": customer_id}})
        user.setdefault("meta", {})["customer_id"] = customer_id
        # Customer is persisted -> now notify Admin (never raises).
        from erp import notify_customer_registered
        await notify_customer_registered(db, {
            "id": customer_id, "business_name": full_name, "owner": full_name,
            "email": email, "mobile": mobile,
        })

    await security.record_login_audit(
        db, mask_mobile=mask_mobile, event_type="REGISTER_SUCCESS", status="SUCCESS",
        method="EMAIL_PASSWORD", user=user, role=role, email=email, request=request,
    )

    # Register the account and log the user straight in, reusing the same
    # JWT/session issuance every other login path uses.
    return await auth_response(user, method="EMAIL_PASSWORD", request=request)


@api_router.post("/auth/admin/login")
async def admin_login(body: AdminLogin, request: Request = None):
    """Authenticate an existing Admin account stored in MongoDB."""
    email = str(body.email).strip().lower()
    user = await db.users.find_one({"email": email, "role": "admin"}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await security.record_login_audit(db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
            method="EMAIL_PASSWORD", role="admin", email=email, request=request, failure_reason="INVALID_CREDENTIALS")
        raise HTTPException(status_code=401, detail="Invalid admin email or password")
    if user.get("is_blocked"):
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")
    return await auth_response(user, method="EMAIL_PASSWORD", request=request)


@api_router.post("/auth/portal/login")
async def portal_email_login(body: PortalEmailLogin, request: Request = None):
    """Authenticate an existing Employee/Customer/Agent account from MongoDB."""
    role = str(body.role).strip().lower()
    if role not in PORTAL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid portal role")
    if role == "admin":
        return await admin_login(AdminLogin(email=body.email, password=body.password), request=request)
    email = str(body.email).strip().lower()
    user = await db.users.find_one({"email": email, "role": role}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await security.record_login_audit(db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
            method="EMAIL_PASSWORD", role=role, email=email, request=request, failure_reason="INVALID_CREDENTIALS")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("is_blocked"):
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")
    return await auth_response(user, method="EMAIL_PASSWORD", request=request)


@api_router.post("/auth/mobile/send-otp")
async def send_otp(body: SendOtp, request: Request = None):
    """
    Mobile login OTP — sends a real SMS OTP via Twilio Verify.

    The OTP itself is generated and managed entirely by Twilio; it is
    never generated by, stored in, or returned by this backend.
    """

    mobile = normalize_mobile(body.mobile)
    role = str(body.role).strip().lower()

    allowed_roles = {
        "admin",
        "employee",
        "customer",
        "agent",
    }

    if role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Invalid portal role"
        )

    if not is_valid_indian_mobile(mobile):
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="OTP_SEND_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request,
            failure_reason="INVALID_MOBILE",
        )
        raise HTTPException(
            status_code=422,
            detail="Enter a valid 10-digit Indian mobile number starting with 6-9"
        )

    client_ip = security.get_client_ip(request) if request else ""
    if client_ip == "Unknown":
        client_ip = ""  # never pool unidentifiable clients into one shared IP bucket

    # A second request for the same number while the first is still being
    # sent (double click, Enter + click, flaky retry) must NOT trigger a
    # second SMS / burn Twilio quota: share the first request's outcome.
    inflight = otp_send_guard.get_inflight(mobile)
    if inflight is not None:
        return await asyncio.shield(inflight)

    blocked = otp_send_guard.check(mobile, client_ip)
    if blocked:
        retry_after, reason = blocked
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="OTP_SEND_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request,
            failure_reason="OTP_RATE_LIMITED",
        )
        raise _otp_rate_limit_error(reason, retry_after)

    task = asyncio.ensure_future(_perform_otp_send(mobile, role, client_ip, request))
    otp_send_guard.set_inflight(mobile, task)
    task.add_done_callback(lambda t: otp_send_guard.clear_inflight(mobile, t))
    return await asyncio.shield(task)


def _otp_rate_limit_error(reason: str, retry_after: int) -> HTTPException:
    """429 with a human-readable message plus machine-readable cooldown data."""
    return HTTPException(
        status_code=429,
        detail={
            "message": otp_send_guard.message(reason, retry_after),
            "code": "OTP_RATE_LIMITED",
            "reason": reason,
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )


async def _perform_otp_send(mobile: str, role: str, client_ip: str, request: Request):
    """The single place that actually calls Twilio Verify to send an OTP."""
    twilio_client = get_twilio_client()
    e164_mobile = to_e164_india(mobile)

    def _send():
        return twilio_client.verify.v2.services(
            TWILIO_VERIFY_SERVICE_SID
        ).verifications.create(to=e164_mobile, channel="sms")

    try:
        # Twilio's SDK is synchronous; run it in a worker thread so it never
        # blocks the event loop (which also lets duplicate requests be seen
        # and de-duplicated while the first one is still in flight).
        verification = await asyncio.to_thread(_send)
    except TwilioRestException as e:
        logger.warning(f"Twilio send-otp failed for {mask_mobile(mobile)}: code={e.code} status={e.status}")
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="OTP_SEND_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request,
            failure_reason="TWILIO_SEND_FAILED",
        )
        if e.status == 429 or e.code == 20429:
            # Twilio's own per-number limit was reached. Stop forwarding more
            # requests for a while and tell the user exactly how long to wait.
            otp_send_guard.record_provider_limit(mobile)
            retry_after = otp_send_guard.twilio_lock or 600
            raise _otp_rate_limit_error("provider_limit", retry_after)
        if e.code in (60200, 60203, 60212):
            raise HTTPException(status_code=422, detail="Enter a valid mobile number.")
        raise HTTPException(status_code=502, detail="Unable to send OTP right now. Please try again shortly.")
    except Exception:
        logger.exception(f"Unexpected error sending OTP for {mask_mobile(mobile)}")
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="OTP_SEND_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request,
            failure_reason="TWILIO_SEND_FAILED",
        )
        raise HTTPException(status_code=502, detail="Unable to send OTP right now. Please try again shortly.")

    if verification.status not in ("pending", "approved"):
        logger.warning(f"Twilio send-otp unexpected status for {mask_mobile(mobile)}: {verification.status}")
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="OTP_SEND_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request,
            failure_reason="TWILIO_SEND_FAILED",
        )
        raise HTTPException(status_code=502, detail="Unable to send OTP right now. Please try again shortly.")

    # Only a successful send counts toward the cooldown / window caps.
    otp_send_guard.record_success(mobile, client_ip)

    logger.info(f"OTP sent via Twilio Verify to {mask_mobile(mobile)} (role={role})")
    await security.record_login_audit(
        db, mask_mobile=mask_mobile, event_type="OTP_SENT", status="SUCCESS",
        method="MOBILE_OTP", role=role, mobile=mobile, request=request,
    )

    return {
        "success": True,
        "message": f"OTP sent to +91 {mobile}",
        "data": {
            "mobile": mobile,
            "expires_in": 600,
            "cooldown_seconds": otp_send_guard.cooldown,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/auth/mobile/verify-otp")
async def verify_otp(body: VerifyOtp, request: Request = None):
    """
    Verify the real Twilio Verify SMS OTP, then issue the existing TAXCO
    JWT for the resolved user. Twilio only proves the phone number was
    reached — it never issues, and is never trusted for, TAXCO's own
    role/authorization decisions.
    """

    mobile = normalize_mobile(body.mobile)
    role = str(body.role).strip().lower()
    otp = str(body.otp).strip()

    allowed_roles = {
        "admin",
        "employee",
        "customer",
        "agent",
    }

    if role not in allowed_roles:
        raise HTTPException(
            status_code=400,
            detail="Invalid portal role"
        )

    if not is_valid_indian_mobile(mobile):
        raise HTTPException(
            status_code=422,
            detail="Invalid mobile number"
        )

    if not otp:
        raise HTTPException(status_code=422, detail="Please enter the OTP.")

    twilio_client = get_twilio_client()
    e164_mobile = to_e164_india(mobile)

    try:
        verification_check = twilio_client.verify.v2.services(
            TWILIO_VERIFY_SERVICE_SID
        ).verification_checks.create(to=e164_mobile, code=otp)
    except TwilioRestException as e:
        logger.warning(f"Twilio verify-otp failed for {mask_mobile(mobile)}: code={e.code} status={e.status}")
        # Twilio returns 404 ("not found") once a verification has expired
        # or there is no pending verification for this number — treat that
        # the same as an invalid/expired OTP rather than a server error.
        if e.status == 404 or e.code == 20404:
            await security.record_login_audit(
                db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
                method="MOBILE_OTP", role=role, mobile=mobile, request=request, failure_reason="EXPIRED_OTP",
            )
            raise HTTPException(status_code=401, detail="OTP expired or not requested. Please request a new OTP.")
        if e.status == 429 or e.code == 20429:
            await security.record_login_audit(
                db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
                method="MOBILE_OTP", role=role, mobile=mobile, request=request, failure_reason="TWILIO_VERIFY_FAILED",
            )
            raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP and try again.")
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request, failure_reason="TWILIO_VERIFY_FAILED",
        )
        raise HTTPException(status_code=401, detail="Invalid OTP. Please try again.")
    except Exception:
        logger.exception(f"Unexpected error verifying OTP for {mask_mobile(mobile)}")
        raise HTTPException(status_code=502, detail="Unable to verify OTP right now. Please try again shortly.")

    if verification_check.status != "approved":
        logger.info(f"OTP not approved for {mask_mobile(mobile)}: status={verification_check.status}")
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
            method="MOBILE_OTP", role=role, mobile=mobile, request=request, failure_reason="INVALID_OTP",
        )
        raise HTTPException(status_code=401, detail="Invalid OTP. Please try again.")

    logger.info(f"OTP approved by Twilio for {mask_mobile(mobile)} (role={role})")

    # Find existing user by mobile + role
    user = await db.users.find_one(
        {
            "mobile": mobile,
            "role": role,
        },
        {
            "_id": 0,
        }
    )

    # SECURITY: Twilio only verifies that this phone number received the
    # SMS — it says nothing about which TAXCO role that phone should have.
    # Never let a caller mint themselves a brand-new Super Admin account
    # just by owning a phone number and claiming role="admin". Admin
    # accounts must already exist (seeded, or created by an existing
    # admin) before they can log in via mobile OTP.
    if not user and role == "admin":
        raise HTTPException(
            status_code=403,
            detail="This mobile number is not registered as a Super Admin.",
        )

    # If user doesn't exist, create a real MongoDB user.
    if not user:
        role_names = {
            "admin": "Super Admin",
            "employee": "Employee",
            "customer": "Customer",
            "agent": "Tax Consultant",
        }

        meta = {
            "portal_login": True,
            "otp_login": True,
        }
        name = role_names.get(role, "NTAXCO User")

        if role == "customer":
            customer_record = await db["erp_customers"].find_one({"mobile": mobile}, {"_id": 0})
            if customer_record:
                name = customer_record.get("business_name") or name
                meta["customer_id"] = customer_record["id"]

        if role == "agent":
            agent_record = await db["erp_agents"].find_one({"mobile": mobile}, {"_id": 0})
            if agent_record:
                name = agent_record.get("name") or name
                meta["agent_id"] = agent_record["id"]

        # If an admin has already created an employee profile with this mobile
        # number, link this login to that real employee record instead of
        # creating a disconnected generic account.
        if role == "employee":
            existing_employee = await db["erp_employees"].find_one({"mobile": mobile}, {"_id": 0})
            if existing_employee:
                name = existing_employee.get("name", name)
                meta.update({
                    "employee_id": existing_employee["id"],
                    "department": existing_employee.get("department"),
                    "designation": existing_employee.get("designation"),
                    "manager": existing_employee.get("manager"),
                })

        user = {
            "id": f"{role.upper()}-{uuid.uuid4().hex[:8].upper()}",
            "name": name,
            "email": None,
            "mobile": mobile,
            "role": role,
            "password_hash": None,
            "avatar": None,
            "meta": meta,
        }

        await db.users.insert_one(user)
    elif role == "employee" and not (user.get("meta") or {}).get("employee_id"):
        # Existing employee login without a linked profile yet — try to link
        # it now in case an admin has since created the matching employee record.
        existing_employee = await db["erp_employees"].find_one({"mobile": mobile}, {"_id": 0})
        if existing_employee:
            update = {
                "name": existing_employee.get("name", user.get("name")),
                "meta.employee_id": existing_employee["id"],
                "meta.department": existing_employee.get("department"),
                "meta.designation": existing_employee.get("designation"),
                "meta.manager": existing_employee.get("manager"),
            }
            await db.users.update_one({"id": user["id"]}, {"$set": update})
            user = await db.users.find_one({"id": user["id"]}, {"_id": 0})

    if user.get("is_blocked"):
        await security.record_login_audit(
            db, mask_mobile=mask_mobile, event_type="LOGIN_FAILED", status="FAILED",
            method="MOBILE_OTP", user=user, role=role, mobile=mobile, request=request,
            failure_reason="ACCOUNT_BLOCKED",
        )
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")

    return await auth_response(user, method="MOBILE_OTP", request=request)


@api_router.post("/auth/refresh")
async def refresh(body: RefreshReq):
    try:
        payload = jwt.decode(body.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        sid = payload.get("sid")
        if sid and not await security.is_session_active(db, sid):
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")
        return {
            "success": True,
            "message": "Token refreshed",
            "data": {"access_token": create_token(user["id"], user["role"], "access", session_id=sid)},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"success": True, "message": "OK", "data": public_user(user), "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    session_id = user.get("_session_id")
    if session_id:
        await security.close_session(db, session_id, "LOGGED_OUT")
    await security.record_login_audit(
        db, mask_mobile=mask_mobile, event_type="LOGOUT", status="SUCCESS",
        method=None, user=user, role=user.get("role"), request=request, session_id=session_id,
    )
    return {"success": True, "message": "Logged out successfully", "data": None, "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.get("/")
async def api_root():
    return {
        "message": "NTAXCO ERP API",
        "status": "running"
    }


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "ntaxco-erp", "timestamp": datetime.now(timezone.utc).isoformat()}


# ---------------- seeding ----------------
async def seed_users():
    """Provision only an explicitly configured Admin account on first startup.
    No Employee/Agent/Customer demo users are created automatically.
    """
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        logger.info("ADMIN_EMAIL/ADMIN_PASSWORD not configured; no admin account will be auto-created.")
        return
    admin_email = admin_email.strip().lower()
    existing = await db.users.find_one({"email": admin_email, "role": "admin"})
    if existing:
        return
    await db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:8].upper()}",
        "name": "Super Admin", "email": admin_email, "mobile": None, "role": "admin",
        "password_hash": hash_password(admin_password), "avatar": None,
        "meta": {"provisioned_by": "environment"}, "status": "active",
        "created_at": datetime.now(timezone.utc),
    })


@app.on_event("startup")
async def startup():
    # Verify MongoDB is actually reachable BEFORE anything else. If it
    # isn't, fail loudly with a specific, actionable log line instead of
    # letting create_index()/seeding hang (up to serverSelectionTimeoutMS)
    # and then raise a raw pymongo error. On most hosts a startup failure
    # here means the process exits and never binds to its port, so every
    # frontend request gets connection-refused — which is exactly the
    # generic "Network Error" this project is trying to eliminate. This
    # log line is what to check first when that happens.
    try:
        await client.admin.command("ping")
    except PyMongoError as e:
        logger.error(
            "Cannot reach MongoDB at the configured MONGO_URL (%s). The "
            "backend cannot start until this is fixed — every API request "
            "(including login) will otherwise fail with a connection error "
            "on the frontend. Check that MongoDB is running and reachable, "
            "and that MONGO_URL is correct. Original error: %s",
            _mask_mongo_url(mongo_url), e,
        )
        raise
    except Exception:
        # Anything other than a genuine pymongo connectivity error (e.g. a
        # mocked Mongo client in tests that doesn't implement admin
        # commands) — this check is a diagnostic aid only, so don't block
        # startup on it.
        pass
    await db.users.create_index("id", unique=True)
    # Prevents two real POST /api/auth/register accounts from ever sharing
    # an email+role pair (handles the race where two requests register
    # the same email concurrently). Scoped with partialFilterExpression to
    # ONLY real registered accounts (meta.registered == True) so it can
    # never collide with, or block, the pre-existing demo/OTP
    # placeholder-account flows, which don't set that flag and may
    # already contain duplicate emails across roles.
    await db.users.create_index(
        [("email", 1), ("role", 1)],
        unique=True,
        partialFilterExpression={"meta.registered": True},
        name="uniq_registered_email_role",
    )
    await seed_users()
    await seed_erp(db)
    await ensure_phase4_relationships(db)
    try:
        # Archive any "service" that is really an app/vendor name (e.g. StriveNest) and re-sync service names.
        from erp import quarantine_non_service_records
        _repair = await quarantine_non_service_records(db)
        if any(_repair.values()):
            logger.warning("Service data repair: %s", _repair)
    except Exception as exc:  # a cleanup problem must never stop the API from booting
        logger.warning("Service data repair skipped: %s", exc)
    try:
        from erp import ensure_status_model
        await ensure_status_model(db)
    except Exception as exc:  # a cleanup problem must never stop the API from booting
        logger.warning("Customer/booking status reconciliation skipped: %s", exc)
    await security.create_security_indexes(db)
    try:
        from erp import ensure_notification_indexes
        await ensure_notification_indexes(db)
    except Exception as exc:  # duplicates already in legacy data must not stop the API from booting
        logger.warning("Notification/booking duplicate-guard indexes not created: %s", exc)
    try:
        await db["erp_tasks"].create_index(
            [("task_board", 1), ("status", 1), ("priority", 1), ("employee_id", 1),
             ("customer_id", 1), ("service_id", 1), ("due_date", 1)],
            name="admin_task_filters",
        )
        await db["erp_task_activity"].create_index(
            [("task_id", 1), ("created_at", 1)], name="task_activity_history"
        )
    except Exception as exc:
        logger.warning("Task Board indexes not created: %s", exc)
    logger.info("NTAXCO ERP backend started, users seeded.")


app.include_router(api_router)
from erp import build_erp_router, seed_erp, ensure_phase4_relationships, _ok
from admin_profile import build_admin_profile_router
app.include_router(build_erp_router(db, get_current_user))
app.include_router(security.build_security_router(db, get_current_user, mask_mobile))
app.include_router(build_admin_profile_router(db, get_current_user))
from customer_import import build_customer_import_router
app.include_router(build_customer_import_router(db, get_current_user))
from starlette.middleware.cors import CORSMiddleware




@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
