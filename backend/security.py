"""NTAXCO ERP — Security & Authentication Monitoring module.

Adds a Login Audit trail + backend-managed Session tracking on top of the
existing authentication system, and the Super-Admin-only APIs that power
the Security Overview / Login Activity / Active Sessions pages.

This module does NOT implement authentication itself — it is called
*around* the existing email/password and mobile-OTP flows in server.py.
Nothing here talks to Twilio, generates tokens, or changes login rules.

Timezone note: all "today" / daily aggregations use IST (India Standard
Time, UTC+5:30), matching the rest of the ERP (see erp.py's _ist_now()).
Timestamps are still stored in real UTC in MongoDB; only the day
boundaries used for "today" queries are computed in IST.
"""
import re
import uuid
import logging
import csv
import io
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request, Query, Depends
from starlette.responses import StreamingResponse

logger = logging.getLogger(__name__)

IST_OFFSET = timedelta(hours=5, minutes=30)

# ---------------- constants ----------------
EVENT_TYPES = {
    "OTP_REQUESTED", "OTP_SENT", "OTP_SEND_FAILED", "OTP_VERIFICATION_FAILED",
    "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "SESSION_CREATED", "SESSION_TERMINATED",
}

AUTH_METHODS = {"MOBILE_OTP", "EMAIL_PASSWORD"}

SESSION_STATUSES = {"ACTIVE", "LOGGED_OUT", "EXPIRED", "TERMINATED"}

ROLE_NAMES = {"admin": "Super Admin", "employee": "Employee", "customer": "Customer", "agent": "Tax Consultant"}

# Only touch `last_activity` on a session at most this often, to avoid a
# write on every single authenticated API call.
ACTIVITY_UPDATE_INTERVAL = timedelta(minutes=2)


# ---------------- time helpers (IST, matching erp.py's convention) ----------------
def _ist_now() -> datetime:
    return datetime.now(timezone.utc) + IST_OFFSET


def _ist_day_range_utc(days_ago: int = 0):
    """(start, end) as real UTC instants bounding one IST calendar day."""
    ist_now = _ist_now()
    ist_day_start = ist_now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
    utc_start = ist_day_start - IST_OFFSET
    return utc_start, utc_start + timedelta(days=1)


# ---------------- request metadata helpers ----------------
def get_client_ip(request: Request) -> str:
    """Best-effort client IP, safe for a Render/Netlify-style deployment
    behind a reverse proxy.

    We trust X-Forwarded-For only for its FIRST entry (the original client,
    per the standard convention every proxy in this chain is expected to
    follow) and only because the app is deployed behind a known managed
    platform (Render) that sets this header itself — we are not exposing
    this to an arbitrary untrusted edge. If it's missing, fall back to the
    raw socket peer. If neither is available, return "Unknown" rather than
    fabricating a value.
    """
    if not request:
        return "Unknown"
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "Unknown"


_UA_OS_PATTERNS = [
    ("Windows", "Windows"), ("Mac OS X", "macOS"), ("Macintosh", "macOS"),
    ("Android", "Android"), ("iPhone", "iOS"), ("iPad", "iOS"), ("Linux", "Linux"),
]
_UA_BROWSER_PATTERNS = [
    ("Edg/", "Edge"), ("OPR/", "Opera"), ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"), ("Safari/", "Safari"),
]


def parse_user_agent(request: Request):
    """Lightweight User-Agent parse — no extra dependency needed for the
    coarse device/browser/OS categories the Security module displays."""
    ua = request.headers.get("user-agent", "") if request else ""
    os_name = "Unknown"
    for needle, label in _UA_OS_PATTERNS:
        if needle in ua:
            os_name = label
            break
    browser = "Unknown"
    for needle, label in _UA_BROWSER_PATTERNS:
        if needle in ua:
            # Chrome's UA also contains "Safari/"; order above resolves it.
            browser = label
            break
    device = "Mobile" if re.search(r"Mobi|Android|iPhone|iPad", ua) else "Desktop"
    return {"device": device, "browser": browser, "os": os_name}


def require_admin(user: dict) -> dict:
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


