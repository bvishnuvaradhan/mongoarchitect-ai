from __future__ import annotations

from typing import Any, Dict, List


def calculate_doc_size(schema: Dict[str, Any]) -> int:
    """
    Estimate document size in MB based on schema.
    Rough estimation: each field ~0.5KB + nested depth impact
    """
    size_kb = 0
    
    def walk_schema(node, depth=0):
        nonlocal size_kb
        if not isinstance(node, dict):
            return
        
        for field_name, field_type in node.items():
            # Base size per field
            size_kb += 0.5
            
            # Add size for field name
            size_kb += len(field_name) * 0.01
            
            # Add size for nested content
            if isinstance(field_type, dict):
                size_kb += depth * 0.2  # Penalty for nesting
                walk_schema(field_type, depth + 1)
    
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    for collection_name, fields in schema_def.items():
        if isinstance(fields, dict):
            walk_schema(fields)
    
    return size_kb / 1024  # Convert to MB


def detect_array_fields(schema: Dict[str, Any]) -> List[str]:
    """Detect fields that are arrays or plural (suggest bucketing)."""
    arrays = []
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    for collection_name, fields in schema_def.items():
        if not isinstance(fields, dict):
            continue
        
        for field_name, field_type in fields.items():
            if "array" in str(field_type).lower() or field_name.endswith("s"):
                arrays.append(field_name)
    
    return arrays


def calculate_schema_depth(schema: Dict[str, Any]) -> int:
    """Calculate maximum nesting depth."""
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    max_depth = 1
    
    def walk(node, depth=1):
        nonlocal max_depth
        if not isinstance(node, dict):
            return
        
        max_depth = max(max_depth, depth)
        for field_name, field_type in node.items():
            if isinstance(field_type, dict):
                walk(field_type, depth + 1)
    
    for collection_name, fields in schema_def.items():
        if isinstance(fields, dict):
            walk(fields, 1)
    
    return max_depth


