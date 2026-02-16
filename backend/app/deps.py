from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from .db import get_db
from .security import decode_access_token
from .utils import serialize_doc, to_object_id


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _unauthorized(detail: str):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    user_id = decode_access_token(token)
    if not user_id:
        _unauthorized("Invalid token")
    object_id = to_object_id(user_id)
    if not object_id:
        _unauthorized("Invalid token")
    db = get_db()
    user = await db.users.find_one({"_id": object_id})
    if not user:
        _unauthorized("User not found")
    return serialize_doc(user)
