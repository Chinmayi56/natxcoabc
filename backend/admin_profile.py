"""NTAXCO ERP — Admin Profile module.

Adds a per-administrator profile (separate from the Company Profile /
Settings module) so each authenticated admin account has its own
personal/business/tax details, a profile photo, and its own set of
uploaded admin documents (GST certificate, PAN document, etc.).

This module does NOT implement authentication itself — like security.py,
it is built entirely on top of the existing `get_current_user` dependency
and the existing `users` collection from server.py. No second auth system,
no duplicate session/token handling.

Ownership model (see PRD "Admin Profile" spec):

    Company (Settings → company-level info, unaffected by this module)
        -> Admin Accounts (users collection, role in ADMIN_ROLES)
            -> Individual Admin Profile (this module, one doc per user id)

Every profile and document is scoped strictly to the requesting admin's own
user id — an admin can never read or modify another admin's profile through
these endpoints, and no other role (employee/agent/customer) can reach this
router at all.

Image/document storage follows the exact same convention already used
elsewhere in this codebase (erp.py's site-images / documents, and
server.py's home-images): validated base64 data URIs stored directly on
the Mongo document, capped well under Mongo's 16MB document limit. The
project has no separate binary file-storage service, so this re-uses the
established in-DB approach rather than inventing a new one.
"""
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

# ---------------- constants ----------------

# Accept the same admin-role spellings used throughout server.py/erp.py.
ADMIN_ROLES = {"admin", "super_admin", "superadmin"}

# Same image/document allow-list + ~5MB (raw) size ceiling already
# established by erp.py's _validate_document_upload / _validate_site_image,
# so behaviour and error messages stay consistent across the app.
ALLOWED_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_DATA_LEN = 7_000_000

ALLOWED_DOCUMENT_MIMES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_DOCUMENT_DATA_LEN = 7_000_000

DOCUMENT_TYPES = {
    "gst_certificate": "GST Certificate",
    "pan_document": "PAN Document",
    "business_registration": "Business Registration Certificate",
    "address_proof": "Address Proof",
    "other": "Other Document",
}

# Personal / Admin Information fields (spec 20.2).
PERSONAL_FIELDS = {
    "admin_name", "mobile", "alternate_mobile", "email", "dob", "gender",
    "designation", "address", "city", "state", "country", "pincode",
}
# Business / Tax Information fields — explicitly separate from the
# Company Profile (Settings) collection; these live only on the individual
# admin's own profile doc (spec 20.1).
BUSINESS_FIELDS = {
    "company_name", "gst_number", "pan_number", "tan_number", "cin_number",
    "business_address", "registered_address", "office_address",
}
# Other Information fields.
OTHER_FIELDS = {"website", "alternate_email", "notes", "description"}

EDITABLE_PROFILE_FIELDS = PERSONAL_FIELDS | BUSINESS_FIELDS | OTHER_FIELDS

GENDER_OPTIONS = {"Male", "Female", "Other", "Prefer not to say"}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]{1}$")
CIN_RE = re.compile(r"^[LUlu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$")
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]{2,}$", re.IGNORECASE)


def _is_valid_indian_mobile(mobile: str) -> bool:
    m = str(mobile or "").replace("+91", "").replace(" ", "").replace("-", "").strip()
    return len(m) == 10 and m[0] in "6789" and m.isdigit()


def _ok(data, message="OK"):
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _require_admin(user: dict) -> None:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")


