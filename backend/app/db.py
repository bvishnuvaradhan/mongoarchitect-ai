from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import quote_plus

from .config import settings

from pymongo.errors import InvalidURI


def _build_safe_client(uri: str) -> AsyncIOMotorClient:
    # Try raw URI first
    try:
        return AsyncIOMotorClient(uri)
    except InvalidURI:
        # Attempt to URL-encode userinfo if present
        safe_uri = uri
        prefix = ""
        rest = uri
        if uri.startswith("mongodb+srv://"):
            prefix = "mongodb+srv://"
            rest = uri[len(prefix) :]
        elif uri.startswith("mongodb://"):
            prefix = "mongodb://"
            rest = uri[len(prefix) :]

        if "@" in rest:
            # split on the last '@' so passwords containing '@' are preserved
            userinfo, after = rest.rsplit("@", 1)
            if ":" in userinfo:
                user, pwd = userinfo.split(":", 1)
                user_e = quote_plus(user)
                pwd_e = quote_plus(pwd)
                safe_uri = prefix + f"{user_e}:{pwd_e}@{after}"
                return AsyncIOMotorClient(safe_uri)

        # If we couldn't fix it, re-raise the original error for visibility
        raise


# Initialize Motor client (attempt safe reconstruction on InvalidURI)
_client = _build_safe_client(settings.mongodb_uri)


def get_db():
    return _client[settings.database_name]
