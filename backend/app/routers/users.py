from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_current_user


router = APIRouter(tags=["users"])


@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "_id": current_user.get("_id"),
        "email": current_user.get("email"),
        "createdAt": current_user.get("createdAt"),
    }
