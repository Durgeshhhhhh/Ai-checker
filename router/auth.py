from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.crypto import hash_password, verify_password
from backend.mongo import admin_requests_collection, users_collection
from backend.security import create_access_token, normalize_role

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminAccessRequest(BaseModel):
    email: str
    password: str
    tokens: int
    max_users: int
    organization_name: Optional[str] = None


@auth_router.post("/login")
def login(data: LoginRequest):
    email = data.email.strip().lower()
    user = users_collection.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    normalized_role = normalize_role(user.get("role", "user"))
    token = create_access_token(str(user["_id"]), normalized_role)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user.get("email"),
            "role": normalized_role,
            "tokens": user.get("tokens", 0),
        },
    }


@auth_router.post("/request-admin-access")
def request_admin_access(data: AdminAccessRequest):
    email = data.email.strip().lower()

    if data.tokens < 0:
        raise HTTPException(status_code=400, detail="tokens must be >= 0")
    if data.max_users < 0:
        raise HTTPException(status_code=400, detail="max_users must be >= 0")

    if users_collection.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Account already exists with this email")

    existing_pending = admin_requests_collection.find_one({"email": email, "status": "pending"})
    if existing_pending:
        raise HTTPException(status_code=400, detail="A pending request already exists for this email")

    admin_requests_collection.insert_one(
        {
            "email": email,
            "password_hash": hash_password(data.password),
            "password_plain": data.password,
            "requested_tokens": int(data.tokens),
            "requested_max_users": int(data.max_users),
            "organization_name": (data.organization_name or "").strip(),
            "status": "pending",
            "requested_at": datetime.utcnow(),
        }
    )

    return {"message": "Request submitted. Wait for super admin approval."}
