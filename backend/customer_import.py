"""NTAXCO ERP — Admin Customers Import module.

Adds Admin -> Customers -> Import: upload a CSV/XLSX/XLS/PDF of existing
customer data, preview + column-map it against the real `erp_customers`
schema (same collection/fields used by erp.py's generic customers CRUD),
then confirm to insert only valid, non-duplicate rows into the real
MongoDB database.

Like admin_profile.py and security.py, this module does not implement its
own auth: it is built entirely on top of the existing `get_current_user`
dependency from server.py and reuses the same `erp_customers` collection
and `CUS-XXXXXX` id scheme as erp.py's generic customer CRUD, so imported
customers are indistinguishable from customers created by hand and show up
immediately in the existing Admin -> Customers list.

Nothing is ever written to MongoDB during /preview or /remap — those are
pure parse + validate + duplicate-check calls. Only /confirm inserts.
"""
import csv
import io
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

# Accept the same admin-role spellings used throughout server.py/erp.py/admin_profile.py.
ADMIN_ROLES = {"admin", "super_admin", "superadmin"}


def _require_admin(user: dict):
    if str((user or {}).get("role", "")).lower() not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can import customers")


MAX_IMPORT_FILE_BYTES = 10_000_000  # ~10MB raw upload
MAX_IMPORT_ROWS = 5000
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls", "pdf"}

# Mirrors CUSTOMER_FIELDS in frontend/src/pages/admin/CustomerManagement.jsx —
# the same field keys the existing Add/Edit Customer form and erp_customers
# schema use, so mapped/imported rows line up with the existing UI exactly.
CUSTOMER_IMPORT_FIELDS = [
    {"key": "cust_id", "label": "Customer ID", "required": False},
    {"key": "business_name", "label": "Business / Company Name", "required": True},
    {"key": "business_type", "label": "Customer Type", "required": False},
    {"key": "status", "label": "Customer Status", "required": False},
    {"key": "assigned_employee", "label": "Consultant / Assigned Employee", "required": False},
    {"key": "registration_date", "label": "Registration Date", "required": False},
    {"key": "gst_number", "label": "GSTIN", "required": False},
    {"key": "pan", "label": "PAN", "required": False},
    {"key": "tan", "label": "TAN", "required": False},
    {"key": "cin", "label": "CIN", "required": False},
    {"key": "service_type", "label": "Primary Service", "required": False},
    {"key": "state", "label": "State", "required": False},
    {"key": "city", "label": "City", "required": False},
    {"key": "pincode", "label": "Pincode", "required": False},
    {"key": "address", "label": "Address", "required": False},
    {"key": "owner", "label": "Primary Contact Name", "required": False},
    {"key": "designation", "label": "Designation", "required": False},
    {"key": "mobile", "label": "Mobile Number", "required": False},
    {"key": "alternate_mobile", "label": "Alternate Mobile Number", "required": False},
    {"key": "email", "label": "Email", "required": False},
    {"key": "alternate_email", "label": "Alternate Email", "required": False},
    {"key": "website", "label": "Website", "required": False},
    {"key": "assigned_agent", "label": "Assigned Agent", "required": False},
    {"key": "outstanding", "label": "Outstanding (\u20b9)", "required": False},
    {"key": "payment_frequency", "label": "Payment Frequency", "required": False},
    {"key": "filing_status", "label": "Payment / Filing Status", "required": False},
    {"key": "notes", "label": "Notes", "required": False},
]
REQUIRED_FIELDS = {f["key"] for f in CUSTOMER_IMPORT_FIELDS if f["required"]}
VALID_FIELD_KEYS = {f["key"] for f in CUSTOMER_IMPORT_FIELDS}

# ---------------- header -> field auto-mapping ----------------


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


