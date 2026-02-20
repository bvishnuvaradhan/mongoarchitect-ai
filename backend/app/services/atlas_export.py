from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)


async def validate_connection(connection_string: str, database_name: str) -> Dict[str, Any]:
    """
    Validate MongoDB Atlas connection string and check permissions.
    Returns dict with success status and message.
    """
    # Basic format validation
    if not connection_string.startswith(("mongodb://", "mongodb+srv://")):
        return {
            "success": False,
            "error": "Invalid connection string format. Must start with mongodb:// or mongodb+srv://"
        }
    
    client = None
    try:
        # Create client with timeout
        client = AsyncIOMotorClient(
            connection_string,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        
        # Test connection with ping
        await client.admin.command("ping")
        
        # Check if database exists and is accessible
        db = client[database_name]
        
        # Test write permission by creating and dropping a test collection
        test_collection_name = "__mongoarchitect_test__"
        try:
            await db.create_collection(test_collection_name)
            await db.drop_collection(test_collection_name)
        except OperationFailure as e:
            return {
                "success": False,
                "error": f"Insufficient permissions: {str(e)}"
            }
        
        return {
            "success": True,
            "message": "Connection validated successfully"
        }
        
    except ConfigurationError:
        return {
            "success": False,
            "error": "Invalid connection string configuration"
        }
    except ServerSelectionTimeoutError:
        return {
            "success": False,
            "error": "Connection timeout. Check if IP is whitelisted in Atlas or cluster is reachable"
        }
    except ConnectionFailure:
        return {
            "success": False,
            "error": "Failed to connect. Check credentials and network connectivity"
        }
    except OperationFailure as e:
        return {
            "success": False,
            "error": f"Authentication failed: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }
    finally:
        if client:
            client.close()


def build_json_schema_validator(entity: str, attributes: List[str]) -> Dict[str, Any]:
    """
    Build MongoDB JSON Schema validator from entity and attributes.
    """
    properties = {}
    required = []
    
    for attr in attributes:
        # Parse attribute (e.g., "name: String", "age: Number")
        if ":" in attr:
            field_name, field_type = [x.strip() for x in attr.split(":", 1)]
        else:
            field_name = attr.strip()
            field_type = "String"
        
        # Map to JSON Schema types
        type_mapping = {
            "string": "string",
            "number": "number",
            "int": "number",
            "integer": "number",
            "bool": "boolean",
            "boolean": "boolean",
            "date": "date",
            "array": "array",
            "object": "object",
        }
        
        json_type = type_mapping.get(field_type.lower(), "string")
        properties[field_name] = {"bsonType": json_type}
        
        # Mark non-optional fields as required
        if not field_name.endswith("?"):
            required.append(field_name.rstrip("?"))
    
    validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": required if required else ["_id"],
            "properties": properties
        }
    }
    
    return validator


async def export_schema_to_atlas(
    connection_string: str,
    database_name: str,
    schema_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Export generated schema to MongoDB Atlas.
    Creates collections with validators and indexes.
    """
    client = None
    created_collections = []
    
    try:
        client = AsyncIOMotorClient(
            connection_string,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
        )
        
        db = client[database_name]
        result = schema_data.get("result", {})
        entities = result.get("entities", [])
        attributes = result.get("attributes", {})
        indexes = result.get("indexes", [])
        
        if not entities:
            return {
                "success": False,
                "error": "No entities found in schema"
            }
        
        # Create collections with validators
        for entity in entities:
            collection_name = entity.lower().replace(" ", "_")
            
            # Check if collection already exists
            existing_collections = await db.list_collection_names()
            if collection_name in existing_collections:
                # Collection exists, skip or update validator
                created_collections.append({
                    "name": collection_name,
                    "status": "already_exists"
                })
                continue
            
            # Get attributes for this entity
            entity_attrs = attributes.get(entity, [])
            
            # Build validator
            validator = build_json_schema_validator(entity, entity_attrs)
            
            # Create collection with validator
            await db.create_collection(
                collection_name,
                validator=validator,
                validationLevel="moderate",
                validationAction="warn"
            )
            
            created_collections.append({
                "name": collection_name,
                "status": "created",
                "fields": len(entity_attrs)
            })
        
        # Create indexes
        created_indexes = []
        for index_info in indexes:
            # Parse index info (e.g., "User.email", "Post.userId")
            if "." in index_info:
                entity, field = index_info.split(".", 1)
                collection_name = entity.lower().replace(" ", "_")
                
                try:
                    collection = db[collection_name]
                    await collection.create_index([(field, 1)])
                    created_indexes.append({
                        "collection": collection_name,
                        "field": field
                    })
                except Exception as e:
                    # Index creation failed, continue
                    pass
        
        return {
            "success": True,
            "message": f"Successfully exported schema to {database_name}",
            "collections": created_collections,
            "indexes": created_indexes
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Export failed: {str(e)}",
            "created_collections": created_collections
        }
    finally:
        if client:
            client.close()
