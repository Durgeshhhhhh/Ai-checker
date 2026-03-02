from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from backend.crypto import hash_password
from backend.mailer import send_admin_approval_email
from backend.mongo import admin_requests_collection, scan_logs_collection, users_collection
from backend.security import is_super_admin, normalize_role, require_admin_user

admin_router = APIRouter(prefix="/admin", tags=["Admin Panel"])
DEFAULT_MAX_USERS_PER_ADMIN = 5


class CreateUserRequest(BaseModel):
    email: str
    password: str
    tokens: int
    role: Optional[str] = None
    max_users: Optional[int] = None


class UpdateTokensRequest(BaseModel):
    tokens: int


class UpdateMaxUsersRequest(BaseModel):
    max_users: int


class AdminRequestDecision(BaseModel):
    reason: Optional[str] = None


class UpdatePasswordRequest(BaseModel):
    password: str


class UpdateUserDetailsRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    organization_name: Optional[str] = None


@admin_router.post("/create-user")
def create_user(data: CreateUserRequest, current_admin=Depends(require_admin_user)):
    email = data.email.strip().lower()
    requested_role = normalize_role(data.role or "")

    if data.tokens < 0:
        raise HTTPException(status_code=400, detail="Tokens must be >= 0")

    creator_role = normalize_role(current_admin.get("role"))
    creator_id = str(current_admin["_id"])

    if is_super_admin(current_admin):
        target_role = requested_role or "admin"
        if target_role != "admin":
            raise HTTPException(status_code=403, detail="Super admin can only create admin accounts")
        if data.max_users is None:
            raise HTTPException(status_code=400, detail="max_users is required when creating admin")
        if data.max_users < 0:
            raise HTTPException(status_code=400, detail="max_users must be >= 0")
    elif creator_role == "admin":
        target_role = requested_role or "user"
        if target_role != "user":
            raise HTTPException(status_code=403, detail="Admin can only create user accounts")

        max_users_allowed = current_admin.get("max_users_allowed", DEFAULT_MAX_USERS_PER_ADMIN)
        try:
            max_users_allowed = int(max_users_allowed)
        except Exception:
            max_users_allowed = DEFAULT_MAX_USERS_PER_ADMIN
        max_users_allowed = max(max_users_allowed, 0)

        current_user_count = users_collection.count_documents({"role": "user", "created_by": creator_id})
        if current_user_count >= max_users_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"User limit reached. This admin can create up to {max_users_allowed} users.",
            )
    else:
        raise HTTPException(status_code=403, detail="Admin access required")

    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "password_plain": data.password,
        "tokens": int(data.tokens),
        "role": target_role,
        "created_by": creator_id,
        "created_at": datetime.utcnow(),
    }
    if target_role == "admin":
        user_doc["max_users_allowed"] = int(data.max_users)
        user_doc["token_allocation_total"] = int(data.tokens)

    reserved_tokens = 0
    if creator_role == "admin":
        reserved_tokens = max(int(data.tokens), 0)
        if reserved_tokens > 0:
            reserved = users_collection.find_one_and_update(
                {
                    "_id": current_admin["_id"],
                    "role": "admin",
                    "tokens": {"$gte": reserved_tokens},
                },
                {"$inc": {"tokens": -reserved_tokens}},
                return_document=ReturnDocument.AFTER,
            )
            if not reserved:
                raise HTTPException(status_code=400, detail="Insufficient admin token balance")

    try:
        result = users_collection.insert_one(user_doc)
    except DuplicateKeyError:
        if reserved_tokens > 0:
            users_collection.update_one(
                {"_id": current_admin["_id"], "role": "admin"},
                {"$inc": {"tokens": reserved_tokens}},
            )
        raise HTTPException(status_code=400, detail="Email already exists")

    return {
        "message": f"{target_role.replace('_', ' ').title()} created successfully",
        "id": str(result.inserted_id),
        "role": target_role,
        "tokens": int(data.tokens),
    }


