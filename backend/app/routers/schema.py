from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_db
from ..deps import get_current_user
from ..models import SchemaRefineRequest, SchemaRequest
from ..services.schema_engine import apply_refinement, generate_schema
from ..utils import serialize_doc, serialize_docs, to_object_id


router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.post("/generate")
async def create_schema(payload: SchemaRequest, current_user=Depends(get_current_user)):
    result = generate_schema(payload.input_text, payload.workload_type)
    doc = {
        "userId": current_user.get("_id"),
        "inputText": payload.input_text,
        "workloadType": payload.workload_type,
        "result": result,
        "createdAt": datetime.now(timezone.utc),
        "version": 1,
    }
    db = get_db()
    insert_result = await db.schemaHistory.insert_one(doc)
    doc["_id"] = str(insert_result.inserted_id)
    doc["rootId"] = doc["_id"]
    await db.schemaHistory.update_one(
        {"_id": insert_result.inserted_id},
        {"$set": {"rootId": doc["_id"]}},
    )
    return doc


@router.post("/refine")
async def refine_schema(payload: SchemaRefineRequest, current_user=Depends(get_current_user)):
    object_id = to_object_id(payload.schema_id)
    if not object_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")
    db = get_db()
    parent = await db.schemaHistory.find_one({"_id": object_id, "userId": current_user.get("_id")})
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")

    workload_type = payload.workload_type or parent.get("workloadType", "balanced")
    combined_prompt = f"{parent.get('inputText', '').strip()}\nRefinement: {payload.refinement_text.strip()}"
    result = apply_refinement(parent.get("result", {}), payload.refinement_text, workload_type)
    version = int(parent.get("version", 1)) + 1
    root_id = parent.get("rootId") or str(parent.get("_id"))
    doc = {
        "userId": current_user.get("_id"),
        "inputText": combined_prompt,
        "workloadType": workload_type,
        "result": result,
        "createdAt": datetime.now(timezone.utc),
        "version": version,
        "parentId": str(parent.get("_id")),
        "refinementText": payload.refinement_text,
        "rootId": root_id,
    }
    insert_result = await db.schemaHistory.insert_one(doc)
    doc["_id"] = str(insert_result.inserted_id)
    return doc


@router.get("/history")
async def get_history(current_user=Depends(get_current_user)):
    db = get_db()
    cursor = db.schemaHistory.find({"userId": current_user.get("_id")}).sort("createdAt", -1)
    docs = await cursor.to_list(length=200)
    seen_roots = set()
    grouped = []
    for doc in docs:
        root_id = str(doc.get("rootId") or doc.get("_id"))
        if root_id in seen_roots:
            continue
        doc["rootId"] = root_id
        grouped.append(doc)
        seen_roots.add(root_id)
    return serialize_docs(grouped)


@router.get("/{schema_id}")
async def get_schema(schema_id: str, current_user=Depends(get_current_user)):
    object_id = to_object_id(schema_id)
    if not object_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")
    db = get_db()
    doc = await db.schemaHistory.find_one({"_id": object_id, "userId": current_user.get("_id")})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")
    return serialize_doc(doc)
