from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from ..db import get_db
from ..deps import get_current_user
from ..services import evolution_analyzer

router = APIRouter(prefix="/evolution", tags=["evolution"])


@router.get("/timeline/{schema_id}")
async def get_evolution_timeline(
    schema_id: str,
    months: int = 12,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Get schema evolution timeline with growth projections.
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
    
    # Analyze evolution
    analysis = evolution_analyzer.analyze_evolution(schema, months_ahead=min(months, 24))
    
    return analysis
