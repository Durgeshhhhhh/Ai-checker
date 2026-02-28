from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from backend.crypto import hash_password
from backend.mongo import scan_logs_collection, users_collection
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

        current_tokens = int(target_admin.get("tokens", 0))
        existing_total = int(target_admin.get("token_allocation_total", current_tokens))
        delta = int(data.tokens) - current_tokens
        new_total = max(existing_total + delta, int(data.tokens), 0)

        users_collection.update_one(
            {"_id": target_admin["_id"]},
            {"$set": {"tokens": int(data.tokens), "token_allocation_total": new_total}},
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


@admin_router.patch("/users/{user_id}/max-users")
def update_admin_max_users(user_id: str, data: UpdateMaxUsersRequest, current_admin=Depends(require_admin_user)):
    if not is_super_admin(current_admin):
        raise HTTPException(status_code=403, detail="Super admin access required")
    if data.max_users < 0:
        raise HTTPException(status_code=400, detail="max_users must be >= 0")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    result = users_collection.update_one(
        {"_id": oid, "role": "admin"},
        {"$set": {"max_users_allowed": int(data.max_users)}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {"message": "Max users limit updated"}


@admin_router.get("/me-summary")
def get_admin_summary(current_admin=Depends(require_admin_user)):
    role = normalize_role(current_admin.get("role"))
    base = {
        "role": role,
        "email": current_admin.get("email"),
        "tokens": int(current_admin.get("tokens", 0) or 0),
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