# ---------------- audit + session writers (called from server.py's auth endpoints) ----------------
async def record_login_audit(
    db, *, mask_mobile, event_type: str, status: str, method: str,
    user: dict = None, role: str = None, mobile: str = None, email: str = None,
    request: Request = None, session_id: str = None, failure_reason: str = None,
):
    """Insert one LoginAudit record. Never store OTPs/passwords/tokens —
    only a safe category string (failure_reason) and non-secret metadata."""
    ua_info = parse_user_agent(request) if request else {"device": None, "browser": None, "os": None}
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.get("id") if user else None,
        "user_name": (user.get("name") if user else None) or "Unknown User",
        "role": role or (user.get("role") if user else None),
        "mobile_masked": mask_mobile(mobile) if mobile else None,
        "email": email,
        "authentication_method": method,
        "event_type": event_type,
        "status": status,
        "login_time": datetime.now(timezone.utc) if status == "SUCCESS" and event_type == "LOGIN_SUCCESS" else None,
        "logout_time": None,
        "ip_address": get_client_ip(request) if request else "Unknown",
        "device": ua_info.get("device"),
        "browser": ua_info.get("browser"),
        "operating_system": ua_info.get("os"),
        "session_id": session_id,
        "failure_reason": failure_reason,
        "created_at": datetime.now(timezone.utc),
        "metadata": {},
    }
    try:
        await db.login_audits.insert_one(doc)
    except Exception:
        # Auditing must never break the actual login/logout flow.
        logger.exception("Failed to write login audit record")


async def create_user_session(db, *, user: dict, method: str, request: Request = None) -> dict:
    ua_info = parse_user_agent(request) if request else {"device": None, "browser": None, "os": None}
    now = datetime.now(timezone.utc)
    session = {
        "session_id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "role": user.get("role"),
        "authentication_method": method,
        "login_time": now,
        "last_activity": now,
        "logout_time": None,
        "ip_address": get_client_ip(request) if request else "Unknown",
        "device": ua_info.get("device"),
        "browser": ua_info.get("browser"),
        "operating_system": ua_info.get("os"),
        "status": "ACTIVE",
        "created_at": now,
        "expires_at": now + timedelta(days=7),  # matches refresh token lifetime
    }
    try:
        await db.user_sessions.insert_one(session)
    except Exception:
        logger.exception("Failed to create user session record")
    return session


async def touch_session_activity(db, session_id: str):
    """Throttled last_activity update — at most once per
    ACTIVITY_UPDATE_INTERVAL per session, to avoid a write on every request."""
    if not session_id:
        return
    try:
        cutoff = datetime.now(timezone.utc) - ACTIVITY_UPDATE_INTERVAL
        await db.user_sessions.update_one(
            {"session_id": session_id, "status": "ACTIVE", "last_activity": {"$lt": cutoff}},
            {"$set": {"last_activity": datetime.now(timezone.utc)}},
        )
    except Exception:
        logger.exception("Failed to update session activity")


async def is_session_active(db, session_id: str) -> bool:
    """Used by get_current_user() to enforce server-side revocation of an
    otherwise-stateless JWT once its session has been logged out/terminated."""
    if not session_id:
        # Tokens issued before this module existed (or refreshed without a
        # sid) carry no session — treat them as valid rather than locking
        # existing users out.
        return True
    try:
        session = await db.user_sessions.find_one({"session_id": session_id}, {"_id": 0, "status": 1})
    except Exception:
        logger.exception("Failed to check session status")
        return True
    if not session:
        return True
    return session.get("status") == "ACTIVE"


async def close_session(db, session_id: str, new_status: str):
    if not session_id or new_status not in SESSION_STATUSES:
        return
    try:
        await db.user_sessions.update_one(
            {"session_id": session_id, "status": "ACTIVE"},
            {"$set": {"status": new_status, "logout_time": datetime.now(timezone.utc)}},
        )
    except Exception:
        logger.exception("Failed to close session")


