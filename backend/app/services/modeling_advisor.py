from __future__ import annotations

from typing import Any, Dict, List


def detect_time_series(schema: Dict[str, Any]) -> bool:
    """Detect if schema contains time-series data patterns."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
            
        # Check for timestamp fields
        has_timestamp = any(
            "date" in str(field_type).lower() or 
            "time" in field_name.lower() or
            "timestamp" in field_name.lower()
            for field_name, field_type in fields.items()
        )
        
        # Check for measurement/sensor/telemetry patterns
        has_measurements = any(
            name in collection_name.lower()
            for name in ["sensor", "telemetry", "measurement", "metric", "log", "event"]
        )
        
        # Check for value fields (common in time-series)
        has_value_fields = any(
            "value" in field_name.lower() or
            "reading" in field_name.lower() or
            "temperature" in field_name.lower() or
            "pressure" in field_name.lower()
            for field_name in fields.keys()
        )
        
        if has_timestamp and (has_measurements or has_value_fields):
            indicators.append({
                "collection": collection_name,
                "confidence": "high",
                "reasons": [
                    "Timestamp field detected" if has_timestamp else "",
                    "Measurement pattern in name" if has_measurements else "",
                    "Value/reading fields present" if has_value_fields else ""
                ]
            })
    
    return indicators


def detect_capped_collection(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from capped collections."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # Log/audit/activity patterns
        is_log_like = any(
            pattern in collection_name.lower()
            for pattern in ["log", "audit", "activity", "history", "event", "notification"]
        )
        
        # Has timestamp for ordering
        has_timestamp = any(
            "date" in str(field_type).lower() or "time" in field_name.lower()
            for field_name, field_type in fields.items()
        )
        
        if is_log_like and has_timestamp:
            indicators.append({
                "collection": collection_name,
                "confidence": "medium",
                "reasons": [
                    "Log/audit pattern detected",
                    "Natural insertion order with timestamps",
                    "Likely append-only workload"
                ]
            })
    
    return indicators


def detect_ttl_index(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from TTL indexes."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # Temporary data patterns
        is_temporary = any(
            pattern in collection_name.lower()
            for pattern in ["session", "token", "cache", "temp", "verification", "otp", "code"]
        )
        
        # Expiration patterns
        has_expiry = any(
            "expir" in field_name.lower() or
            "ttl" in field_name.lower() or
            "valid_until" in field_name.lower() or
            "expires_at" in field_name.lower()
            for field_name in fields.keys()
        )
        
        # Time-bound data
        has_created_at = any(
            "created" in field_name.lower() and "date" in str(field_type).lower()
            for field_name, field_type in fields.items()
        )
        
        if (is_temporary and has_created_at) or has_expiry:
            indicators.append({
                "collection": collection_name,
                "confidence": "high" if has_expiry else "medium",
                "field": next((f for f in fields.keys() if "expir" in f.lower() or "created" in f.lower()), "createdAt"),
                "reasons": [
                    "Temporary data pattern" if is_temporary else "",
                    "Explicit expiry field found" if has_expiry else "",
                    "Time-bound data lifecycle" if has_created_at else ""
                ]
            })
    
    return indicators


def detect_bucketing_pattern(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from bucketing pattern."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # High-frequency data patterns
        is_high_frequency = any(
            pattern in collection_name.lower()
            for pattern in ["sensor", "metric", "measurement", "reading", "sample", "tick", "event"]
        )
        
        # Has timestamp
        has_timestamp = any(
            "date" in str(field_type).lower() or "time" in field_name.lower()
            for field_name, field_type in fields.items()
        )
        
        # Has source/device identifier
        has_source = any(
            name in field_name.lower()
            for field_name in fields.keys()
            for name in ["device", "sensor", "source", "station", "node"]
        )
        
        if is_high_frequency and has_timestamp and has_source:
            indicators.append({
                "collection": collection_name,
                "confidence": "high",
                "reasons": [
                    "High-frequency data pattern",
                    "Timestamp-based data",
                    "Multiple sources/devices",
                    "Reduces document count by 100-1000x"
                ]
            })
    
    return indicators


def detect_outlier_pattern(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from outlier pattern."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # Collections with potential for unbounded arrays
        has_array_fields = any(
            "array" in str(field_type).lower() or
            field_name.endswith("s") or  # Plural suggests array
            field_name in ["items", "tags", "comments", "reviews", "ratings"]
            for field_name, field_type in fields.items()
        )
        
        # Social/activity patterns
        has_social_pattern = any(
            pattern in collection_name.lower()
            for pattern in ["user", "post", "product", "article", "video"]
        )
        
        if has_array_fields and has_social_pattern:
            indicators.append({
                "collection": collection_name,
                "confidence": "medium",
                "reasons": [
                    "Potential unbounded array growth",
                    "Social/activity pattern detected",
                    "Separate overflow documents for outliers",
                    "Keep main document size bounded"
                ]
            })
    
    return indicators


def detect_subset_pattern(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from subset pattern."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        field_count = len(fields)
        
        # Many fields suggest some are rarely accessed
        has_many_fields = field_count > 15
        
        # Product/profile patterns often have subsets
        subset_candidates = any(
            pattern in collection_name.lower()
            for pattern in ["product", "user", "profile", "customer", "item"]
        )
        
        # Fields suggesting detailed/extended data
        has_detailed_fields = any(
            field_name in ["description", "details", "specifications", "metadata", "extended", "full"]
            for field_name in fields.keys()
        )
        
        if has_many_fields and (subset_candidates or has_detailed_fields):
            indicators.append({
                "collection": collection_name,
                "confidence": "medium",
                "field_count": field_count,
                "reasons": [
                    f"Large number of fields ({field_count})",
                    "Some fields rarely accessed",
                    "Keep frequently-used fields in main document",
                    "Move rarely-used to separate collection"
                ]
            })
    
    return indicators


def detect_extended_reference(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from extended reference pattern."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # Find reference fields
        reference_fields = [
            (field_name, field_type)
            for field_name, field_type in fields.items()
            if "ref:" in str(field_type).lower() or 
               field_name.endswith("Id") or
               "objectid" in str(field_type).lower()
        ]
        
        # Collections that often join
        is_transaction_like = any(
            pattern in collection_name.lower()
            for pattern in ["order", "cart", "transaction", "booking", "reservation", "invoice"]
        )
        
        if reference_fields and is_transaction_like:
            indicators.append({
                "collection": collection_name,
                "confidence": "high",
                "reference_count": len(reference_fields),
                "reasons": [
                    "Many reference fields detected",
                    "Frequent joins likely",
                    "Denormalize key fields to avoid lookups",
                    "Example: Store userName with userId"
                ]
            })
    
    return indicators


def detect_polymorphic_pattern(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect if schema would benefit from polymorphic pattern."""
    indicators = []
    
    for collection_name, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        
        # Type/category fields suggest polymorphism
        has_type_field = any(
            field_name in ["type", "category", "kind", "variant", "status"]
            for field_name in fields.keys()
        )
        
        # Flexible schema patterns
        polymorphic_candidates = any(
            pattern in collection_name.lower()
            for pattern in ["notification", "event", "payment", "attachment", "content", "message"]
        )
        
        if has_type_field and polymorphic_candidates:
            indicators.append({
                "collection": collection_name,
                "confidence": "medium",
                "reasons": [
                    "Type discriminator field detected",
                    "Multiple variants in single collection",
                    "Schema varies by type",
                    "More flexible than separate collections"
                ]
            })
    
    return indicators