ALIAS_MAP = {
    "customerid": "cust_id", "custid": "cust_id", "id": "cust_id", "clientid": "cust_id",
    "businessname": "business_name", "companyname": "business_name", "customername": "business_name",
    "clientname": "business_name", "firmname": "business_name", "name": "business_name",
    "businesstype": "business_type", "customertype": "business_type", "entitytype": "business_type", "type": "business_type",
    "status": "status", "customerstatus": "status",
    "assignedemployee": "assigned_employee", "employee": "assigned_employee", "consultant": "assigned_employee",
    "registrationdate": "registration_date", "regdate": "registration_date", "dateofregistration": "registration_date",
    "gstno": "gst_number", "gstnumber": "gst_number", "gstin": "gst_number", "gst": "gst_number",
    "pan": "pan", "panno": "pan", "pannumber": "pan",
    "tan": "tan", "tanno": "tan",
    "cin": "cin", "cinno": "cin",
    "servicetype": "service_type", "service": "service_type", "primaryservice": "service_type",
    "state": "state",
    "city": "city",
    "pincode": "pincode", "pin": "pincode", "zipcode": "pincode", "postalcode": "pincode",
    "address": "address", "fulladdress": "address",
    "contactname": "owner", "contactperson": "owner", "ownername": "owner",
    "primarycontact": "owner", "primarycontactname": "owner",
    "designation": "designation",
    "mobile": "mobile", "mobileno": "mobile", "mobilenumber": "mobile", "phone": "mobile",
    "phoneno": "mobile", "phonenumber": "mobile", "contactno": "mobile", "contactnumber": "mobile",
    "alternatemobile": "alternate_mobile", "altmobile": "alternate_mobile", "secondarymobile": "alternate_mobile",
    "email": "email", "emailaddress": "email", "emailid": "email",
    "alternateemail": "alternate_email", "altemail": "alternate_email", "secondaryemail": "alternate_email",
    "website": "website", "websiteurl": "website",
    "assignedagent": "assigned_agent", "agent": "assigned_agent",
    "outstanding": "outstanding", "outstandingamount": "outstanding", "balance": "outstanding",
    "outstandingbalance": "outstanding",
    "paymentfrequency": "payment_frequency", "frequency": "payment_frequency", "billingfrequency": "payment_frequency",
    "filingstatus": "filing_status", "paymentstatus": "filing_status", "paymentfilingstatus": "filing_status",
    "notes": "notes", "remarks": "notes", "comments": "notes",
}


def _guess_field(header: str):
    return ALIAS_MAP.get(_norm(header))


def _dedupe_headers(headers):
    seen = {}
    out = []
    for h in headers:
        label = str(h or "").strip() or "Column"
        if label in seen:
            seen[label] += 1
            out.append(f"{label} ({seen[label]})")
        else:
            seen[label] = 1
            out.append(label)
    return out


# ---------------- file parsers: each returns (headers, rows[dict]) ----------------


def _parse_csv(raw: bytes):
    text = raw.decode("utf-8-sig", errors="replace")
    lines = [l for l in text.splitlines() if l.strip() != ""]
    if not lines:
        raise HTTPException(status_code=400, detail="The CSV file is empty")
    sample = "\n".join(lines[:10])
    delim_counts = {d: sample.count(d) for d in (",", ";", "\t", "|")}
    delimiter = max(delim_counts, key=delim_counts.get) if max(delim_counts.values()) > 0 else ","
    try:
        rows_raw = list(csv.reader(lines, delimiter=delimiter))
    except csv.Error:
        raise HTTPException(status_code=400, detail="The CSV file could not be parsed. Please check its formatting.")
    if not rows_raw or not any(str(c).strip() for c in rows_raw[0]):
        raise HTTPException(status_code=400, detail="The CSV file has no readable header row")
    headers = _dedupe_headers(rows_raw[0])
    data_rows = []
    for r in rows_raw[1:]:
        if not any(str(c).strip() for c in r):
            continue
        data_rows.append({h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(headers)})
    return headers, data_rows


