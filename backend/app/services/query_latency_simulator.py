from __future__ import annotations

from typing import Any, Dict, List


def calculate_field_depth(schema: Dict[str, Any]) -> int:
    """Calculate maximum nesting depth of the schema."""
    max_depth = 1
    
    def walk(node, depth=1):
        nonlocal max_depth
        if not isinstance(node, dict):
            return
        
        max_depth = max(max_depth, depth)
        for field_name, field_type in node.items():
            if isinstance(field_type, dict):
                walk(field_type, depth + 1)
    
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    for collection_name, fields in schema_def.items():
        if isinstance(fields, dict):
            walk(fields, 1)
    
    return max_depth


def detect_references(schema: Dict[str, Any]) -> int:
    """Detect number of reference fields (ObjectId refs)."""
    ref_count = 0
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    for collection_name, fields in schema_def.items():
        if not isinstance(fields, dict):
            continue
        
        for field_name, field_type in fields.items():
            field_str = str(field_type).lower()
            if "ref:" in field_str or "reference" in field_str or "objectid" in field_str:
                ref_count += 1
    
    return ref_count


def detect_arrays(schema: Dict[str, Any]) -> int:
    """Detect number of array fields (not just any field ending with 's')."""
    array_count = 0
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    # Exclude common non-array fields ending in 's'
    non_array_endings = ["status", "address", "class", "business", "access", "progress", "process"]
    
    for collection_name, fields in schema_def.items():
        if not isinstance(fields, dict):
            continue
        
        for field_name, field_type in fields.items():
            field_str = str(field_type).lower()
            field_lower = field_name.lower()
            
            # Skip known non-arrays
            if field_lower in non_array_endings:
                continue
            
            # Explicit array or semantic plural
            if "array" in field_str or isinstance(field_type, list):
                array_count += 1
            elif field_name.endswith("s") and any(keyword in field_lower for keyword in 
                ["comment", "review", "item", "tag", "member", "rating", "notification", 
                 "message", "log", "event", "document", "file", "image", "video", "photo"]):
                array_count += 1
    
    return array_count


def count_indexes(schema: Dict[str, Any]) -> int:
    """Count assumed indexes (typically on _id, foreign keys, common queries)."""
    # Rough estimate: assume index on _id, and one index per reference field
    indexes = 1  # _id always indexed
    indexes += detect_references(schema)  # Assume foreign keys are indexed
    return indexes


def calculate_latency(
    load: int,
    query_type: str,
    field_depth: int,
    references: int,
    arrays: int,
    has_index: bool
) -> float:
    """
    Calculate query latency in milliseconds based on parameters.
    
    Formula adjusts for:
    - Query type complexity
    - Load size
    - Field depth (nested field access penalty)
    - Reference chain (lookup operations)
    - Array operations
    - Index presence
    """
    base_time = 0.0
    
    # Base latency based on query type
    if query_type == "find_embedded":
        base_time = 5.0  # Simple find baseline
    elif query_type == "find_embedded_indexed":
        base_time = 2.0  # Indexed find is faster
    elif query_type == "lookup":
        base_time = 8.0  # $lookup has overhead
    elif query_type == "lookup_indexed":
        base_time = 3.0  # Indexed lookup is much faster
    elif query_type == "array_query":
        base_time = 12.0  # Array field queries are slower
    elif query_type == "array_query_indexed":
        base_time = 4.0  # Indexed array queries
    elif query_type == "aggregation":
        base_time = 15.0  # Aggregation pipeline complexity
    else:
        base_time = 5.0
    
    # Load scaling: log scale (slower than linear but faster than exp)
    load_factor = max(1.0, (load / 50000) ** 0.7)
    
    # Depth penalty: each nesting level adds complexity
    depth_penalty = max(1.0, 1.0 + (field_depth - 1) * 0.15)
    
    # Reference chain penalty: each $lookup adds latency
    reference_penalty = 1.0 + (references * 0.25)
    
    # Array operations penalty
    array_penalty = 1.0 + (arrays * 0.3)
    
    # Index multiplier: non-indexed queries are 3-5x slower
    index_multiplier = 1.0 if has_index else 4.0
    
    latency = base_time * load_factor * depth_penalty * reference_penalty * array_penalty * index_multiplier
    
    return latency