def _validate_profile_update(body: dict) -> dict:
    """Validate + normalize only the fields the caller actually sent — every
    field is optional (spec 20.2: 'Do not make every field mandatory'), but
    whatever IS sent must be well-formed. Returns the clean update dict."""
    update = {}
    errors = []

    for key in EDITABLE_PROFILE_FIELDS:
        if key not in body:
            continue
        raw = body.get(key)
        value = "" if raw is None else str(raw).strip()
        update[key] = value

    if update.get("mobile") and not _is_valid_indian_mobile(update["mobile"]):
        errors.append("Enter a valid 10-digit Indian mobile number starting with 6-9")
    if update.get("alternate_mobile") and not _is_valid_indian_mobile(update["alternate_mobile"]):
        errors.append("Enter a valid 10-digit Indian alternate mobile number starting with 6-9")
    if update.get("email") and not EMAIL_RE.match(update["email"]):
        errors.append("Enter a valid email address")
    if update.get("alternate_email") and not EMAIL_RE.match(update["alternate_email"]):
        errors.append("Enter a valid alternate email address")
    if update.get("gst_number") and not GST_RE.match(update["gst_number"].upper()):
        errors.append("Enter a valid 15-character GST number")
    elif update.get("gst_number"):
        update["gst_number"] = update["gst_number"].upper()
    if update.get("pan_number") and not PAN_RE.match(update["pan_number"].upper()):
        errors.append("Enter a valid 10-character PAN number")
    elif update.get("pan_number"):
        update["pan_number"] = update["pan_number"].upper()
    if update.get("tan_number") and not TAN_RE.match(update["tan_number"].upper()):
        errors.append("Enter a valid 10-character TAN number")
    elif update.get("tan_number"):
        update["tan_number"] = update["tan_number"].upper()
    if update.get("cin_number") and not CIN_RE.match(update["cin_number"].upper()):
        errors.append("Enter a valid 21-character CIN number")
    elif update.get("cin_number"):
        update["cin_number"] = update["cin_number"].upper()
    if update.get("pincode") and not PINCODE_RE.match(update["pincode"]):
        errors.append("Enter a valid 6-digit pincode")
    if update.get("website") and not URL_RE.match(update["website"]):
        errors.append("Enter a valid website URL (starting with http:// or https://)")
    if update.get("gender") and update["gender"] not in GENDER_OPTIONS:
        errors.append(f"Gender must be one of: {', '.join(sorted(GENDER_OPTIONS))}")

    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return update


def _validate_image_upload(image: str) -> str:
    image = str(image or "").strip()
    if not image:
        raise HTTPException(status_code=400, detail="An image file is required")
    if len(image) > MAX_PHOTO_DATA_LEN:
        raise HTTPException(status_code=400, detail="Photo is too large. Please upload an image under ~5MB.")
    if not image.startswith("data:") or ";base64," not in image[:80]:
        raise HTTPException(status_code=400, detail="Invalid image upload format")
    mime = image[5:image.find(";base64,")]
    if mime not in ALLOWED_PHOTO_MIMES:
        raise HTTPException(status_code=400, detail="Unsupported image type. Use JPEG, PNG or WEBP.")
    return image


def _validate_document_upload(body: dict) -> None:
    data = str(body.get("file_data") or "")
    if not data:
        raise HTTPException(status_code=400, detail="A file is required")
    if len(data) > MAX_DOCUMENT_DATA_LEN:
        raise HTTPException(status_code=400, detail="Document is too large. Please upload a file under ~5MB.")
    if not data.startswith("data:") or ";base64," not in data[:120]:
        raise HTTPException(status_code=400, detail="Invalid document upload format")
    mime = data[5:data.find(";base64,")]
    if mime not in ALLOWED_DOCUMENT_MIMES:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    doc_type = str(body.get("doc_type") or "other").strip().lower()
    if doc_type not in DOCUMENT_TYPES:
        doc_type = "other"
    body["mime_type"] = mime
    body["file_data"] = data
    body["doc_type"] = doc_type
    body.setdefault("label", DOCUMENT_TYPES[doc_type])


# ---------------- dynamic custom fields (spec 20.11–20.20) ----------------

# The admin must never need a developer to add a database column for a new
# field, so custom fields live in two small dynamic collections instead of
# hard-coded columns — a "definition" (name/type/required/options) and a
# separate "value" doc per definition, exactly matching the
# Admin -> Custom Field Definition -> Custom Field Value shape in the spec.
CUSTOM_FIELD_TYPES = {
    "text": "Text", "number": "Number", "email": "Email", "phone": "Phone",
    "date": "Date", "textarea": "Textarea", "dropdown": "Dropdown",
    "checkbox": "Checkbox", "file": "File", "url": "URL",
}