def _rows_to_table(all_rows, kind: str):
    non_blank = [r for r in all_rows if r and any(str(c).strip() for c in r if c is not None)]
    if not non_blank:
        raise HTTPException(status_code=400, detail=f"The {kind.upper()} file has no data")
    headers = _dedupe_headers([str(c).strip() if c is not None else "" for c in non_blank[0]])
    data_rows = []
    for r in non_blank[1:]:
        if not any(str(c).strip() for c in r if c is not None):
            continue
        row = {}
        for i, h in enumerate(headers):
            v = r[i] if i < len(r) else ""
            row[h] = "" if v is None else str(v).strip()
        data_rows.append(row)
    return headers, data_rows


def _parse_xlsx(raw: bytes):
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="XLSX support is not installed on the server")
    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
        all_rows = list(wb.worksheets[0].iter_rows(values_only=True))
        wb.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The Excel (.xlsx) file could not be read. It may be corrupted or password-protected.")
    return _rows_to_table(all_rows, "xlsx")


def _parse_xls(raw: bytes):
    try:
        import xlrd
    except ImportError:
        raise HTTPException(status_code=500, detail="XLS support is not installed on the server")
    try:
        wb = xlrd.open_workbook(file_contents=raw)
        sheet = wb.sheet_by_index(0)
        all_rows = [sheet.row_values(i) for i in range(sheet.nrows)]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="The Excel (.xls) file could not be read. It may be corrupted or password-protected.")
    return _rows_to_table(all_rows, "xls")


_KV_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9 /_.-]{1,40}?)\s*[:\-]\s*(.+?)\s*$")


def _parse_pdf(raw: bytes):
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF support is not installed on the server")
    try:
        pdf = pdfplumber.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(status_code=400, detail="The PDF file could not be opened. It may be corrupted or password-protected.")

    all_text = ""
    tables = []
    try:
        for page in pdf.pages:
            for t in (page.extract_tables() or []):
                if t and len(t) > 1:
                    tables.append(t)
            all_text += (page.extract_text() or "") + "\n"
    finally:
        pdf.close()

    # 1) Prefer an actual detected table (largest one on any page).
    if tables:
        table = max(tables, key=len)
        headers = _dedupe_headers([str(c).strip() if c else "" for c in table[0]])
        data_rows = []
        for r in table[1:]:
            if not any(str(c).strip() for c in r if c):
                continue
            data_rows.append({h: ("" if i >= len(r) or r[i] is None else str(r[i]).strip()) for i, h in enumerate(headers)})
        if data_rows:
            return headers, data_rows

    if not all_text.strip():
        raise HTTPException(
            status_code=400,
            detail="This PDF appears to be scanned or image-only and contains no extractable text. "
                   "OCR is required before it can be imported — please upload a text-based PDF, CSV or Excel file instead.",
        )

    # 2) Fall back to "Field: Value" blocks, one customer per blank-line-separated block.
    blocks = re.split(r"\n\s*\n", all_text.strip())
    field_order = []
    data_rows = []
    for block in blocks:
        row = {}
        for line in block.splitlines():
            m = _KV_LINE.match(line)
            if m:
                key, val = m.group(1).strip(), m.group(2).strip()
                if key and val:
                    row[key] = val
                    if key not in field_order:
                        field_order.append(key)
        if row:
            data_rows.append(row)
    if data_rows:
        headers = field_order
        return headers, [{h: row.get(h, "") for h in headers} for row in data_rows]

    # 3) Fall back to a tab/pipe-delimited header + rows embedded in the text.
    lines = [l for l in all_text.splitlines() if l.strip()]
    if len(lines) >= 2:
        for delim in ("\t", "|"):
            if delim in lines[0]:
                headers = _dedupe_headers([c.strip() for c in lines[0].split(delim)])
                rows = []
                for l in lines[1:]:
                    cells = l.split(delim)
                    if not any(c.strip() for c in cells):
                        continue
                    rows.append({h: (cells[i].strip() if i < len(cells) else "") for i, h in enumerate(headers)})
                if rows:
                    return headers, rows

    raise HTTPException(
        status_code=400,
        detail="Could not detect customer records in this PDF. Please ensure it contains a text-based table, "
               "or export the data as CSV or Excel instead.",
    )


