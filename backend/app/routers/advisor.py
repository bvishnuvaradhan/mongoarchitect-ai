from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from ..db import get_db
from ..deps import get_current_user
from ..services import modeling_advisor

router = APIRouter(prefix="/advisor", tags=["advisor"])


@router.get("/analyze/{schema_id}")
async def analyze_schema(
    schema_id: str,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Analyze a schema and provide MongoDB modeling pattern recommendations.
    """
    from bson import ObjectId
    
    try:
        schema_obj_id = ObjectId(schema_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid schema ID")
    
    # Get schema from database
    schema = await db.schemaHistory.find_one({
        "_id": schema_obj_id,
        "userId": current_user.get("_id")
    })
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    
    # Analyze the schema
    analysis = modeling_advisor.analyze_schema(schema)
    
    return analysis