# ---------------- router ----------------
def build_security_router(db, get_current_user, mask_mobile) -> APIRouter:
    router = APIRouter(prefix="/api/admin/security")

    def _period_range(date_from: str = None, date_to: str = None):
        """Resolve the (start, end) UTC window for stat queries. Defaults
        to 'today' in IST when no explicit range is given."""
        if not date_from and not date_to:
            return _ist_day_range_utc(0)
        try:
            start = datetime.fromisoformat(date_from) if date_from else _ist_day_range_utc(0)[0]
            end = datetime.fromisoformat(date_to) if date_to else datetime.now(timezone.utc)
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            return start, end
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from/date_to (use ISO format)")

    @router.get("/overview")
    async def overview(user: dict = Depends(get_current_user)):
        require_admin(user)
        start, end = _ist_day_range_utc(0)
        created_range = {"created_at": {"$gte": start, "$lt": end}}

        today_logins = await db.login_audits.count_documents(
            {**created_range, "event_type": "LOGIN_SUCCESS"}
        )
        otp_requests = await db.login_audits.count_documents(
            {**created_range, "event_type": {"$in": ["OTP_SENT", "OTP_SEND_FAILED"]}}
        )
        failed_login_attempts = await db.login_audits.count_documents(
            {**created_range, "event_type": "LOGIN_FAILED"}
        )
        active_sessions = await db.user_sessions.count_documents({"status": "ACTIVE"})
        blocked_accounts = await db.users.count_documents({"is_blocked": True})

        return {
            "success": True,
            "message": "OK",
            "data": {
                "today_logins": today_logins,
                "otp_requests": otp_requests,
                "failed_login_attempts": failed_login_attempts,
                "active_sessions": active_sessions,
                "blocked_accounts": blocked_accounts,
                "timezone": "IST (UTC+5:30)",
                "period": {"from": start.isoformat(), "to": end.isoformat()},
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @router.get("/login-trend")
    async def login_trend(user: dict = Depends(get_current_user)):
        """Successful logins per day for the last 7 IST days, for the
        Security Overview trend chart."""
        require_admin(user)
        days = []
        for i in range(6, -1, -1):
            start, end = _ist_day_range_utc(i)
            count = await db.login_audits.count_documents(
                {"created_at": {"$gte": start, "$lt": end}, "event_type": "LOGIN_SUCCESS"}
            )
            days.append({"date": start.strftime("%Y-%m-%d"), "label": (start + IST_OFFSET).strftime("%a"), "logins": count})
        return {"success": True, "message": "OK", "data": days, "timestamp": datetime.now(timezone.utc).isoformat()}

    def _build_activity_filter(role, method, status, search, date_from, date_to):
        q = {}
        if role and role != "all":
            q["role"] = role
        if method and method != "all":
            q["authentication_method"] = method
        if status and status != "all":
            q["status"] = status.upper()
        if date_from or date_to:
            start, end = _period_range(date_from, date_to)
            q["created_at"] = {"$gte": start, "$lt": end}
        if search:
            regex = {"$regex": re.escape(search), "$options": "i"}
            q["$or"] = [{"user_name": regex}, {"email": regex}]
        # Only ever show actual login/logout events, not internal OTP-send noise,
        # in the main activity table.
        q["event_type"] = {"$in": ["LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT"]}
        return q

    def _serialize_audit(a: dict) -> dict:
        return {
            "id": a.get("id"),
            "user_name": a.get("user_name"),
            "role": a.get("role"),
            "role_label": ROLE_NAMES.get(a.get("role"), a.get("role")),
            "authentication_method": a.get("authentication_method"),
            "mobile_masked": a.get("mobile_masked"),
            "email": a.get("email"),
            "event_type": a.get("event_type"),
            "status": a.get("status"),
            "login_time": a.get("login_time").isoformat() if a.get("login_time") else None,
            "logout_time": a.get("logout_time").isoformat() if a.get("logout_time") else None,
            "created_at": a.get("created_at").isoformat() if a.get("created_at") else None,
            "ip_address": a.get("ip_address"),
            "device": a.get("device"),
            "browser": a.get("browser"),
            "operating_system": a.get("operating_system"),
            "failure_reason": a.get("failure_reason"),
        }

    @router.get("/login-activity")
    async def login_activity(
        user: dict = Depends(get_current_user),
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        search: str = Query(None),
        role: str = Query(None),
        method: str = Query(None),
        status: str = Query(None),
        date_from: str = Query(None),
        date_to: str = Query(None),
    ):
        require_admin(user)
        q = _build_activity_filter(role, method, status, search, date_from, date_to)
        total = await db.login_audits.count_documents(q)
        cursor = (
            db.login_audits.find(q, {"_id": 0})
            .sort("created_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        rows = [_serialize_audit(a) async for a in cursor]
        return {
            "success": True,
            "message": "OK",
            "data": rows,
            "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit if limit else 0},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @router.get("/recent-activity")
    async def recent_activity(user: dict = Depends(get_current_user), limit: int = Query(10, ge=1, le=50)):
        require_admin(user)
        q = {"event_type": {"$in": ["LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT"]}}
        cursor = db.login_audits.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
        rows = [_serialize_audit(a) async for a in cursor]
        return {"success": True, "message": "OK", "data": rows, "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.get("/login-activity/export")
    async def export_login_activity(
        user: dict = Depends(get_current_user),
        role: str = Query(None),
        method: str = Query(None),
        status: str = Query(None),
        date_from: str = Query(None),
        date_to: str = Query(None),
    ):
        require_admin(user)
        q = _build_activity_filter(role, method, status, None, date_from, date_to)
        cursor = db.login_audits.find(q, {"_id": 0}).sort("created_at", -1).limit(5000)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["User", "Role", "Authentication Method", "Status", "Login Time", "Logout Time",
                          "Device", "Browser", "Operating System", "IP", "Failure Reason"])
        async for a in cursor:
            writer.writerow([
                a.get("user_name"), ROLE_NAMES.get(a.get("role"), a.get("role")), a.get("authentication_method"),
                a.get("status"), a.get("login_time"), a.get("logout_time"), a.get("device"), a.get("browser"),
                a.get("operating_system"), a.get("ip_address"), a.get("failure_reason") or "",
            ])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=login-activity.csv"},
        )

    @router.get("/sessions")
    async def sessions(user: dict = Depends(get_current_user), current_session_id: str = Query(None)):
        require_admin(user)
        cursor = db.user_sessions.find({"status": "ACTIVE"}, {"_id": 0}).sort("last_activity", -1)
        rows = []
        async for s in cursor:
            rows.append({
                "session_id": s.get("session_id"),
                "user_id": s.get("user_id"),
                "user_name": s.get("user_name"),
                "role": s.get("role"),
                "role_label": ROLE_NAMES.get(s.get("role"), s.get("role")),
                "authentication_method": s.get("authentication_method"),
                "login_time": s.get("login_time").isoformat() if s.get("login_time") else None,
                "last_activity": s.get("last_activity").isoformat() if s.get("last_activity") else None,
                "device": s.get("device"),
                "browser": s.get("browser"),
                "ip_address": s.get("ip_address"),
                "status": s.get("status"),
                "is_current": s.get("session_id") == current_session_id,
            })
        return {"success": True, "message": "OK", "data": {"sessions": rows}, "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.post("/sessions/{session_id}/terminate")
    async def terminate_session(session_id: str, user: dict = Depends(get_current_user)):
        require_admin(user)
        session = await db.user_sessions.find_one({"session_id": session_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.get("status") != "ACTIVE":
            raise HTTPException(status_code=400, detail="Session is not active")
        await close_session(db, session_id, "TERMINATED")
        await record_login_audit(
            db, mask_mobile=mask_mobile, event_type="SESSION_TERMINATED", status="SUCCESS",
            method=session.get("authentication_method"), role=session.get("role"),
            session_id=session_id, failure_reason=None,
        )
        return {"success": True, "message": "Session terminated successfully", "data": None, "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.post("/users/{user_id}/block")
    async def block_user(user_id: str, admin: dict = Depends(get_current_user)):
        require_admin(admin)
        result = await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": True}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": "Account blocked", "data": None, "timestamp": datetime.now(timezone.utc).isoformat()}

    @router.post("/users/{user_id}/unblock")
    async def unblock_user(user_id: str, admin: dict = Depends(get_current_user)):
        require_admin(admin)
        result = await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": False}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": "Account unblocked", "data": None, "timestamp": datetime.now(timezone.utc).isoformat()}

    return router


async def create_security_indexes(db):
    await db.login_audits.create_index("created_at")
    await db.login_audits.create_index("user_id")
    await db.login_audits.create_index("role")
    await db.login_audits.create_index("status")
    await db.login_audits.create_index("authentication_method")
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("status")
    await db.user_sessions.create_index("last_activity")
    await db.user_sessions.create_index("session_id", unique=True)