def _parse_file(filename: str, raw: bytes):
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "").lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload CSV, XLSX, XLS or PDF.")
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(raw) > MAX_IMPORT_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File is too large. Please upload a file under 10MB.")
    parser = {"csv": _parse_csv, "xlsx": _parse_xlsx, "xls": _parse_xls, "pdf": _parse_pdf}[ext]
    headers, rows = parser(raw)
    if not rows:
        raise HTTPException(status_code=400, detail="No customer rows were found in this file")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"This file has {len(rows)} rows, which exceeds the {MAX_IMPORT_ROWS}-row import limit. Please split it into smaller files.",
        )
    return headers, rows


def _auto_mapping(headers):
    mapping, used = {}, set()
    for h in headers:
        guess = _guess_field(h)
        mapping[h] = guess if (guess and guess not in used) else None
        if mapping[h]:
            used.add(mapping[h])
    return mapping


def _apply_mapping(row: dict, mapping: dict):
    mapped = {}
    for header, value in (row or {}).items():
        field = (mapping or {}).get(header)
        if field and field in VALID_FIELD_KEYS:
            value = str(value or "").strip()
            if value:
                mapped[field] = value
    return mapped


def _row_status(mapped: dict, seen_keys: set, existing_lookup: dict):
    errors = [f"{req.replace('_', ' ').title()} is required" for req in REQUIRED_FIELDS if not mapped.get(req)]
    if errors:
        return "invalid", errors

    keys = [(k, str(mapped[k]).strip().lower()) for k in ("cust_id", "email", "mobile") if mapped.get(k)]
    for k, v in keys:
        if (k, v) in seen_keys:
            return "duplicate", [f"Duplicate {k.replace('_', ' ')} within the uploaded file"]
        if existing_lookup.get((k, v)):
            return "duplicate", [f"A customer with this {k.replace('_', ' ')} already exists"]
    for k, v in keys:
        seen_keys.add((k, v))
    return "ready", []


