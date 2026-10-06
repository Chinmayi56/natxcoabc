"""NTAXCO ERP - Mobile OTP *send* guard.

Why this exists
---------------
POST /api/auth/mobile/send-otp used to forward every request straight to
Twilio Verify. Twilio enforces its own limit (about 5 sends per phone number
per 10 minutes) and answers 429 once it is hit. Because the frontend could
fire the same request more than once per click (double click / Enter + click,
no in-flight lock), a handful of normal test clicks burned the whole Twilio
quota and every later Send OTP returned 429 with a vague message.

This guard sits in front of Twilio and:
  * collapses concurrent duplicate requests for the same mobile into ONE
    Twilio call (the duplicates receive the same outcome),
  * enforces a short per-mobile cooldown between sends,
  * enforces a windowed cap per mobile and per client IP that stays below
    Twilio's own limit, and
  * returns a precise "try again in N seconds" answer instead of a vague 429.

Only SUCCESSFUL sends count against the caps, so Twilio/network failures
never lock a user out. OTP security is unchanged: the OTP is still generated,
sent and verified entirely by Twilio Verify.

State is in-process (single uvicorn worker, as in the Procfile). With several
workers each keeps its own counters; Twilio remains the global backstop.

Tunable via environment (defaults are safe for production):
  OTP_SEND_COOLDOWN_SECONDS      min gap between sends to one mobile   (30)
  OTP_SEND_MAX_PER_WINDOW        sends per mobile per window           (5)
  OTP_SEND_WINDOW_SECONDS        window length                         (600)
  OTP_SEND_IP_MAX_PER_WINDOW     sends per client IP per window        (30)
  OTP_TWILIO_LOCK_SECONDS        local lock after a Twilio 429         (600)
"""
import asyncio
import os
import time
from collections import deque
from typing import Dict, Deque, Optional, Tuple


def _env_int(name: str, default: int) -> int:
    try:
        value = int(str(os.getenv(name, default)).strip())
        return value if value >= 0 else default
    except (TypeError, ValueError):
        return default


class OtpSendGuard:
    def __init__(self):
        self.reload_config()
        self._sends_by_mobile: Dict[str, Deque[float]] = {}
        self._sends_by_ip: Dict[str, Deque[float]] = {}
        self._locked_until: Dict[str, float] = {}
        self._inflight: Dict[str, "asyncio.Task"] = {}

    def reload_config(self):
        self.cooldown = _env_int("OTP_SEND_COOLDOWN_SECONDS", 30)
        self.max_per_window = _env_int("OTP_SEND_MAX_PER_WINDOW", 5)
        self.window = _env_int("OTP_SEND_WINDOW_SECONDS", 600)
        self.ip_max_per_window = _env_int("OTP_SEND_IP_MAX_PER_WINDOW", 30)
        self.twilio_lock = _env_int("OTP_TWILIO_LOCK_SECONDS", 600)

    def reset(self):
        """Clear all state (used by tests)."""
        self._sends_by_mobile.clear()
        self._sends_by_ip.clear()
        self._locked_until.clear()
        self._inflight.clear()

    # ---- helpers ----
    def _prune(self, q: Deque[float], now: float):
        while q and now - q[0] >= self.window:
            q.popleft()

    # ---- in-flight de-duplication ----
    def get_inflight(self, mobile: str) -> Optional["asyncio.Task"]:
        task = self._inflight.get(mobile)
        if task is not None and task.done():
            self._inflight.pop(mobile, None)
            return None
        return task

    def set_inflight(self, mobile: str, task: "asyncio.Task"):
        self._inflight[mobile] = task

    def clear_inflight(self, mobile: str, task: "asyncio.Task"):
        if self._inflight.get(mobile) is task:
            self._inflight.pop(mobile, None)

    # ---- limit check ----
    def check(self, mobile: str, ip: str) -> Optional[Tuple[int, str]]:
        """Return None if a send is allowed, else (retry_after_seconds, reason).

        reason is one of: "cooldown", "mobile_limit", "ip_limit", "provider_limit".
        """
        now = time.monotonic()

        locked = self._locked_until.get(mobile)
        if locked is not None:
            if locked > now:
                return (max(1, int(locked - now + 0.999)), "provider_limit")
            self._locked_until.pop(mobile, None)

        q = self._sends_by_mobile.get(mobile)
        if q:
            self._prune(q, now)
            if q:
                since_last = now - q[-1]
                if self.cooldown and since_last < self.cooldown:
                    return (max(1, int(self.cooldown - since_last + 0.999)), "cooldown")
                if self.max_per_window and len(q) >= self.max_per_window:
                    return (max(1, int(self.window - (now - q[0]) + 0.999)), "mobile_limit")

        if ip and self.ip_max_per_window:
            iq = self._sends_by_ip.get(ip)
            if iq:
                self._prune(iq, now)
                if len(iq) >= self.ip_max_per_window:
                    return (max(1, int(self.window - (now - iq[0]) + 0.999)), "ip_limit")

        return None

    # ---- outcome recording ----
    def record_success(self, mobile: str, ip: str):
        now = time.monotonic()
        self._sends_by_mobile.setdefault(mobile, deque()).append(now)
        if ip:
            self._sends_by_ip.setdefault(ip, deque()).append(now)

    def record_provider_limit(self, mobile: str):
        """Twilio itself said 429 - stop forwarding more requests for a while."""
        if self.twilio_lock:
            self._locked_until[mobile] = time.monotonic() + self.twilio_lock

    # ---- user-facing text ----
    @staticmethod
    def format_wait(seconds: int) -> str:
        seconds = max(1, int(seconds))
        if seconds < 60:
            return f"{seconds} second{'s' if seconds != 1 else ''}"
        minutes = (seconds + 59) // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''}"

    def message(self, reason: str, retry_after: int) -> str:
        wait = self.format_wait(retry_after)
        if reason == "cooldown":
            return f"An OTP was sent just now. Please wait {wait} before requesting another one."
        if reason == "ip_limit":
            return f"Too many OTP requests from this network. Please try again in {wait}."
        return f"Too many OTP requests for this number. Please try again in {wait}."


otp_send_guard = OtpSendGuard()
