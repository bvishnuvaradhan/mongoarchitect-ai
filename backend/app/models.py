from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    email: EmailStr
    created_at: datetime = Field(alias="createdAt")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SchemaRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    input_text: str = Field(alias="inputText")
    workload_type: str = Field(default="balanced", alias="workloadType")


class SchemaRefineRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_id: str = Field(alias="schemaId")
    refinement_text: str = Field(alias="refinementText")
    workload_type: Optional[str] = Field(default=None, alias="workloadType")


class SchemaResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    entities: List[str]
    relationships: List[str]
    attributes: Dict[str, List[str]]
    decisions: Dict[str, str]
    why_not: Dict[str, str] = Field(alias="whyNot")
    confidence: Dict[str, int]
    schema_def: Dict[str, Any] = Field(alias="schema")
    indexes: List[Dict[str, Any]]
    warnings: List[str]
    explanations: Dict[str, str]
    access_pattern: str = Field(alias="accessPattern")


class SchemaHistory(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    user_id: str = Field(alias="userId")
    input_text: str = Field(alias="inputText")
    workload_type: str = Field(alias="workloadType")
    result: SchemaResult
    created_at: datetime = Field(alias="createdAt")
    version: Optional[int] = None
    parent_id: Optional[str] = Field(default=None, alias="parentId")
    refinement_text: Optional[str] = Field(default=None, alias="refinementText")
    root_id: Optional[str] = Field(default=None, alias="rootId")


class AgentChatRequest(BaseModel):
    """Request for agent chat endpoint."""
    model_config = ConfigDict(populate_by_name=True)
    
    message: str
    schema_id: Optional[str] = Field(default=None, alias="schemaId")


class AgentChatResponse(BaseModel):
    """Response from agent chat endpoint."""
    model_config = ConfigDict(populate_by_name=True)
    
    user_msg: str = Field(alias="userMessage")
    reasoning: str
    action: str  # GENERATE_SCHEMA, REFINE_SCHEMA, ASK_QUESTIONS, NONE
    schema_def: Optional[Dict[str, Any]] = Field(default=None, alias="schema")
    schema_id: Optional[str] = Field(default=None, alias="schemaId")
    error: Optional[str] = None

