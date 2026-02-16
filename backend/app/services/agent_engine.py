"""
Agentic AI for schema design using Claude with multi-turn reasoning and tool usage.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import json
from anthropic import Anthropic

from .schema_engine import generate_schema, apply_refinement

# Initialize Anthropic client (API key from environment)
client = Anthropic()

# System prompt for the schema design agent
SYSTEM_PROMPT = """You are an expert MongoDB schema architect AI assistant. Your role is to help users design optimal MongoDB schemas through multi-turn conversation.

You have access to two main tools:
1. GENERATE_SCHEMA: Create a new schema from scratch based on natural language description
2. REFINE_SCHEMA: Modify an existing schema based on user feedback

Your approach should be:
- First, ask clarifying questions if the user's request is ambiguous (e.g., workload type, scale, access patterns)
- Once you have enough information, generate an initial schema
- Iterate based on user feedback using refinement operations
- Provide clear explanations for design decisions (embed vs reference, indexing strategy, etc.)
- Consider workload patterns: read-heavy, write-heavy, mixed, analytical

When generating or refining schemas, you should:
- Identify entities and their relationships
- Decide on embed vs reference strategies based on workload type
- Suggest appropriate indexes
- Flag potential issues or design concerns

Format your response as JSON with these fields:
{
  "reasoning": "Your thinking process",
  "action": "GENERATE_SCHEMA | REFINE_SCHEMA | ASK_QUESTIONS | NONE",
  "user_message": "Response to the user (always include this)",
  "tool_input": {
    "text": "For GENERATE_SCHEMA: the schema requirements",
    "workload_type": "read-heavy | write-heavy | mixed | analytical",
    "schema_id": "For REFINE_SCHEMA: the MongoDB ID of the schema to refine",
    "refinement": "For REFINE_SCHEMA: the refinement instruction in natural language"
  },
  "schema": null  // Will be populated by the backend with actual schema if action requires it
}

Always be helpful, provide reasoning, and ask clarifying questions when needed."""


class SchemaDesignAgent:
    """Multi-turn agent for MongoDB schema design with Claude backend."""
    
    def __init__(self, user_id: str):
        """
        Initialize agent for a specific user.
        
        Args:
            user_id: Unique identifier for the user
        """
        self.user_id = user_id
        self.conversation_history: List[Dict[str, str]] = []
    
    def add_message(self, role: str, content: str) -> None:
        """Add a message to conversation history."""
        self.conversation_history.append({"role": role, "content": content})
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """Get full conversation history."""
        return self.conversation_history.copy()
    
    def chat(self, user_message: str, current_schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process user message and generate agent response with optional schema update.
        
        Args:
            user_message: User's input text
            current_schema: Optional current schema if refining an existing one
        
        Returns:
            Dict with agent response, reasoning, and optional schema
        """
        # Add user message to history
        self.add_message("user", user_message)
        
        # Build context if refining existing schema
        system_with_context = SYSTEM_PROMPT
        if current_schema:
            schema_context = json.dumps(current_schema, indent=2)
            system_with_context += f"\n\nCURRENT SCHEMA:\n{schema_context}\n\nWhen refining, analyze how to improve this schema based on user feedback."
        
        # Get Claude's response
        try:
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                system=system_with_context,
                messages=self.conversation_history
            )
            
            assistant_message = response.content[0].text
            self.add_message("assistant", assistant_message)
            
            # Parse Claude's response (should be JSON)
            try:
                parsed_response = json.loads(assistant_message)
            except json.JSONDecodeError:
                # If not valid JSON, wrap in a response structure
                parsed_response = {
                    "reasoning": "Parsed response as natural language",
                    "action": "NONE",
                    "user_message": assistant_message,
                    "schema": None
                }
            
            # Execute action if specified
            if parsed_response.get("action") == "GENERATE_SCHEMA":
                tool_input = parsed_response.get("tool_input", {})
                schema_result = generate_schema(
                    input_text=tool_input.get("text", user_message),
                    workload_type=tool_input.get("workload_type", "mixed")
                )
                parsed_response["schema"] = schema_result
                
            elif parsed_response.get("action") == "REFINE_SCHEMA" and current_schema:
                tool_input = parsed_response.get("tool_input", {})
                refined_result = apply_refinement(
                    base_result=current_schema,
                    refinement_text=tool_input.get("refinement", user_message),
                    workload_type=tool_input.get("workload_type", "mixed")
                )
                parsed_response["schema"] = refined_result
            
            return parsed_response
            
        except Exception as e:
            # Handle API errors
            error_message = f"Error communicating with Claude: {str(e)}"
            self.add_message("assistant", error_message)
            return {
                "reasoning": "Error occurred",
                "action": "NONE",
                "user_message": error_message,
                "schema": None,
                "error": str(e)
            }
    
    def reset_conversation(self) -> None:
        """Clear conversation history for a fresh start."""
        self.conversation_history = []


# In-memory storage of user agents (in production, this would be in Redis/Database)
_user_agents: Dict[str, SchemaDesignAgent] = {}


def get_or_create_agent(user_id: str) -> SchemaDesignAgent:
    """Get existing agent for user or create new one."""
    if user_id not in _user_agents:
        _user_agents[user_id] = SchemaDesignAgent(user_id)
    return _user_agents[user_id]


def delete_agent(user_id: str) -> None:
    """Delete agent conversation history for a user."""
    if user_id in _user_agents:
        del _user_agents[user_id]