def simulate_query_latency(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulate query latency for various query patterns.
    Output shows load levels with corresponding latency and status.
    """
    # Extract schema metrics
    field_depth = calculate_field_depth(schema)
    references = detect_references(schema)
    arrays = detect_arrays(schema)
    indexes = count_indexes(schema)
    
    # Load levels to test
    load_levels = [50000, 500000, 2000000]
    
    # Query patterns to simulate
    query_patterns = [
        {
            "name": "Find in Embedded Docs",
            "type": "find_embedded",
            "description": ".find() on embedded document fields",
            "indexed": False
        },
        {
            "name": "Find in Embedded (Indexed)",
            "type": "find_embedded_indexed",
            "description": ".find() with index on field",
            "indexed": True
        },
        {
            "name": "$lookup on References",
            "type": "lookup",
            "description": "$lookup joining referenced collections",
            "indexed": False
        },
        {
            "name": "$lookup (Indexed)",
            "type": "lookup_indexed",
            "description": "$lookup with indexed foreign key",
            "indexed": True
        },
        {
            "name": "Array Field Query",
            "type": "array_query",
            "description": "Query on array fields (no index)",
            "indexed": False
        },
        {
            "name": "Array Field (Indexed)",
            "type": "array_query_indexed",
            "description": "Query on array fields with index",
            "indexed": True
        },
        {
            "name": "Aggregation Pipeline",
            "type": "aggregation",
            "description": "Complex aggregation with multiple stages",
            "indexed": False
        }
    ]
    
    results = []
    
    for pattern in query_patterns:
        latencies = []
        
        for load in load_levels:
            latency = calculate_latency(
                load,
                pattern["type"],
                field_depth,
                references if pattern["indexed"] else references,
                arrays,
                pattern["indexed"] and indexes > 0
            )
            
            # Status based on latency thresholds
            if latency < 50:
                status = "✅"
            elif latency < 200:
                status = "⚠️"
            else:
                status = "❌"
            
            latencies.append({
                "load": load,
                "latency_ms": round(latency, 1),
                "status": status,
                "display": f"{round(latency, 0):.0f}ms {status}"
            })
        
        results.append({
            "name": pattern["name"],
            "description": pattern["description"],
            "indexed": pattern["indexed"],
            "latencies": latencies
        })
    
    return {
        "success": True,
        "schema_metrics": {
            "field_depth": field_depth,
            "references": references,
            "arrays": arrays,
            "indexes": indexes
        },
        "query_simulations": results,
        "recommendations": generate_recommendations(field_depth, references, arrays, indexes)
    }


def generate_recommendations(field_depth: int, references: int, arrays: int, indexes: int) -> List[Dict[str, Any]]:
    """Generate query optimization recommendations based on schema metrics."""
    recommendations = []
    
    if field_depth > 5:
        recommendations.append({
            "issue": "Deep nesting detected",
            "severity": "high",
            "suggestion": "Consider denormalizing deeply nested fields or using projection",
            "impact": "Reduces field access latency by 30-40%"
        })
    
    if references > 3:
        recommendations.append({
            "issue": "Multiple reference fields",
            "severity": "medium",
            "suggestion": "Index foreign key fields and consider embedding frequently-joined data",
            "impact": "Speeds up lookups by 60-70% with proper indexing"
        })
    
    if arrays > 2:
        recommendations.append({
            "issue": "Multiple array fields",
            "severity": "medium",
            "suggestion": "Create compound indexes on array fields for array queries",
            "impact": "Array query performance improves by 50-60%"
        })
    
    if indexes < 3:
        recommendations.append({
            "issue": f"Few indexes ({indexes} detected)",
            "severity": "high",
            "suggestion": "Add indexes on frequently queried fields (foreign keys, status, dates)",
            "impact": "Can improve query latency by 3-5x"
        })
    
    if not recommendations:
        recommendations.append({
            "issue": "Schema is well-optimized",
            "severity": "info",
            "suggestion": "Continue monitoring query performance in production",
            "impact": "Current indexing strategy is effective"
        })
    
    return recommendations
