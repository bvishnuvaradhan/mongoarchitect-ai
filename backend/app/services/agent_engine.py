"""
Enterprise-Grade Agentic MongoDB Schema Designer
Production-ready architecture with structured validation and retry logic
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import json
import re
from groq import Groq
from pydantic import BaseModel, ValidationError

from ..config import settings
from .schema_engine import generate_schema, apply_refinement

# ============================================================
# Configuration
# ============================================================

MODEL_NAME = "llama-3.3-70b-versatile"  # Latest 70B model - best quality on free tier
TEMPERATURE = 0.2  # Lower = more deterministic
MAX_TOKENS = 3500
MAX_HISTORY = 6  # Trim history to prevent bloat
MAX_RETRIES = 2


# ============================================================
# Structured Output Model (STRICT)
# ============================================================

class SchemaAgentOutput(BaseModel):
    """Validated response schema from agent."""
    reasoning: str
    action: str
    user_message: str
    decisions: Dict[str, str]
    relationships: Dict[str, str]
    schema: Dict[str, Any]
    explanations: Dict[str, str]
    warnings: List[str]
    indexes: List[Dict[str, Any]]


# ============================================================
# System Prompt
# ============================================================

SYSTEM_PROMPT = """You are an expert MongoDB schema designer.

RESPOND WITH ONLY VALID JSON. NO MARKDOWN. NO EXTRA TEXT.

Output format:
{
  "reasoning": "Why this design is optimal",
  "action": "GENERATE_SCHEMA",
  "user_message": "Friendly summary",
  "decisions": {
    "collectionName": "Field design (embed vs reference)"
  },
  "relationships": {
    "Collection1 to Collection2": "SEPARATE/JUNCTION/EMBEDDED pattern"
  },
  "schema": {full collections},
  "explanations": {detailed rationales},
  "warnings": [concerns],
  "indexes": [recommendations]
}

STRICT REQUIREMENTS:
1. ONLY valid JSON output
2. action = "GENERATE_SCHEMA"
3. 4-6 collections minimum
4. 3-5 indexes minimum
5. domain-specific explanations (no generic text)
6. Detect many-to-many → JUNCTION collections
7. Respect 16MB document limit
"""




# ============================================================
# Agent Implementation
# ============================================================

class SchemaDesignAgent:
    """Multi-turn agent with structured output validation and retry logic."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.client = Groq(api_key=settings.groq_api_key)
        self.history: List[Dict[str, str]] = []

    # --------------------------------------------------------
    # History Management
    # --------------------------------------------------------

    def _trim_history(self):
        """Keep history to MAX_HISTORY entries to prevent bloat."""
        if len(self.history) > MAX_HISTORY:
            self.history = self.history[-MAX_HISTORY:]

    def add_message(self, role: str, content: str) -> None:
        """Add message to history and trim if needed."""
        self.history.append({"role": role, "content": content})
        self._trim_history()

    def get_conversation_history(self) -> List[Dict[str, str]]:
        """Get full conversation history."""
        return self.history.copy()

    # --------------------------------------------------------
    # Core Chat Logic with Retry
    # --------------------------------------------------------

    def chat(
        self,
        user_message: str,
        current_schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Process user message with retry logic and structured validation.
        
        Args:
            user_message: User's input text
            current_schema: Optional current schema for refinement
            
        Returns:
            Validated schema response
        """
        self.add_message("user", user_message)

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(self.history)

        # Retry loop with automatic recovery
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    temperature=TEMPERATURE,
                    max_tokens=MAX_TOKENS,
                    messages=messages,
                )

                assistant_text = response.choices[0].message.content.strip()
                self.add_message("assistant", assistant_text)

                # Extract JSON from various formats
                parsed = self._safe_json_extract(assistant_text)

                if not parsed:
                    # Guide LLM to fix JSON on next attempt
                    if attempt < MAX_RETRIES:
                        messages.append({
                            "role": "system",
                            "content": "ERROR: Your response was not valid JSON. Output only valid JSON without markdown."
                        })
                    continue

                # Validate with Pydantic
                try:
                    structured = SchemaAgentOutput(**parsed)
                except ValidationError as e:
                    if attempt < MAX_RETRIES:
                        messages.append({
                            "role": "system",
                            "content": f"VALIDATION ERROR: {str(e)[:200]}. Fix and regenerate."
                        })
                    continue

                # Hard validation rules - check before schema generation
                if structured.action != "GENERATE_SCHEMA":
                    if attempt < MAX_RETRIES:
                        messages.append({
                            "role": "system",
                            "content": 'ERROR: action must be "GENERATE_SCHEMA". Never ask questions. Generate immediately.'
                        })
                    continue

                # Verify all required fields are present
                if not all([
                    structured.reasoning,
                    structured.user_message,
                    structured.decisions,
                    structured.relationships,
                    structured.explanations,
                    structured.warnings,
                    structured.indexes,
                ]):
                    if attempt < MAX_RETRIES:
                        messages.append({
                            "role": "system",
                            "content": "ERROR: Missing required fields. Ensure all fields (reasoning, user_message, decisions, relationships, schema, explanations, warnings, indexes) are populated."
                        })
                    continue

                # Verify indexes have proper structure
                if not structured.indexes or len(structured.indexes) < 2:
                    if attempt < MAX_RETRIES:
                        messages.append({
                            "role": "system",
                            "content": "ERROR: Must include 3+ proper index definitions with 'collection', 'fields' or 'field', and 'reason'."
                        })
                    continue

                # Success! Generate final schema
                if current_schema:
                    final_schema = apply_refinement(
                        base_result=current_schema,
                        refinement_text=user_message,
                        workload_type="balanced",
                    )
                else:
                    final_schema = generate_schema(
                        input_text=user_message,
                        workload_type="balanced",
                    )

                structured.schema = final_schema
                return structured.model_dump()

            except Exception as e:
                if attempt == MAX_RETRIES:
                    return {
                        "reasoning": "Error occurred",
                        "action": "NONE",
                        "user_message": f"Error: {str(e)}",
                        "decisions": {},
                        "relationships": {},
                        "schema": None,
                        "explanations": {},
                        "warnings": [f"Error: {str(e)}"],
                        "indexes": []
                    }
                continue

        # All retries exhausted
        return {
            "reasoning": "Failed to generate valid schema",
            "action": "NONE",
            "user_message": "Could not generate valid schema after multiple attempts",
            "decisions": {},
            "relationships": {},
            "schema": None,
            "explanations": {},
            "warnings": ["Failed to generate schema after retries"],
            "indexes": []
        }

    # --------------------------------------------------------
    # JSON Extraction
    # --------------------------------------------------------

    def _safe_json_extract(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Safely extract JSON from various response formats.
        
        Attempts:
        1. Direct JSON parse
        2. Regex find JSON object
        3. Return None if all fail
        """
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try regex extraction
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return None

    # --------------------------------------------------------
    # Reset
    # --------------------------------------------------------

    def reset_conversation(self) -> None:
        """Clear conversation history for a fresh start."""
        self.history = []


# ============================================================
# Agent Store (Swap with Redis in production)
# ============================================================

_user_agents: Dict[str, SchemaDesignAgent] = {}


def get_or_create_agent(user_id: str) -> SchemaDesignAgent:
    """Get existing agent for user or create new one."""
    if user_id not in _user_agents:
        _user_agents[user_id] = SchemaDesignAgent(user_id)
    return _user_agents[user_id]


def delete_agent(user_id: str) -> None:
    """Delete agent conversation history for a user."""
    _user_agents.pop(user_id, None)
