from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from ..db import get_db
from ..deps import get_current_user
from ..services import access_pattern_analyzer

router = APIRouter(prefix="/access-patterns", tags=["access-patterns"])


@router.get("/analyze/{schema_id}")
async def analyze_access_patterns(
    schema_id: str,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Analyze access patterns for a schema.
    Shows most filtered fields, updated arrays, rarely queried fields, and write-heavy collections.
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
    
    # Analyze access patterns
    analysis = access_pattern_analyzer.analyze_access_patterns(schema)
    
    return analysis