def analyze_schema(schema_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze a schema and provide MongoDB modeling pattern recommendations.
    """
    result = schema_data.get("result", {})
    schema = result.get("schema", {})
    
    if not schema:
        return {
            "success": False,
            "error": "No schema found in data"
        }
    
    recommendations = []
    
    # Detect patterns
    time_series = detect_time_series(schema)
    if time_series:
        for indicator in time_series:
            recommendations.append({
                "pattern": "Time-Series Collection",
                "collection": indicator["collection"],
                "priority": "high",
                "confidence": indicator["confidence"],
                "description": "Use MongoDB's native time-series collections for optimal storage and query performance",
                "reasons": [r for r in indicator["reasons"] if r],
                "implementation": [
                    "db.createCollection('{}', {{ timeseries: {{ timeField: 'timestamp', metaField: 'deviceId', granularity: 'seconds' }} }})".format(indicator["collection"]),
                    "Automatic data bucketing and compression",
                    "Optimized for time-range queries"
                ],
                "benefits": [
                    "Up to 90% storage reduction",
                    "Faster time-range queries",
                    "Automatic data expiration"
                ]
            })
    
    capped = detect_capped_collection(schema)
    if capped:
        for indicator in capped:
            recommendations.append({
                "pattern": "Capped Collection",
                "collection": indicator["collection"],
                "priority": "medium",
                "confidence": indicator["confidence"],
                "description": "Fixed-size collection with automatic oldest-document removal",
                "reasons": indicator["reasons"],
                "implementation": [
                    "db.createCollection('{}', {{ capped: true, size: 5242880, max: 5000 }})".format(indicator["collection"]),
                    "Natural insertion order guaranteed",
                    "Automatic FIFO cleanup"
                ],
                "benefits": [
                    "Bounded storage usage",
                    "High write throughput",
                    "No index overhead for insertion order"
                ]
            })
    
    ttl = detect_ttl_index(schema)
    if ttl:
        for indicator in ttl:
            recommendations.append({
                "pattern": "TTL Index",
                "collection": indicator["collection"],
                "priority": "high",
                "confidence": indicator["confidence"],
                "description": "Automatic document expiration based on date field",
                "reasons": [r for r in indicator["reasons"] if r],
                "implementation": [
                    "db.{}.createIndex({{ {}: 1 }}, {{ expireAfterSeconds: 3600 }})".format(
                        indicator["collection"], 
                        indicator["field"]
                    ),
                    "Background thread removes expired documents",
                    "Set expiration time in seconds"
                ],
                "benefits": [
                    "Automatic data cleanup",
                    "No manual deletion needed",
                    "Maintains optimal collection size"
                ]
            })
    
    bucketing = detect_bucketing_pattern(schema)
    if bucketing:
        for indicator in bucketing:
            recommendations.append({
                "pattern": "Bucketing Pattern",
                "collection": indicator["collection"],
                "priority": "high",
                "confidence": indicator["confidence"],
                "description": "Group multiple measurements into time buckets",
                "reasons": indicator["reasons"],
                "implementation": [
                    "Store arrays of measurements in buckets",
                    "Bucket by time period (hour/day)",
                    "Reduce document count dramatically"
                ],
                "benefits": [
                    "100-1000x fewer documents",
                    "Better index efficiency",
                    "Improved query performance"
                ]
            })
    
    outlier = detect_outlier_pattern(schema)
    if outlier:
        for indicator in outlier:
            recommendations.append({
                "pattern": "Outlier Pattern",
                "collection": indicator["collection"],
                "priority": "medium",
                "confidence": indicator["confidence"],
                "description": "Separate overflow storage for documents exceeding normal size",
                "reasons": indicator["reasons"],
                "implementation": [
                    "Keep most items in main document array",
                    "Create overflow document when threshold reached",
                    "Link with _id reference"
                ],
                "benefits": [
                    "Prevents document bloat",
                    "Maintains query performance",
                    "Handles edge cases gracefully"
                ]
            })
    
    subset = detect_subset_pattern(schema)
    if subset:
        for indicator in subset:
            recommendations.append({
                "pattern": "Subset Pattern",
                "collection": indicator["collection"],
                "priority": "medium",
                "confidence": indicator["confidence"],
                "description": "Split frequently and rarely accessed fields",
                "reasons": indicator["reasons"],
                "implementation": [
                    "Main collection: frequently accessed fields only",
                    "Details collection: rarely used fields",
                    "Link with same _id"
                ],
                "benefits": [
                    "Smaller working set",
                    "Faster common queries",
                    "Better memory utilization"
                ]
            })
    
    extended_ref = detect_extended_reference(schema)
    if extended_ref:
        for indicator in extended_ref:
            recommendations.append({
                "pattern": "Extended Reference Pattern",
                "collection": indicator["collection"],
                "priority": "high",
                "confidence": indicator["confidence"],
                "description": "Denormalize frequently-accessed reference data",
                "reasons": indicator["reasons"],
                "implementation": [
                    "Store reference ID + key fields",
                    "Example: {{ userId: ObjectId, userName: 'John', userEmail: 'john@example.com' }}",
                    "Avoid joins for common queries"
                ],
                "benefits": [
                    "Eliminates lookup queries",
                    "Single collection read",
                    "Better read performance"
                ]
            })
    
    polymorphic = detect_polymorphic_pattern(schema)
    if polymorphic:
        for indicator in polymorphic:
            recommendations.append({
                "pattern": "Polymorphic Pattern",
                "collection": indicator["collection"],
                "priority": "low",
                "confidence": indicator["confidence"],
                "description": "Single collection for related but varying schemas",
                "reasons": indicator["reasons"],
                "implementation": [
                    "Add type discriminator field",
                    "Vary fields based on type",
                    "Use schema validation per type"
                ],
                "benefits": [
                    "Flexible schema per type",
                    "Single collection queries",
                    "Easier to add new types"
                ]
            })
    
    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda x: (priority_order.get(x["priority"], 3), x["pattern"]))
    
    return {
        "success": True,
        "schema_name": schema_data.get("inputText", "")[:50],
        "collection_count": len(schema),
        "recommendations": recommendations,
        "summary": {
            "total_patterns": len(recommendations),
            "high_priority": len([r for r in recommendations if r["priority"] == "high"]),
            "medium_priority": len([r for r in recommendations if r["priority"] == "medium"]),
            "low_priority": len([r for r in recommendations if r["priority"] == "low"])
        }
    }
