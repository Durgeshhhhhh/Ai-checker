from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.crypto import verify_password
from backend.mongo import users_collection
from backend.security import create_access_token, normalize_role

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


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