def analyze_evolution(schema: Dict[str, Any], months_ahead: int = 12) -> Dict[str, Any]:
    """
    Analyze schema evolution over time and predict issues.
    Simulates growth and generates timeline with actionable predictions.
    """
    current_size = calculate_doc_size(schema)
    max_depth = calculate_schema_depth(schema)
    arrays = detect_array_fields(schema)
    
    # Growth parameters
    size_growth_rate = 0.08  # 8% monthly growth
    depth_risk = max_depth > 6
    array_risk = len(arrays) > 0
    write_rate_growth = 0.05  # 5% monthly growth
    array_growth_rate = 0.12  # 12% monthly growth for arrays
    
    timeline = []
    predictions = []
    
    # Generate monthly projections
    for month in range(1, months_ahead + 1):
        month_data = {
            "month": month,
            "projected_size": current_size * ((1 + size_growth_rate) ** month),
            "write_rate": 100 * ((1 + write_rate_growth) ** month),
            "array_size": 10 * ((1 + array_growth_rate) ** month) if array_risk else 0,
            "issues": [],
            "suggestions": []
        }
        
        # ===== PREDICTION 1: Split Embedded Docs =====
        if array_risk and month_data["array_size"] > 8 and month not in [p["month"] for p in predictions if p["fix"] == "split"]:
            predictions.append({
                "month": month,
                "problem": f"📋 {arrays[0]}[] embedding large ({month_data['array_size']:.1f}MB)",
                "fix": "split",
                "action": "Split embedded docs into sub-collection"
            })
            month_data["issues"].append(f"Embedded array growth in {arrays[0]}")
            month_data["suggestions"].append("Split into separate collection")
        
        # ===== PREDICTION 2: Compound Index =====
        # Suggest compound index around month 3-7 when queries would benefit
        if month == 5 and len(arrays) > 0 and month not in [p["month"] for p in predictions if p["fix"] == "compound_index"]:
            predictions.append({
                "month": month,
                "problem": f"🔍 Slow queries on {arrays[0]}",
                "fix": "compound_index",
                "action": f"Add compound index on (userId, {arrays[0]}, createdAt)"
            })
            month_data["issues"].append("Query performance degradation")
            month_data["suggestions"].append("Create compound indexes")
        
        # ===== PREDICTION 3: Shard Key =====
        if month_data["write_rate"] > 300 and month not in [p["month"] for p in predictions if p["fix"] == "shard"]:
            predictions.append({
                "month": month,
                "problem": f"✍️ High write rate ({month_data['write_rate']:.0f} ops/sec)",
                "fix": "shard",
                "action": "Introduce shard key (userId or tenant_id)"
            })
            month_data["issues"].append("Write rate bottleneck")
            month_data["suggestions"].append("Plan sharding strategy")
        
        # ===== PREDICTION 4: Convert Embedded → Reference =====
        if max_depth > 5 and month == 6 and month not in [p["month"] for p in predictions if p["fix"] == "convert_reference"]:
            predictions.append({
                "month": month,
                "problem": "🔗 Deep nesting affecting performance",
                "fix": "convert_reference",
                "action": "Convert embedded documents to references"
            })
            month_data["issues"].append("Deep nesting penalty")
            month_data["suggestions"].append("Denormalize and use references")
        
        # ===== PREDICTION 5: Archive Old Collections =====
        if month >= 11 and month not in [p["month"] for p in predictions if p["fix"] == "archive"]:
            predictions.append({
                "month": month,
                "problem": "📦 Collection size at risk (12MB+)",
                "fix": "archive",
                "action": "Implement archival policy for old data"
            })
            month_data["issues"].append("Collection bloat")
            month_data["suggestions"].append("Archive historical data")
        
        # Document size check
        if month_data["projected_size"] > 12:
            month_data["issues"].append(f"📦 Document size ↑ ({month_data['projected_size']:.1f}MB)")
            month_data["suggestions"].append("Split collection into sub-documents")
        
        # Depth check
        if depth_risk and month > 4:
            month_data["issues"].append(f"🔗 Nesting depth ↑ (depth: {max_depth})")
            month_data["suggestions"].append("Denormalize frequently-accessed nested fields")
        
        # Write rate check
        if month_data["write_rate"] > 400 and month > 7:
            month_data["issues"].append(f"✍️ Write rate ↑ ({month_data['write_rate']:.0f} ops/sec)")
            month_data["suggestions"].append("Consider Sharding strategy")
        
        if month_data["issues"]:
            timeline.append(month_data)
    
    # Generate growth data for graph
    growth_data = []
    for month in range(0, months_ahead + 1):
        size = current_size * ((1 + size_growth_rate) ** month)
        write_rate = 100 * ((1 + write_rate_growth) ** month)
        growth_data.append({
            "month": month,
            "size": size,
            "write_rate": write_rate
        })
    
    # Risk assessment
    risk_level = "🟢 Low"
    if current_size > 10:
        risk_level = "🔴 High"
    elif current_size > 5 or depth_risk:
        risk_level = "🟡 Medium"
    
    return {
        "success": True,
        "schema_name": schema.get("inputText", "")[:50],
        "current_size": current_size,
        "max_depth": max_depth,
        "array_fields": arrays,
        "risk_level": risk_level,
        "timeline": timeline,
        "growth_data": growth_data,
        "predictions": predictions,  # New: Specific action predictions
        "recommendations": [
            {
                "title": "Document Size",
                "current": f"{current_size:.2f}MB",
                "threshold": "12MB",
                "status": "⚠️" if current_size > 8 else "✅"
            },
            {
                "title": "Nesting Depth",
                "current": f"{max_depth} levels",
                "threshold": "6 levels",
                "status": "⚠️" if depth_risk else "✅"
            },
            {
                "title": "Array Fields",
                "current": f"{len(arrays)} found",
                "threshold": "2+ risk",
                "status": "⚠️" if array_risk else "✅"
            }
        ]
    }