MAX_FIELD_NAME_LEN = 80
MAX_CUSTOM_FIELDS_PER_ADMIN = 100
MAX_DROPDOWN_OPTIONS = 50
MAX_OPTION_LEN = 100

# Custom file fields reuse the exact same allow-list/size ceiling and
# security posture as the existing admin Documents section (spec 20.20).
ALLOWED_CUSTOM_FILE_MIMES = ALLOWED_DOCUMENT_MIMES
MAX_CUSTOM_FILE_DATA_LEN = MAX_DOCUMENT_DATA_LEN


def _validate_field_name(name) -> str:
    name = str(name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Field name is required")
    if len(name) > MAX_FIELD_NAME_LEN:
        raise HTTPException(status_code=400, detail=f"Field name must be under {MAX_FIELD_NAME_LEN} characters")
    return name


def _validate_field_type(field_type) -> str:
    field_type = str(field_type or "").strip().lower()
    if field_type not in CUSTOM_FIELD_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Field type must be one of: {', '.join(CUSTOM_FIELD_TYPES)}",
        )
    return field_type


def _validate_dropdown_options(options) -> list:
    if not isinstance(options, list) or not options:
        raise HTTPException(status_code=400, detail="Dropdown fields need at least one option")
    cleaned, seen = [], set()
    for opt in options:
        opt = str(opt or "").strip()
        if not opt:
            continue
        if len(opt) > MAX_OPTION_LEN:
            raise HTTPException(status_code=400, detail=f"Each option must be under {MAX_OPTION_LEN} characters")
        key = opt.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(opt)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Dropdown fields need at least one option")
    if len(cleaned) > MAX_DROPDOWN_OPTIONS:
        raise HTTPException(status_code=400, detail=f"A dropdown can have at most {MAX_DROPDOWN_OPTIONS} options")
    return cleaned


def _validate_custom_field_value(field_type: str, raw_value, options=None):
    """Validate+normalize a value against its field's type (spec 20.18).
    Returns (stored_value, file_meta_or_None). stored_value is None when no
    value was supplied — callers decide whether that's acceptable."""
    if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
        return None, None

    if field_type == "text":
        return str(raw_value).strip(), None
    if field_type == "textarea":
        return str(raw_value), None
    if field_type == "number":
        try:
            num = float(raw_value)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Enter a valid number")
        return (int(num) if num.is_integer() else num), None
    if field_type == "email":
        value = str(raw_value).strip()
        if not EMAIL_RE.match(value):
            raise HTTPException(status_code=400, detail="Enter a valid email address")
        return value, None
    if field_type == "phone":
        value = str(raw_value).strip()
        if not _is_valid_indian_mobile(value):
            raise HTTPException(status_code=400, detail="Enter a valid 10-digit phone number")
        return value, None
    if field_type == "date":
        value = str(raw_value).strip()
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Enter a valid date (YYYY-MM-DD)")
        return value, None
    if field_type == "url":
        value = str(raw_value).strip()
        if not URL_RE.match(value):
            raise HTTPException(status_code=400, detail="Enter a valid URL (starting with http:// or https://)")
        return value, None
    if field_type == "checkbox":
        if isinstance(raw_value, bool):
            return raw_value, None
        value = str(raw_value).strip().lower()
        if value in {"true", "1", "yes", "on"}:
            return True, None
        if value in {"false", "0", "no", "off"}:
            return False, None
        raise HTTPException(status_code=400, detail="Checkbox value must be true or false")
    if field_type == "dropdown":
        value = str(raw_value).strip()
        if value not in set(options or []):
            raise HTTPException(status_code=400, detail="Select one of the configured options")
        return value, None
    if field_type == "file":
        data = str(raw_value or "").strip()
        if len(data) > MAX_CUSTOM_FILE_DATA_LEN:
            raise HTTPException(status_code=400, detail="File is too large. Please upload a file under ~5MB.")
        if not data.startswith("data:") or ";base64," not in data[:120]:
            raise HTTPException(status_code=400, detail="Invalid file upload format")
        mime = data[5:data.find(";base64,")]
        if mime not in ALLOWED_CUSTOM_FILE_MIMES:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        return data, {"mime_type": mime}
    raise HTTPException(status_code=400, detail="Unsupported field type")


