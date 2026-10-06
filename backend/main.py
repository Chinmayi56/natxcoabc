"""
NTAXCO ERP backend — canonical ASGI entrypoint.

The real, fully-wired FastAPI app (auth, ERP CRUD, bookings, payments,
CORS, MongoDB startup) lives in server.py. This file used to define its
own separate, incomplete FastAPI app with no booking/payment routes at
all — if the backend was started with `uvicorn main:app` instead of
`uvicorn server:app`, every /api/bookings and /api/payments/* call
would 404, which looked like (and was reported as) a "Network Error"
in the frontend.

To remove that footgun without touching server.py's behavior, main.py
now simply re-exports the real app, so both

    uvicorn main:app --host 0.0.0.0 --port 8001
    uvicorn server:app --host 0.0.0.0 --port 8001

start the exact same, fully-functional backend.
"""

from server import app  # noqa: F401  (re-exported for `uvicorn main:app`)
