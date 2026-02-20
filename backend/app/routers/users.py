from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_db
from ..deps import get_current_user
from ..models import ChangePassword
from ..security import hash_password, verify_password


router = APIRouter(tags=["users"])


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "_id": current_user.get("_id"),
        "email": current_user.get("email"),
        "createdAt": current_user.get("createdAt"),
    }


@router.put("/me/password")
async def change_password(
    payload: ChangePassword,
    current_user=Depends(get_current_user)
):
    # Verify current password
    current_hash = current_user.get("passwordHash", "")
    if not verify_password(payload.current_password, current_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    # Hash and update new password
    new_hash = hash_password(payload.new_password)
    db = get_db()
    await db.users.update_one(
        {"_id": current_user.get("_id")},
        {"$set": {"passwordHash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}
