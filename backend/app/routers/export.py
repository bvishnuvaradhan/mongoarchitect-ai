from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..db import get_db
from ..deps import get_current_user
from ..services.atlas_export import export_schema_to_atlas, validate_connection
from ..utils import to_object_id


router = APIRouter(prefix="/export", tags=["export"])


class ValidateConnectionRequest(BaseModel):
    connection_string: str = Field(alias="connectionString")
    database_name: str = Field(alias="databaseName")


class ExportToAtlasRequest(BaseModel):
    schema_id: str = Field(alias="schemaId")
    connection_string: str = Field(alias="connectionString")
    database_name: str = Field(alias="databaseName")


@router.post("/validate-connection")
async def validate_atlas_connection(
    payload: ValidateConnectionRequest,
    current_user=Depends(get_current_user)
):
    """
    Validate MongoDB Atlas connection string and permissions.
    """
    result = await validate_connection(
        payload.connection_string,
        payload.database_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Connection validation failed")
        )
    
    return result


@router.post("/to-atlas")
async def export_to_atlas(
    payload: ExportToAtlasRequest,
    current_user=Depends(get_current_user)
):
    """
    Export schema to MongoDB Atlas.
    Creates collections with validators and indexes.
    """
    # Get schema from database
    object_id = to_object_id(payload.schema_id)
    if not object_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found"
        )
    
    db = get_db()
    schema = await db.schemaHistory.find_one({
        "_id": object_id,
        "userId": current_user.get("_id")
    })
    
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema not found"
        )
    
    # Export to Atlas
    result = await export_schema_to_atlas(
        payload.connection_string,
        payload.database_name,
        schema
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Export failed")
        )
    
    return result