@admin_router.get("/users")
def list_users(current_admin=Depends(require_admin_user)):
    if is_super_admin(current_admin):
        query = {"role": "admin"}
    else:
        query = {"role": "user", "created_by": str(current_admin["_id"])}

    users = users_collection.find(query).sort("email", 1)
    return [
        {
            "id": str(u["_id"]),
            "email": u.get("email"),
            "tokens": u.get("tokens", 0),
            "role": u.get("role", "user"),
            "created_by": u.get("created_by"),
            "max_users_allowed": u.get("max_users_allowed"),
        }
        for u in users
    ]


def _resolve_target_query(user_id: str, current_admin: dict):
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    if is_super_admin(current_admin):
        return oid, {"_id": oid, "role": "admin"}

    return oid, {"_id": oid, "role": "user", "created_by": str(current_admin["_id"])}


@admin_router.patch("/users/{user_id}/tokens")
def update_tokens(user_id: str, data: UpdateTokensRequest, current_admin=Depends(require_admin_user)):
    if data.tokens < 0:
        raise HTTPException(status_code=400, detail="Tokens must be >= 0")

    _oid, target_query = _resolve_target_query(user_id, current_admin)
    is_super = is_super_admin(current_admin)

    if is_super:
        target_admin = users_collection.find_one(target_query, {"_id": 1, "tokens": 1, "token_allocation_total": 1})
        if not target_admin:
            raise HTTPException(status_code=404, detail="User not found")

        add_tokens = int(data.tokens)
        if add_tokens < 0:
            raise HTTPException(status_code=400, detail="Tokens to add must be >= 0")
        if add_tokens == 0:
            return {"message": "Tokens updated"}

        current_tokens = int(target_admin.get("tokens", 0))
        existing_total = int(target_admin.get("token_allocation_total", current_tokens))

        users_collection.update_one(
            {"_id": target_admin["_id"]},
            {
                "$set": {
                    "tokens": current_tokens + add_tokens,
                    "token_allocation_total": existing_total + add_tokens,
                }
            },
        )
        return {"message": "Tokens updated"}

    target_user = users_collection.find_one(target_query, {"_id": 1, "tokens": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    add_tokens = int(data.tokens)
    if add_tokens < 0:
        raise HTTPException(status_code=400, detail="Tokens to add must be >= 0")
    if add_tokens == 0:
        return {"message": "Tokens updated"}

    current_tokens = int(target_user.get("tokens", 0))
    new_tokens = current_tokens + add_tokens

    reserved = users_collection.find_one_and_update(
        {
            "_id": current_admin["_id"],
            "role": "admin",
            "tokens": {"$gte": add_tokens},
        },
        {"$inc": {"tokens": -add_tokens}},
        return_document=ReturnDocument.AFTER,
    )
    if not reserved:
        raise HTTPException(status_code=400, detail="Insufficient admin token balance")

    result = users_collection.update_one({"_id": target_user["_id"]}, {"$set": {"tokens": new_tokens}})
    if result.matched_count == 0:
        users_collection.update_one(
            {"_id": current_admin["_id"], "role": "admin"},
            {"$inc": {"tokens": add_tokens}},
        )
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Tokens updated"}


@admin_router.delete("/users/{user_id}")
def delete_user(user_id: str, current_admin=Depends(require_admin_user)):
    oid, target_query = _resolve_target_query(user_id, current_admin)
    target_user = users_collection.find_one(target_query, {"_id": 1, "role": 1, "tokens": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    users_collection.delete_one({"_id": oid})

    if target_user.get("role") == "admin":
        child_users = list(users_collection.find({"role": "user", "created_by": user_id}, {"_id": 1}))
        child_user_ids = [str(u["_id"]) for u in child_users]

        if child_user_ids:
            users_collection.delete_many({"role": "user", "created_by": user_id})
            scan_logs_collection.delete_many({"uid": {"$in": child_user_ids}})

    scan_logs_collection.delete_many({"uid": user_id})
    return {"message": "User deleted"}


@admin_router.get("/users/{user_id}/logs")
def get_user_logs(user_id: str, current_admin=Depends(require_admin_user)):
    _oid, target_query = _resolve_target_query(user_id, current_admin)
    if not users_collection.find_one(target_query, {"_id": 1}):
        raise HTTPException(status_code=404, detail="User not found")

    logs = scan_logs_collection.find({"uid": user_id}).sort("timestamp", -1)

    return [
        {
            "id": str(log["_id"]),
            "scanned_text": log.get("scanned_text", ""),
            "result": log.get("result"),
            "ai_percent": log.get("ai_percent", 0),
            "human_percent": log.get("human_percent", 0),
            "timestamp": log.get("timestamp").isoformat() if log.get("timestamp") else None,
        }
        for log in logs
    ]


@admin_router.get("/users/{user_id}/password-plain")
def get_user_plain_password(user_id: str, current_admin=Depends(require_admin_user)):
    _oid, target_query = _resolve_target_query(user_id, current_admin)
    target_user = users_collection.find_one(target_query, {"_id": 1, "password_plain": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    plain_password = target_user.get("password_plain")
    if not plain_password:
        raise HTTPException(status_code=404, detail="Password not available for this account")

    return {"password": plain_password}


@admin_router.get("/users/{user_id}/details")
def get_user_details(user_id: str, current_admin=Depends(require_admin_user)):
    _oid, target_query = _resolve_target_query(user_id, current_admin)
    target_user = users_collection.find_one(
        target_query,
        {
            "_id": 1,
            "email": 1,
            "role": 1,
            "tokens": 1,
            "max_users_allowed": 1,
            "organization_name": 1,
            "password_plain": 1,
        },
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(target_user["_id"]),
        "email": target_user.get("email", ""),
        "role": normalize_role(target_user.get("role", "user")),
        "tokens": int(target_user.get("tokens", 0) or 0),
        "max_users_allowed": int(target_user.get("max_users_allowed", 0) or 0),
        "organization_name": target_user.get("organization_name", "") or "",
        "password_plain": target_user.get("password_plain", "") or "",
    }


@admin_router.patch("/users/{user_id}/details")
def update_user_details(user_id: str, data: UpdateUserDetailsRequest, current_admin=Depends(require_admin_user)):
    _oid, target_query = _resolve_target_query(user_id, current_admin)
    target_user = users_collection.find_one(target_query, {"_id": 1, "role": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}

    new_email = (data.email or "").strip().lower()
    if new_email:
        duplicate = users_collection.find_one({"email": new_email, "_id": {"$ne": target_user["_id"]}})
        if duplicate:
            raise HTTPException(status_code=400, detail="Email already exists")
        updates["email"] = new_email

    new_password = (data.password or "").strip()
    if new_password:
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        updates["password_hash"] = hash_password(new_password)
        updates["password_plain"] = new_password

    if data.organization_name is not None:
        updates["organization_name"] = data.organization_name.strip()

    if not updates:
        return {"message": "No changes provided"}

    users_collection.update_one({"_id": target_user["_id"]}, {"$set": updates})
    return {"message": "Details updated"}


@admin_router.patch("/users/{user_id}/password")
def update_user_password(user_id: str, data: UpdatePasswordRequest, current_admin=Depends(require_admin_user)):
    new_password = (data.password or "").strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    _oid, target_query = _resolve_target_query(user_id, current_admin)
    target_user = users_collection.find_one(target_query, {"_id": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    users_collection.update_one(
        {"_id": target_user["_id"]},
        {"$set": {"password_hash": hash_password(new_password), "password_plain": new_password}},
    )
    return {"message": "Password updated"}


@admin_router.patch("/users/{user_id}/max-users")
def update_admin_max_users(user_id: str, data: UpdateMaxUsersRequest, current_admin=Depends(require_admin_user)):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Super admin access required")
    if data.max_users < 0:
        raise HTTPException(status_code=400, detail="max_users to add must be >= 0")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    target_admin = users_collection.find_one({"_id": oid, "role": "admin"}, {"_id": 1, "max_users_allowed": 1})
    if not target_admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    current_limit = int(target_admin.get("max_users_allowed", DEFAULT_MAX_USERS_PER_ADMIN) or 0)
    new_limit = current_limit + int(data.max_users)

    users_collection.update_one(
        {"_id": oid, "role": "admin"},
        {"$set": {"max_users_allowed": new_limit}},
    )

    return {"message": "Max users limit updated"}


@admin_router.get("/me-summary")
def get_admin_summary(current_admin=Depends(require_admin_user)):
    role = normalize_role(current_admin.get("role"))
    base = {
        "role": role,
        "email": current_admin.get("email"),
        "tokens": int(current_admin.get("tokens", 0) or 0),
        "organization_name": current_admin.get("organization_name") or "",
    }

    if role != "admin":
        return base

    max_users_allowed = int(current_admin.get("max_users_allowed", DEFAULT_MAX_USERS_PER_ADMIN) or 0)
    total_tokens_allocated = int(current_admin.get("token_allocation_total", base["tokens"]) or 0)
    current_users_count = users_collection.count_documents({"role": "user", "created_by": str(current_admin["_id"])})
    remaining_user_slots = max(max_users_allowed - current_users_count, 0)

    base.update(
        {
            "total_tokens_allocated": total_tokens_allocated,
            "remaining_tokens": base["tokens"],
            "used_tokens": max(total_tokens_allocated - base["tokens"], 0),
            "max_users_allowed": max_users_allowed,
            "current_users_count": current_users_count,
            "remaining_user_slots": remaining_user_slots,
        }
    )
    return base


@admin_router.get("/admin-requests")
def list_admin_requests(current_admin=Depends(require_admin_user)):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Super admin access required")

    requests = admin_requests_collection.find({"status": "pending"}).sort("requested_at", -1)
    return [
        {
            "id": str(r["_id"]),
            "email": r.get("email"),
            "requested_tokens": int(r.get("requested_tokens", 0) or 0),
            "requested_max_users": int(r.get("requested_max_users", 0) or 0),
            "organization_name": r.get("organization_name") or "",
            "requested_at": r.get("requested_at").isoformat() if r.get("requested_at") else None,
            "status": r.get("status", "pending"),
        }
        for r in requests
    ]


@admin_router.post("/admin-requests/{request_id}/approve")
def approve_admin_request(request_id: str, current_admin=Depends(require_admin_user)):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Super admin access required")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request id")

    request_doc = admin_requests_collection.find_one({"_id": oid})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_doc.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    email = (request_doc.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Invalid request email")
    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Account already exists for this email")

    try:
        users_collection.insert_one(
            {
                "email": email,
                "password_hash": request_doc.get("password_hash", ""),
                "password_plain": request_doc.get("password_plain", ""),
                "tokens": int(request_doc.get("requested_tokens", 0) or 0),
                "role": "admin",
                "created_by": str(current_admin["_id"]),
                "max_users_allowed": int(request_doc.get("requested_max_users", 0) or 0),
                "token_allocation_total": int(request_doc.get("requested_tokens", 0) or 0),
                "organization_name": request_doc.get("organization_name") or "",
                "created_at": datetime.utcnow(),
            }
        )
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Account already exists for this email")

    plain_password = request_doc.get("password_plain", "")
    email_sent = False
    email_error = None
    if plain_password:
        try:
            send_admin_approval_email(
                to_email=email,
                login_email=email,
                login_password=plain_password,
            )
            email_sent = True
        except Exception as exc:
            email_error = str(exc)

    admin_requests_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "approved",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": str(current_admin["_id"]),
                "approval_email_sent": email_sent,
                "approval_email_error": email_error,
            }
            ,
            "$unset": {"password_plain": ""},
        },
    )

    response = {"message": "Request approved and admin account created", "email_sent": email_sent}
    if email_error:
        response["email_error"] = email_error
    return response


@admin_router.post("/admin-requests/{request_id}/reject")
def reject_admin_request(
    request_id: str,
    data: Optional[AdminRequestDecision] = None,
    current_admin=Depends(require_admin_user),
):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Super admin access required")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request id")

    result = admin_requests_collection.update_one(
        {"_id": oid, "status": "pending"},
        {
            "$set": {
                "status": "rejected",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": str(current_admin["_id"]),
                "reject_reason": ((data.reason if data else "") or "").strip(),
            },
            "$unset": {"password_plain": ""},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending request not found")

    return {"message": "Request rejected"}
