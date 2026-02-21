"""
Cost Estimation API Router

Endpoints for MongoDB Atlas cost estimation and optimization recommendations.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from bson import ObjectId

from ..db import get_db
from ..deps import get_current_user
from ..services.cost_estimator import estimate_atlas_costs


router = APIRouter(prefix="/cost-estimate", tags=["cost-estimation"])


@router.get("/analyze/{schema_id}")
async def analyze_cost_projection(
    schema_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db=Depends(get_db)
):
    """
    Generate Atlas cost projections for a schema over 12 months.
    
    Returns:
        - Current metrics (storage, IOPS, RU)
        - Month-by-month cost projections
        - Cost milestones (tier upgrades, threshold crossings)
        - Optimization recommendations
    """
    try:
        # Validate schema_id format
        if not ObjectId.is_valid(schema_id):
            raise HTTPException(status_code=400, detail="Invalid schema ID format")
        
        # Fetch schema from database
        schema = await db.schemaHistory.find_one({
            "_id": ObjectId(schema_id),
            "userId": current_user.get("_id")
        })
        
        if not schema:
            raise HTTPException(status_code=404, detail="Schema not found")
        
        # Estimate costs
        cost_analysis = estimate_atlas_costs(schema)
        
        # Generate a meaningful schema name from inputText, filtering out metadata
        input_text = schema.get("inputText", "")
        
        # Remove workload type and refinement lines
        lines = input_text.split('\n')
        filtered_lines = [
            line.strip() for line in lines 
            if not line.lower().startswith('workload type:') 
            and not line.lower().startswith('refinement:')
            and line.strip()
        ]
        clean_text = ' '.join(filtered_lines)
        
        schema_name = clean_text[:80] + ("..." if len(clean_text) > 80 else "") if clean_text else "Untitled Schema"
        
        return {
            "schema_id": schema_id,
            "schema_name": schema_name,
            "analysis": cost_analysis
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cost estimation failed: {str(e)}"
        )
