from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings


_client = AsyncIOMotorClient(settings.mongodb_uri)


def get_db():
    return _client[settings.database_name]
