"""Routes for agentic AI schema design."""

from __future__ import annotations

from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends
from bson import ObjectId

from ..models import AgentChatRequest, AgentChatResponse
from ..deps import get_current_user
from ..services.agent_engine import get_or_create_agent, delete_agent
from ..db import get_db

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    request: AgentChatRequest,
    current_user=Depends(get_current_user)
) -> AgentChatResponse:
    """
    Chat with the MongoDB schema design agent.
    
    The agent will:
    - Ask clarifying questions if needed
    - Generate new schemas or refine existing ones
    - Provide reasoning and recommendations
    """
    
    user_id = current_user.get("_id")
    db = get_db()
    
    # Get or create agent for this user
    agent = get_or_create_agent(user_id)
    
    # If schema_id is provided, fetch the schema for context
    current_schema = None
    if request.schema_id:
        try:
            schema_doc = await db.schemaHistory.find_one({"_id": ObjectId(request.schema_id)})
            if schema_doc:
                current_schema = schema_doc.get("result")
        except Exception:
            # If schema lookup fails, proceed without context
            pass
    
    # Get agent response - wrap in try-except for proper error handling
    try:
        response = agent.chat(user_message=request.message, current_schema=current_schema)
    except Exception as e:
        return AgentChatResponse(
            user_msg=request.message,
            reasoning="Error occurred during schema generation",
            action="NONE",
            schema_def=None,
            schema_id=None,
            error=f"Agent error: {str(e)}"
        )
    
    # If action is GENERATE_SCHEMA or REFINE_SCHEMA, save to database
    schema_id_to_return = None
    if response.get("schema") and request.schema_id:
        try:
            # Update existing schema with new version
            schema_doc = await db.schemaHistory.find_one({"_id": ObjectId(request.schema_id)})
            if schema_doc:
                new_version = (schema_doc.get("version", 1) or 1) + 1
                root_id = schema_doc.get("rootId") or request.schema_id
                
                new_schema_doc = {
                    "userId": user_id,
                    "inputText": schema_doc.get("inputText", request.message),
                    "workloadType": schema_doc.get("workloadType", "mixed"),
                    "result": response["schema"],
                    "createdAt": datetime.utcnow(),
                    "version": new_version,
                    "parentId": request.schema_id,
                    "refinementText": request.message,
                    "rootId": root_id
                }
                
                result = await db.schemaHistory.insert_one(new_schema_doc)
                schema_id_to_return = str(result.inserted_id)
        except Exception:
            # If save fails, still return response
            pass
    
    elif response.get("schema") and response.get("action") == "GENERATE_SCHEMA":
        try:
            # Save new schema
            schema_doc = {
                "userId": user_id,
                "inputText": request.message,
                "workloadType": "mixed",
                "result": response["schema"],
                "createdAt": datetime.utcnow(),
                "version": 1
            }
            
            result = await db.schemaHistory.insert_one(schema_doc)
            schema_id_to_return = str(result.inserted_id)
        except Exception:
            # If save fails, still return response
            pass
    
    return AgentChatResponse(
        user_msg=request.message,
        reasoning=response.get("reasoning", ""),
        action=response.get("action", "NONE"),
        schema_def=response.get("schema"),
        schema_id=schema_id_to_return,
        error=response.get("error")
    )


@router.post("/reset")
async def reset_agent(current_user=Depends(get_current_user)) -> dict:
    """Reset conversation history for the current user's agent."""
    user_id = current_user.get("_id")
    delete_agent(user_id)
    return {"message": "Agent conversation reset successfully"}
