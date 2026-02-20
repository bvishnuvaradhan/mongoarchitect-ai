from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

from ..db import get_db
from ..deps import get_current_user
from ..services import query_latency_simulator

router = APIRouter(prefix="/query-latency", tags=["query-latency"])


@router.get("/simulate/{schema_id}")
async def simulate_query_latency(
    schema_id: str,
    current_user: Dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Simulate query latency for various query patterns on a schema.
    Analyzes find, lookup, array queries, and aggregation pipelines.
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
    
    # Simulate query latency
    analysis = query_latency_simulator.simulate_query_latency(schema)
    
    return analysis
