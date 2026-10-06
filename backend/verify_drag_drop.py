#!/usr/bin/env python3
"""Verify POST /api/admin/workflows/drag-drop for all 8 Admin -> Customers targets
against a RUNNING NTAXCO backend and its real MongoDB. Read-only on the source tree.

  pip install requests
  python verify_drag_drop.py --base http://localhost:8001 --email ADMIN_EMAIL --password ADMIN_PASSWORD [--customer CUS-XXXX]

Uses only existing endpoints: POST /api/auth/admin/login, GET /api/customers, GET /api/services,
POST /api/admin/workflows/drag-drop, GET /api/customers/{id}, GET /api/admin/customers/summary,
GET /api/admin/customers/{id}/overview. The customer's original values are restored at the end.
"""
import argparse, json, sys, requests

ap = argparse.ArgumentParser()
ap.add_argument("--base", default="http://localhost:8001")
ap.add_argument("--email", required=True)
ap.add_argument("--password", required=True)
ap.add_argument("--customer", help="real customer id (default: first customer returned)")
a = ap.parse_args()
B = a.base.rstrip("/")

s = requests.Session()
r = s.post(f"{B}/api/auth/admin/login", json={"email": a.email, "password": a.password}, timeout=30)
if r.status_code != 200:
    sys.exit(f"LOGIN FAILED HTTP {r.status_code}: {r.text}")
tok = r.json().get("access_token") or r.json().get("data", {}).get("access_token")
s.headers["Authorization"] = f"Bearer {tok}"

def get(path, **kw):
    r = s.get(f"{B}/api{path}", timeout=30, **kw)
    r.raise_for_status()
    return r.json()

custs = get("/customers", params={"page": 1, "page_size": 500})["data"]
cust = next((c for c in custs if c["id"] == a.customer), None) if a.customer else (custs[0] if custs else None)
if not cust:
    sys.exit("No real customer found in MongoDB")
cid = cust["id"]
services = get("/services", params={"page": 1, "page_size": 500})["data"]

def pick(cat, aliases=()):
    want = {cat.lower(), *aliases}
    live = [x for x in services if str(x.get("status", "")).lower() not in ("inactive", "disabled")]
    hit = next((x for x in live if str(x.get("category", "")).strip().lower() in want), None) \
        or next((x for x in live if str(x.get("name") or x.get("title") or "").strip().lower() in want), None)
    return hit["id"] if hit else None

targets = [
    ("Pending", "payment-status", "Pending"),
    ("Processing", "payment-status", "Processing"),
    ("Completed", "payment-status", "Completed"),
    ("Yearly Payment", "payment-frequency", "Yearly"),
    ("GST Customer", "service", pick("GST")),
    ("TDS Customer", "service", pick("TDS")),
    ("Income Tax Customer", "service", pick("Income Tax", ("income-tax", "itr"))),
    ("New Customer", "status", "Active"),
]
orig = {k: cust.get(k) for k in ("filing_status", "payment_frequency", "service_id", "service_type", "status")}
print(f"Customer {cid} ({cust.get('business_name')}) original: {orig}\n")

results = []
for label, ttype, tval in targets:
    payload = {"source_type": "customer", "target_type": ttype, "source_id": cid, "target_value": tval}
    if not tval:
        results.append((label, "FAIL", f"no matching service in GET /api/services")); continue
    r = s.post(f"{B}/api/admin/workflows/drag-drop", json=payload, timeout=60)
    try: body = r.json()
    except Exception: body = r.text
    fresh = get(f"/customers/{cid}")["data"]
    summ = get("/admin/customers/summary")["data"]
    ov = get(f"/admin/customers/{cid}/overview")["data"]
    check = {"payment-status": fresh.get("filing_status") == tval,
             "payment-frequency": fresh.get("payment_frequency") == tval,
             "service": fresh.get("service_id") == tval,
             "status": fresh.get("status") == tval}[ttype]
    ok = r.status_code == 200 and check
    results.append((label, "PASS" if ok else "FAIL", f"HTTP {r.status_code}"))
    print(f"=== {label}\nPAYLOAD  {json.dumps(payload)}\nHTTP     {r.status_code}\n"
          f"RESPONSE {json.dumps(body)[:600]}\nMONGO    persisted={check} customer={ {k: fresh.get(k) for k in orig} }\n"
          f"SUMMARY  {summ}\nOVERVIEW bookings={ov.get('booking_count')} services={len(ov.get('services', []))}\n")

# restore original values via the same endpoint
for ttype, key in (("payment-status", "filing_status"), ("payment-frequency", "payment_frequency"),
                   ("service", "service_id"), ("status", "status")):
    if orig.get(key):
        s.post(f"{B}/api/admin/workflows/drag-drop", json={"source_type": "customer", "target_type": ttype,
               "source_id": cid, "target_value": orig[key]}, timeout=60)

print("RESULTS"); [print(f"  {l:22} {st}  {d}") for l, st, d in results]
sys.exit(0 if all(st == "PASS" for _, st, _ in results) else 1)