def build_customer_import_router(db, get_current_user):
    router = APIRouter(prefix="/api/admin/customers/import")

    async def _existing_lookup(mapped_rows):
        ids = {r["cust_id"].strip().lower() for r in mapped_rows if r.get("cust_id")}
        emails = {r["email"].strip().lower() for r in mapped_rows if r.get("email")}
        mobiles = {r["mobile"].strip() for r in mapped_rows if r.get("mobile")}
        lookup = {}
        or_clauses = []
        if ids:
            or_clauses += [{"cust_id": {"$in": list(ids)}}, {"id": {"$in": [i.upper() for i in ids] + list(ids)}}]
        if emails:
            or_clauses.append({"email": {"$in": list(emails)}})
        if mobiles:
            or_clauses.append({"mobile": {"$in": list(mobiles)}})
        if not or_clauses:
            return lookup
        try:
            cursor = db["erp_customers"].find(
                {"$or": or_clauses}, {"_id": 0, "cust_id": 1, "id": 1, "email": 1, "mobile": 1}
            )
            async for doc in cursor:
                if doc.get("cust_id"):
                    lookup[("cust_id", str(doc["cust_id"]).strip().lower())] = True
                if doc.get("id"):
                    lookup[("cust_id", str(doc["id"]).strip().lower())] = True
                if doc.get("email"):
                    lookup[("email", str(doc["email"]).strip().lower())] = True
                if doc.get("mobile"):
                    lookup[("mobile", str(doc["mobile"]).strip())] = True
        except Exception:
            raise HTTPException(status_code=503, detail="Could not reach the database to check for duplicate customers. Please try again.")
        return lookup

    def _build_preview(raw_rows, mapping, existing_lookup):
        mapped_rows = [_apply_mapping(r, mapping) for r in raw_rows]
        seen_keys = set()
        preview_rows = []
        counts = {"ready": 0, "duplicate": 0, "invalid": 0}
        for i, (raw_row, mapped) in enumerate(zip(raw_rows, mapped_rows), start=1):
            status, errors = _row_status(mapped, seen_keys, existing_lookup)
            counts[status] += 1
            preview_rows.append({"row_number": i, "raw": raw_row, "mapped": mapped, "status": status, "errors": errors})
        summary = {
            "total_rows": len(preview_rows),
            "valid_rows": counts["ready"],
            "ready_rows": counts["ready"],
            "invalid_rows": counts["invalid"],
            "duplicate_rows": counts["duplicate"],
        }
        return preview_rows, summary

    @router.post("/preview")
    async def preview_import(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        raw = await file.read()
        headers, raw_rows = _parse_file(file.filename or "", raw)
        mapping = _auto_mapping(headers)
        existing_lookup = await _existing_lookup([_apply_mapping(r, mapping) for r in raw_rows])
        preview_rows, summary = _build_preview(raw_rows, mapping, existing_lookup)
        return {
            "success": True,
            "filename": file.filename,
            "columns": headers,
            "suggested_mapping": mapping,
            "fields": CUSTOMER_IMPORT_FIELDS,
            "rows": preview_rows,
            "summary": summary,
        }

    @router.post("/remap")
    async def remap_import(body: dict = Body(...), user: dict = Depends(get_current_user)):
        """Re-validate after the admin edits the column mapping, without re-uploading the file."""
        _require_admin(user)
        raw_rows = body.get("raw_rows")
        mapping = body.get("mapping") or {}
        if not isinstance(raw_rows, list) or not raw_rows:
            raise HTTPException(status_code=400, detail="No rows to re-map")
        existing_lookup = await _existing_lookup([_apply_mapping(r, mapping) for r in raw_rows])
        preview_rows, summary = _build_preview(raw_rows, mapping, existing_lookup)
        return {"success": True, "rows": preview_rows, "summary": summary}

    @router.post("/confirm")
    async def confirm_import(body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        rows = body.get("rows")
        if not isinstance(rows, list) or not rows:
            raise HTTPException(status_code=400, detail="No rows selected for import")
        mapped_rows = [{k: v for k, v in r.items() if k in VALID_FIELD_KEYS} for r in rows if isinstance(r, dict)]

        existing_lookup = await _existing_lookup(mapped_rows)
        seen_keys = set()
        imported, duplicates, invalid, failed = 0, 0, 0, 0
        imported_docs = []
        now = datetime.now(timezone.utc).isoformat()

        for mapped in mapped_rows:
            status, _errors = _row_status(mapped, seen_keys, existing_lookup)
            if status == "invalid":
                invalid += 1
                continue
            if status == "duplicate":
                duplicates += 1
                continue
            doc = dict(mapped)
            cust_id = str(doc.get("cust_id") or "").strip() or f"CUS-{uuid.uuid4().hex[:6].upper()}"
            doc["cust_id"] = cust_id
            try:
                clash = await db["erp_customers"].find_one({"id": cust_id}, {"_id": 0, "id": 1})
            except Exception:
                raise HTTPException(status_code=503, detail="Lost connection to the database while importing. Some rows may not have been imported — please review the Customers list and re-run the import for any missing rows.")
            doc["id"] = cust_id if not clash else f"CUS-{uuid.uuid4().hex[:6].upper()}"
            doc.setdefault("status", "Active")
            doc.setdefault("filing_status", "Pending")
            for numeric_key in ("outstanding", "agent_commission_percentage"):
                if numeric_key in doc:
                    try:
                        doc[numeric_key] = float(doc[numeric_key])
                    except (TypeError, ValueError):
                        doc.pop(numeric_key, None)
            doc["imported_at"] = now
            doc["imported_by"] = user.get("name") or user.get("email") or "Admin"
            try:
                await db["erp_customers"].insert_one(dict(doc))
                doc.pop("_id", None)
                imported_docs.append(doc)
                imported += 1
            except Exception:
                failed += 1

        return {
            "success": True,
            "message": f"Imported {imported} customer(s)",
            "summary": {
                "total_rows": len(mapped_rows),
                "imported": imported,
                "skipped": duplicates,
                "duplicates": duplicates,
                "invalid": invalid,
                "failed": failed,
            },
            "data": imported_docs,
        }

    return router
