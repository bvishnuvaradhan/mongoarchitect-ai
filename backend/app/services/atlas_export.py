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


def build_json_schema_validator(collection_name: str, fields: Dict[str, str]) -> Dict[str, Any]:
    """
    Build MongoDB JSON Schema validator from collection fields.
    """
    properties = {}
    required = []
    
    # Map schema types to BSON types
    type_mapping = {
        "objectid": "objectId",
        "string": "string",
        "number": "number",
        "int": "int",
        "integer": "int",
        "double": "double",
        "bool": "bool",
        "boolean": "bool",
        "date": "date",
        "array": "array",
        "object": "object",
    }
    
    for field_name, field_type in fields.items():
        if field_name == "_id":
            # Skip _id as it's automatically managed by MongoDB
            continue
            
        # Clean up field type (remove "ref: xxx" annotations)
        clean_type = field_type.lower().split("(")[0].strip()
        
        # Map to BSON type
        bson_type = type_mapping.get(clean_type, "string")
        
        properties[field_name] = {"bsonType": bson_type}
        
        # Add description for reference fields
        if "(ref:" in field_type.lower():
            ref_match = field_type.lower().split("ref:")[1].split(")")[0].strip()
            properties[field_name]["description"] = f"Reference to {ref_match} collection"
        
        # All fields are required by default (can be made optional later)
        required.append(field_name)
    
    validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": required if required else [],
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
        
        # Get the schema structure - it's stored in result.schema
        schema = result.get("schema", {})
        
        if not schema:
            return {
                "success": False,
                "error": "No schema found in data"
            }
        
        # Get indexes if available
        indexes = result.get("indexes", [])
        
        # Create collections with validators
        for collection_name, fields in schema.items():
            # Skip if not a dictionary (shouldn't happen but safety check)
            if not isinstance(fields, dict):
                continue
            
            # Check if collection already exists
            existing_collections = await db.list_collection_names()
            if collection_name in existing_collections:
                created_collections.append({
                    "name": collection_name,
                    "status": "already_exists"
                })
                continue
            
            # Build validator from fields
            validator = build_json_schema_validator(collection_name, fields)
            
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
                "fields": len(fields)
            })
        
        # Create indexes
        created_indexes = []
        
        # Strategy 1: Use explicit indexes from result.indexes
        for index_info in indexes:
            # Parse index info (e.g., "users.email", "orders.userId")
            if "." in index_info:
                collection_name, field = index_info.split(".", 1)
                
                # Check if collection exists in schema
                if collection_name not in schema:
                    continue
                
                try:
                    collection = db[collection_name]
                    await collection.create_index([(field, 1)])
                    created_indexes.append({
                        "collection": collection_name,
                        "field": field
                    })
                except Exception:
                    # Index creation failed, continue
                    pass
        
        # Strategy 2: Auto-create indexes for common patterns
        for collection_name, fields in schema.items():
            if not isinstance(fields, dict):
                continue
                
            collection = db[collection_name]
            
            # Index foreign key references (fields ending with Id or containing "ref:")
            for field_name, field_type in fields.items():
                if field_name == "_id":
                    continue
                    
                # Check if it's a reference field
                field_type_str = str(field_type).lower()
                is_reference = (
                    field_name.endswith("Id") or 
                    field_name.endswith("_id") or
                    "ref:" in field_type_str or
                    "objectid" in field_type_str
                )
                
                if is_reference and field_name not in [idx["field"] for idx in created_indexes if idx["collection"] == collection_name]:
                    try:
                        await collection.create_index([(field_name, 1)])
                        created_indexes.append({
                            "collection": collection_name,
                            "field": field_name,
                            "auto": True
                        })
                    except Exception:
                        pass
                
                # Index date fields for time-based queries
                if "date" in field_type_str and field_name not in [idx["field"] for idx in created_indexes if idx["collection"] == collection_name]:
                    try:
                        await collection.create_index([(field_name, -1)])  # Descending for recent-first
                        created_indexes.append({
                            "collection": collection_name,
                            "field": field_name,
                            "auto": True
                        })
                    except Exception:
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