def build_admin_profile_router(db, get_current_user) -> APIRouter:
    router = APIRouter(prefix="/api/admin/profile")
    profiles = db["erp_admin_profiles"]
    documents = db["erp_admin_profile_documents"]
    field_defs = db["erp_admin_custom_field_defs"]
    field_values = db["erp_admin_custom_field_values"]

    async def _get_or_create_profile(user: dict) -> dict:
        profile = await profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        if profile:
            return profile
        now = datetime.now(timezone.utc).isoformat()
        profile = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            # Seed with what the account already knows so the profile isn't
            # a blank slate on first visit, without ever overwriting these
            # once the admin edits their own profile.
            "admin_name": user.get("name") or "",
            "email": user.get("email") or "",
            "mobile": user.get("mobile") or "",
            "profile_photo": None,
            "created_at": now,
            "updated_at": now,
        }
        for key in EDITABLE_PROFILE_FIELDS:
            profile.setdefault(key, "")
        await profiles.insert_one(dict(profile))
        return profile

    @router.get("/me")
    async def get_my_profile(user: dict = Depends(get_current_user)):
        _require_admin(user)
        profile = await _get_or_create_profile(user)
        return _ok(profile)

    @router.put("/me")
    async def update_my_profile(body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        await _get_or_create_profile(user)
        update = _validate_profile_update(body)
        if not update:
            raise HTTPException(status_code=400, detail="Nothing to update")
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await profiles.update_one({"user_id": user["id"]}, {"$set": update})
        profile = await profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        return _ok(profile, message="Profile updated")

    @router.post("/me/photo")
    async def upload_my_photo(body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        await _get_or_create_profile(user)
        image = _validate_image_upload(body.get("image"))
        now = datetime.now(timezone.utc).isoformat()
        await profiles.update_one(
            {"user_id": user["id"]},
            {"$set": {"profile_photo": image, "updated_at": now}},
        )
        profile = await profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        return _ok(profile, message="Profile photo updated")

    @router.delete("/me/photo")
    async def remove_my_photo(user: dict = Depends(get_current_user)):
        _require_admin(user)
        await _get_or_create_profile(user)
        now = datetime.now(timezone.utc).isoformat()
        await profiles.update_one(
            {"user_id": user["id"]},
            {"$set": {"profile_photo": None, "updated_at": now}},
        )
        profile = await profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        return _ok(profile, message="Profile photo removed")

    @router.get("/me/documents")
    async def list_my_documents(user: dict = Depends(get_current_user)):
        _require_admin(user)
        # Metadata only — file_data is intentionally excluded from the list
        # response so opening the Documents section doesn't pull every
        # base64 payload over the wire; a single document's bytes are only
        # fetched by the dedicated GET /me/documents/{doc_id} below.
        items = await documents.find(
            {"user_id": user["id"]}, {"_id": 0, "file_data": 0}
        ).sort("uploaded_at", -1).to_list(200)
        return _ok(items)

    @router.post("/me/documents")
    async def upload_my_document(body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        _validate_document_upload(body)
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "doc_type": body["doc_type"],
            "label": str(body.get("label") or DOCUMENT_TYPES[body["doc_type"]]).strip(),
            "file_name": str(body.get("file_name") or "").strip(),
            "mime_type": body["mime_type"],
            "file_data": body["file_data"],
            "uploaded_by": user.get("name") or "Admin",
            "uploaded_at": now,
        }
        await documents.insert_one(dict(doc))
        doc.pop("file_data", None)
        return _ok(doc, message="Document uploaded")

    @router.get("/me/documents/{doc_id}")
    async def get_my_document(doc_id: str, user: dict = Depends(get_current_user)):
        _require_admin(user)
        doc = await documents.find_one({"id": doc_id, "user_id": user["id"]}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return _ok(doc)

    @router.delete("/me/documents/{doc_id}")
    async def delete_my_document(doc_id: str, user: dict = Depends(get_current_user)):
        _require_admin(user)
        result = await documents.delete_one({"id": doc_id, "user_id": user["id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        return _ok({"id": doc_id}, message="Document deleted")

    # ---------------- dynamic custom fields ----------------

    async def _serialize_custom_field(defn: dict, include_file_data: bool = False) -> dict:
        value_doc = await field_values.find_one(
            {"definition_id": defn["id"], "user_id": defn["user_id"]}, {"_id": 0}
        )
        out = {
            "id": defn["id"],
            "field_name": defn["field_name"],
            "field_type": defn["field_type"],
            "required": defn.get("required", False),
            "options": defn.get("options", []),
            "created_at": defn.get("created_at"),
            "updated_at": defn.get("updated_at"),
            "value": None,
            "file_name": None,
            "has_value": False,
        }
        if value_doc:
            out["has_value"] = True
            out["updated_at"] = value_doc.get("updated_at", out["updated_at"])
            if defn["field_type"] == "file":
                out["file_name"] = value_doc.get("file_name")
                out["mime_type"] = value_doc.get("mime_type")
                if include_file_data:
                    out["value"] = value_doc.get("value")
            else:
                out["value"] = value_doc.get("value")
        return out

    @router.get("/me/custom-fields")
    async def list_custom_fields(user: dict = Depends(get_current_user)):
        _require_admin(user)
        defs = await field_defs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
        items = [await _serialize_custom_field(d) for d in defs]
        return _ok(items)

    @router.post("/me/custom-fields")
    async def create_custom_field(body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        field_name = _validate_field_name(body.get("field_name"))
        field_type = _validate_field_type(body.get("field_type"))
        required = bool(body.get("required", False))

        existing_count = await field_defs.count_documents({"user_id": user["id"]})
        if existing_count >= MAX_CUSTOM_FIELDS_PER_ADMIN:
            raise HTTPException(
                status_code=400,
                detail=f"You can create at most {MAX_CUSTOM_FIELDS_PER_ADMIN} custom fields",
            )

        dup = await field_defs.find_one({"user_id": user["id"], "field_name_lower": field_name.lower()})
        if dup:
            raise HTTPException(status_code=400, detail="A custom field with this name already exists")

        options = []
        if field_type == "dropdown":
            options = _validate_dropdown_options(body.get("options"))

        value, file_meta = (None, None)
        if body.get("value") not in (None, ""):
            value, file_meta = _validate_custom_field_value(field_type, body.get("value"), options)
        if required and value is None:
            raise HTTPException(status_code=400, detail="This field is required — please provide a value")

        now = datetime.now(timezone.utc).isoformat()
        defn = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "field_name": field_name,
            "field_name_lower": field_name.lower(),
            "field_type": field_type,
            "required": required,
            "options": options,
            "created_at": now,
            "updated_at": now,
        }
        await field_defs.insert_one(dict(defn))

        if value is not None:
            value_doc = {
                "id": str(uuid.uuid4()),
                "definition_id": defn["id"],
                "user_id": user["id"],
                "value": value,
                "updated_at": now,
            }
            if field_type == "file":
                value_doc["file_name"] = str(body.get("file_name") or "").strip()
                value_doc["mime_type"] = (file_meta or {}).get("mime_type")
            await field_values.insert_one(dict(value_doc))

        result = await _serialize_custom_field(defn)
        return _ok(result, message="Custom field created")

    @router.put("/me/custom-fields/{field_id}")
    async def update_custom_field(field_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
        _require_admin(user)
        defn = await field_defs.find_one({"id": field_id, "user_id": user["id"]}, {"_id": 0})
        if not defn:
            raise HTTPException(status_code=404, detail="Custom field not found")

        updates = {}
        type_changed = False

        if "field_name" in body:
            new_name = _validate_field_name(body.get("field_name"))
            if new_name.lower() != defn["field_name_lower"]:
                dup = await field_defs.find_one({
                    "user_id": user["id"],
                    "field_name_lower": new_name.lower(),
                    "id": {"$ne": field_id},
                })
                if dup:
                    raise HTTPException(status_code=400, detail="A custom field with this name already exists")
            updates["field_name"] = new_name
            updates["field_name_lower"] = new_name.lower()

        field_type = defn["field_type"]
        if "field_type" in body:
            field_type = _validate_field_type(body.get("field_type"))
            if field_type != defn["field_type"]:
                type_changed = True
                updates["field_type"] = field_type

        options = defn.get("options", [])
        if "options" in body or (field_type == "dropdown" and type_changed):
            if field_type == "dropdown":
                options = _validate_dropdown_options(body.get("options", options))
                updates["options"] = options
            else:
                options = []
                updates["options"] = []

        required = defn.get("required", False)
        if "required" in body:
            required = bool(body.get("required"))
            updates["required"] = required

        now = datetime.now(timezone.utc).isoformat()

        # Changing type invalidates any existing value — the old value may
        # no longer fit the new shape, so the admin re-enters it cleanly
        # rather than risk a silently mismatched value being stored.
        if type_changed:
            await field_values.delete_one({"definition_id": field_id, "user_id": user["id"]})

        if "value" in body:
            value, file_meta = _validate_custom_field_value(field_type, body.get("value"), options)
            if value is None:
                await field_values.delete_one({"definition_id": field_id, "user_id": user["id"]})
            else:
                value_doc = {"value": value, "updated_at": now, "user_id": user["id"], "definition_id": field_id}
                if field_type == "file":
                    value_doc["file_name"] = str(body.get("file_name") or "").strip()
                    value_doc["mime_type"] = (file_meta or {}).get("mime_type")
                existing_value = await field_values.find_one({"definition_id": field_id, "user_id": user["id"]})
                if existing_value:
                    await field_values.update_one(
                        {"definition_id": field_id, "user_id": user["id"]}, {"$set": value_doc}
                    )
                else:
                    value_doc["id"] = str(uuid.uuid4())
                    await field_values.insert_one(dict(value_doc))

        if updates:
            updates["updated_at"] = now
            await field_defs.update_one({"id": field_id, "user_id": user["id"]}, {"$set": updates})

        # Whatever path got us here, a Required field must end this request
        # with a valid value on file (spec 20.18) — covers the type-change
        # wipe, the required flag just being turned on, and a bad value.
        if required:
            has_value = await field_values.find_one({"definition_id": field_id, "user_id": user["id"]})
            if not has_value:
                raise HTTPException(status_code=400, detail="This field is required — please provide a value")

        defn = await field_defs.find_one({"id": field_id, "user_id": user["id"]}, {"_id": 0})
        result = await _serialize_custom_field(defn)
        return _ok(result, message="Custom field updated")

    @router.delete("/me/custom-fields/{field_id}")
    async def delete_custom_field(field_id: str, user: dict = Depends(get_current_user)):
        _require_admin(user)
        result = await field_defs.delete_one({"id": field_id, "user_id": user["id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Custom field not found")
        # Deleting a definition only removes that one field's own value —
        # unrelated custom fields and core profile data are untouched (20.14).
        await field_values.delete_one({"definition_id": field_id, "user_id": user["id"]})
        return _ok({"id": field_id}, message="Custom field deleted")

    @router.get("/me/custom-fields/{field_id}/file")
    async def get_custom_field_file(field_id: str, user: dict = Depends(get_current_user)):
        _require_admin(user)
        defn = await field_defs.find_one({"id": field_id, "user_id": user["id"]}, {"_id": 0})
        if not defn or defn.get("field_type") != "file":
            raise HTTPException(status_code=404, detail="File field not found")
        value_doc = await field_values.find_one({"definition_id": field_id, "user_id": user["id"]}, {"_id": 0})
        if not value_doc or not value_doc.get("value"):
            raise HTTPException(status_code=404, detail="No file uploaded for this field")
        return _ok({
            "file_name": value_doc.get("file_name"),
            "mime_type": value_doc.get("mime_type"),
            "file_data": value_doc.get("value"),
        })

    return router
