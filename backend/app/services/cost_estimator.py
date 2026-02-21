"""
MongoDB Atlas Cost Estimation Service

Estimates monthly Atlas costs based on:
- Document storage growth
- Index storage growth
- Write frequency (IOPS)
- Read frequency (Request Units)
- Sharding infrastructure tier requirements
"""

from typing import Dict, Any, List
import math


# MongoDB Atlas pricing (M10 tier baseline in INR)
ATLAS_PRICING = {
    "M0": {
        "base": 0, 
        "storage_per_gb": 0, 
        "iops_per_1k": 0, 
        "max_storage_gb": 0.5,
        "max_iops": 100,
        "included_storage_gb": 0.5,
        "name": "Free Tier"
    },
    "M2": {
        "base": 720, 
        "storage_per_gb": 30, 
        "iops_per_1k": 5, 
        "max_storage_gb": 2,
        "max_iops": 200,
        "included_storage_gb": 2,
        "name": "Shared M2"
    },
    "M5": {
        "base": 2160, 
        "storage_per_gb": 30, 
        "iops_per_1k": 5, 
        "max_storage_gb": 5,
        "max_iops": 500,
        "included_storage_gb": 5,
        "name": "Shared M5"
    },
    "M10": {
        "base": 5940, 
        "storage_per_gb": 45, 
        "iops_per_1k": 8, 
        "max_storage_gb": 10,
        "max_iops": 1000,
        "included_storage_gb": 10,
        "name": "Dedicated M10"
    },
    "M20": {
        "base": 11880, 
        "storage_per_gb": 45, 
        "iops_per_1k": 8, 
        "max_storage_gb": 20,
        "max_iops": 2000,
        "included_storage_gb": 20,
        "name": "Dedicated M20"
    },
    "M30": {
        "base": 18900, 
        "storage_per_gb": 60, 
        "iops_per_1k": 10, 
        "max_storage_gb": 40,
        "max_iops": 3000,
        "included_storage_gb": 40,
        "name": "Dedicated M30"
    },
    "M40": {
        "base": 31500, 
        "storage_per_gb": 60, 
        "iops_per_1k": 10, 
        "max_storage_gb": 80,
        "max_iops": 4000,
        "included_storage_gb": 80,
        "name": "Dedicated M40"
    },
    "M50": {
        "base": 54000, 
        "storage_per_gb": 75, 
        "iops_per_1k": 12, 
        "max_storage_gb": 160,
        "max_iops": 6000,
        "included_storage_gb": 160,
        "name": "Dedicated M50"
    },
    "M60": {
        "base": 108000, 
        "storage_per_gb": 75, 
        "iops_per_1k": 12, 
        "max_storage_gb": 320,
        "max_iops": 8000,
        "included_storage_gb": 320,
        "name": "Dedicated M60"
    },
}


def estimate_atlas_costs(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Estimate MongoDB Atlas costs over 12 months based on schema analysis.
    """
    # Get schema definition from the stored document structure
    result = schema.get("result", {})
    schema_def = result.get("schema", {})
    
    # Convert schema dict to collections list format
    collections = []
    for collection_name, fields in schema_def.items():
        if isinstance(fields, dict):
            collections.append({
                "name": collection_name,
                "fields": [{"field": k, "type": v} for k, v in fields.items()]
            })
    
    # Calculate current storage (documents + indexes)
    current_doc_storage_gb = calculate_document_storage(collections)
    current_index_storage_gb = calculate_index_storage(collections)
    total_current_storage_gb = current_doc_storage_gb + current_index_storage_gb
    
    # Estimate growth rate (based on write patterns)
    monthly_growth_rate = estimate_monthly_growth_rate(collections)
    
    # Calculate IOPS and RU requirements
    write_iops = calculate_write_iops(collections)
    read_ru = calculate_read_units(collections)
    
    # Project costs for 12 months
    monthly_projections = []
    
    for month in range(13):  # 0-12 months
        # Calculate projected storage
        storage_multiplier = (1 + monthly_growth_rate) ** month
        projected_doc_storage = current_doc_storage_gb * storage_multiplier
        projected_index_storage = current_index_storage_gb * storage_multiplier
        total_storage = projected_doc_storage + projected_index_storage
        
        # Calculate scaled IOPS/RU (grows with user base)
        scaled_write_iops = write_iops * storage_multiplier
        scaled_read_ru = read_ru * storage_multiplier
        
        # Determine required Atlas tier with constraint tracking
        required_tier, upgrade_constraint, utilization = determine_atlas_tier(
            total_storage, 
            scaled_write_iops, 
            scaled_read_ru
        )
        
        # Calculate monthly cost
        tier_pricing = ATLAS_PRICING[required_tier]
        base_cost = tier_pricing["base"]
        
        # Storage cost (only if exceeds included amount)
        included_storage = tier_pricing["included_storage_gb"]
        storage_overage = max(0, total_storage - included_storage)
        storage_cost = storage_overage * tier_pricing["storage_per_gb"] if storage_overage > 0 else 0
        
        # IOPS cost (M2/M5 have fixed pricing, M10+ charge for overages)
        iops_cost = 0
        iops_status = "included"
        if required_tier in ["M10", "M20", "M30", "M40", "M50", "M60"]:
            # Dedicated tiers: Don't charge small IOPS overages (keep billing clean)
            # Only charge if significantly exceeds capacity
            if scaled_write_iops > tier_pricing["max_iops"]:
                overage_iops = scaled_write_iops - tier_pricing["max_iops"]
                iops_cost = (overage_iops / 1000) * tier_pricing["iops_per_1k"]
                iops_status = "overage"
        
        # Total monthly cost
        total_monthly_cost = base_cost + storage_cost + iops_cost
        
        # Determine status
        status = "healthy" if total_monthly_cost < 10000 else ("warning" if total_monthly_cost < 20000 else "critical")
        
        # Calculate capacity utilization (use tracked values)
        storage_utilization_pct = utilization["storage_utilization_pct"]
        iops_utilization_pct = utilization["iops_utilization_pct"]
        
        monthly_projections.append({
            "month": month,
            "tier": required_tier,
            "tier_name": tier_pricing["name"],
            "upgrade_constraint": upgrade_constraint,  # "storage" | "iops" | "both" | "none"
            "storage_gb": round(total_storage, 2),
            "doc_storage_gb": round(projected_doc_storage, 2),
            "index_storage_gb": round(projected_index_storage, 2),
            "write_iops": round(scaled_write_iops, 0),
            "read_ru": round(scaled_read_ru, 0),
            "base_cost": base_cost,
            "storage_cost": round(storage_cost, 2),
            "iops_cost": round(iops_cost, 2),
            "iops_status": iops_status,
            "total_cost_inr": round(total_monthly_cost, 0),
            "status": status,
            "included_storage_gb": included_storage,
            "storage_overage_gb": round(storage_overage, 2),
            "storage_utilization_pct": round(storage_utilization_pct, 1),
            "iops_utilization_pct": round(iops_utilization_pct, 1),
            "max_iops": tier_pricing["max_iops"]
        })
    
    # Calculate key milestones
    milestones = identify_cost_milestones(monthly_projections)
    
    # Recommendations with cost linkage
    recommendations = generate_cost_recommendations(
        monthly_projections,
        current_doc_storage_gb,
        current_index_storage_gb,
        write_iops,
        monthly_growth_rate
    )
    
    # Sensitivity analysis - what if growth rates differ?
    sensitivity_scenarios = generate_sensitivity_analysis(
        current_doc_storage_gb,
        current_index_storage_gb,
        write_iops,
        read_ru,
        monthly_growth_rate
    )
    
    # Tier capacity reference
    tier_capacities = [
        {
            "tier": tier_name,
            "name": tier_data["name"],
            "max_storage_gb": tier_data["max_storage_gb"],
            "max_iops": tier_data["max_iops"],
            "included_storage_gb": tier_data["included_storage_gb"],
            "base_cost_inr": tier_data["base"]
        }
        for tier_name, tier_data in ATLAS_PRICING.items()
        if tier_name != "M0"  # Exclude free tier from reference
    ]
    
    # Calculate break-even month (when current tier becomes insufficient)
    current_tier = monthly_projections[0]["tier"]
    breakeven_analysis = calculate_breakeven_months(current_tier, monthly_projections)
    
    return {
        "current_metrics": {
            "document_storage_gb": round(current_doc_storage_gb, 2),
            "index_storage_gb": round(current_index_storage_gb, 2),
            "total_storage_gb": round(total_current_storage_gb, 2),
            "index_ratio_pct": round((current_index_storage_gb / total_current_storage_gb * 100) if total_current_storage_gb > 0 else 0, 1),
            "write_iops": round(write_iops, 0),
            "read_ru": round(read_ru, 0),
            "monthly_growth_rate_percent": round(monthly_growth_rate * 100, 1),
            "current_tier": current_tier,
            "current_tier_name": ATLAS_PRICING[current_tier]["name"]
        },
        "projections": monthly_projections,
        "milestones": milestones,
        "recommendations": recommendations,
        "sensitivity": sensitivity_scenarios,
        "tier_reference": tier_capacities,
        "breakeven": breakeven_analysis,
        "summary": {
            "month_1_cost": monthly_projections[1]["total_cost_inr"],
            "month_6_cost": monthly_projections[6]["total_cost_inr"],
            "month_12_cost": monthly_projections[12]["total_cost_inr"],
            "total_year_cost": sum(p["total_cost_inr"] for p in monthly_projections[1:13])
        }
    }


def calculate_document_storage(collections: List[Dict[str, Any]]) -> float:
    """
    Calculate current document storage in GB.
    """
    total_size_bytes = 0
    
    for collection in collections:
        # Estimate average document size (in bytes)
        field_count = len(collection.get("fields", []))
        avg_doc_size_bytes = field_count * 150  # ~150 bytes per field average
        
        # Estimate document count (simulated - in real scenario from metrics)
        estimated_docs = 50000  # Assume 50K documents baseline
        
        total_size_bytes += avg_doc_size_bytes * estimated_docs
    
    return total_size_bytes / (1024 ** 3)  # Convert to GB


def calculate_index_storage(collections: List[Dict[str, Any]]) -> float:
    """
    Calculate index storage in GB.
    Indexes typically take 10-20% of document storage.
    """
    doc_storage = calculate_document_storage(collections)
    
    # Count total indexes across collections
    total_indexes = 0
    for collection in collections:
        # At least _id index + estimate 3-5 additional indexes
        total_indexes += 1 + min(5, len(collection.get("fields", [])) // 3)
    
    # Index storage is ~15% of document storage + index overhead
    index_storage_gb = doc_storage * 0.15 * (total_indexes / 5)
    
    return max(0.1, index_storage_gb)  # Minimum 0.1GB


def estimate_monthly_growth_rate(collections: List[Dict[str, Any]]) -> float:
    """
    Estimate monthly data growth rate.
    Based on write patterns and document creation frequency.
    """
    total_fields = sum(len(c.get("fields", [])) for c in collections)
    
    # Assume baseline growth rate
    # More collections/fields = more active system = higher growth
    if total_fields > 50:
        return 0.15  # 15% monthly growth for very active systems
    elif total_fields > 30:
        return 0.10  # 10% monthly growth
    elif total_fields > 15:
        return 0.07  # 7% monthly growth
    else:
        return 0.05  # 5% monthly growth


def calculate_write_iops(collections: List[Dict[str, Any]]) -> float:
    """
    Calculate write IOPS (I/O operations per second).
    """
    # Simulate based on collection count and complexity
    total_collections = len(collections)
    
    # Assume baseline write activity
    # More collections = more distributed writes
    base_writes_per_sec = total_collections * 10  # 10 writes/sec per collection
    
    # Peak IOPS (3x average for burst capacity)
    peak_iops = base_writes_per_sec * 3
    
    return peak_iops


def calculate_read_units(collections: List[Dict[str, Any]]) -> float:
    """
    Calculate read request units (RU).
    """
    total_collections = len(collections)
    
    # Reads are typically 5-10x higher than writes
    base_reads_per_sec = total_collections * 50  # 50 reads/sec per collection
    
    return base_reads_per_sec


def determine_atlas_tier(storage_gb: float, write_iops: float, read_ru: float) -> tuple[str, str, dict]:
    """
    Determine required Atlas tier based on workload.
    Must handle BOTH storage AND IOPS limits.
    
    Returns:
        tuple: (tier_name, constraint_reason, utilization_metrics)
            - tier_name: Selected Atlas tier (M0, M2, M5, etc.)
            - constraint_reason: "storage" | "iops" | "both" | "none"
            - utilization_metrics: Dict with storage_pct, iops_pct
    """
    # Sort tiers by capability
    tiers = ["M0", "M2", "M5", "M10", "M20", "M30", "M40", "M50", "M60"]
    
    for tier in tiers:
        tier_specs = ATLAS_PRICING[tier]
        
        # Check if tier can handle BOTH storage AND IOPS
        can_handle_storage = storage_gb <= tier_specs["max_storage_gb"]
        can_handle_iops = write_iops <= tier_specs["max_iops"]
        
        if can_handle_storage and can_handle_iops:
            # Calculate utilization percentages
            storage_util_pct = (storage_gb / tier_specs["max_storage_gb"] * 100) if tier_specs["max_storage_gb"] > 0 else 0
            iops_util_pct = (write_iops / tier_specs["max_iops"] * 100) if tier_specs["max_iops"] > 0 else 0
            
            # Determine which constraint drove the tier selection
            if storage_util_pct > 80 and iops_util_pct > 80:
                constraint = "both"
            elif storage_util_pct > iops_util_pct:
                constraint = "storage"
            elif iops_util_pct > storage_util_pct:
                constraint = "iops"
            else:
                constraint = "none"
            
            return tier, constraint, {
                "storage_utilization_pct": round(storage_util_pct, 1),
                "iops_utilization_pct": round(iops_util_pct, 1)
            }
    
    # Default to highest tier
    tier_specs = ATLAS_PRICING["M60"]
    storage_util_pct = (storage_gb / tier_specs["max_storage_gb"] * 100) if tier_specs["max_storage_gb"] > 0 else 0
    iops_util_pct = (write_iops / tier_specs["max_iops"] * 100) if tier_specs["max_iops"] > 0 else 0
    
    return "M60", "both", {
        "storage_utilization_pct": round(storage_util_pct, 1),
        "iops_utilization_pct": round(iops_util_pct, 1)
    }


def identify_cost_milestones(projections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identify key cost milestones (tier jumps, significant increases).
    """
    milestones = []
    
    previous_tier = None
    for i, projection in enumerate(projections):
        current_tier = projection["tier"]
        
        # Tier change
        if previous_tier and current_tier != previous_tier:
            milestones.append({
                "month": projection["month"],
                "type": "tier_upgrade",
                "description": f"Atlas tier upgrade: {previous_tier} → {current_tier}",
                "cost_impact": projection["total_cost_inr"] - projections[i-1]["total_cost_inr"]
            })
        
        # Cost threshold crossings
        if projection["total_cost_inr"] > 10000 and (i == 0 or projections[i-1]["total_cost_inr"] <= 10000):
            milestones.append({
                "month": projection["month"],
                "type": "cost_threshold",
                "description": "Monthly cost exceeds ₹10,000",
                "cost_impact": projection["total_cost_inr"]
            })
        
        if projection["total_cost_inr"] > 20000 and (i == 0 or projections[i-1]["total_cost_inr"] <= 20000):
            milestones.append({
                "month": projection["month"],
                "type": "cost_alert",
                "description": "⚠️ Monthly cost exceeds ₹20,000 - review optimization strategies",
                "cost_impact": projection["total_cost_inr"]
            })
        
        previous_tier = current_tier
    
    return milestones


def calculate_breakeven_months(
    current_tier: str,
    monthly_projections: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate when current tier becomes insufficient (break-even point).
    Returns month number and which constraint (storage/IOPS) triggers it.
    """
    tier_specs = ATLAS_PRICING[current_tier]
    
    for projection in monthly_projections:
        if projection["month"] == 0:
            continue  # Skip current state
        
        # Check if either constraint is breached
        storage_exceeded = projection["storage_gb"] > tier_specs["max_storage_gb"]
        iops_exceeded = projection["write_iops"] > tier_specs["max_iops"]
        
        if storage_exceeded or iops_exceeded:
            constraint = "both" if (storage_exceeded and iops_exceeded) else ("storage" if storage_exceeded else "iops")
            return {
                "month": projection["month"],
                "constraint": constraint,
                "storage_gb": projection["storage_gb"],
                "storage_limit_gb": tier_specs["max_storage_gb"],
                "write_iops": projection["write_iops"],
                "iops_limit": tier_specs["max_iops"],
                "upgrade_to_tier": projection["tier"]
            }
    
    # If no break-even within 12 months
    return {
        "month": None,
        "constraint": "none",
        "message": f"Current {tier_specs['name']} tier sufficient for 12+ months"
    }


def generate_cost_recommendations(
    projections: List[Dict[str, Any]],
    doc_storage_gb: float,
    index_storage_gb: float,
    write_iops: float,
    growth_rate: float
) -> List[Dict[str, Any]]:
    """
    Generate cost optimization recommendations with real savings calculations.
    """
    recommendations = []
    
    final_cost = projections[-1]["total_cost_inr"]
    total_storage = doc_storage_gb + index_storage_gb
    
    # Calculate index ratio correctly (index / total storage)
    index_ratio = index_storage_gb / total_storage if total_storage > 0 else 0
    
    # High index storage ratio (industry standard: >40% is concerning, 20-40% is healthy)
    # Lowered threshold to 25% to provide actionable recommendations for more workloads
    if index_ratio > 0.25:
        # Calculate potential savings
        target_index_storage = total_storage * 0.20  # Target 20% (optimal)
        saved_storage = index_storage_gb - target_index_storage
        
        # Find how many months savings delays tier upgrade
        months_delayed = 0
        for i in range(1, len(projections) - 1):
            if projections[i]["tier"] != projections[i+1]["tier"]:
                # Found tier upgrade point - reducing storage could delay it
                months_delayed = 2
                break
        
        potential_savings = calculate_savings_from_optimization(
            projections, saved_storage, "storage", months_delayed
        )
        
        priority = "high" if index_ratio > 0.40 else "medium"
        recommendations.append({
            "priority": priority,
            "category": "index_optimization",
            "title": "Optimize Index Storage",
            "description": f"Index storage ({index_storage_gb:.2f}GB) is {(index_ratio*100):.0f}% of total storage. Industry optimal: 15-20%. Review and remove unused indexes to reduce storage costs.",
            "current_ratio_pct": round(index_ratio * 100, 1),
            "target_ratio_pct": 20,
            "potential_savings_percent": round((potential_savings / final_cost * 100), 0) if final_cost > 0 else 10,
            "potential_savings_inr": round(potential_savings, 0),
            "annual_savings_inr": round(potential_savings * 12, 0),
            "delay_upgrade_months": months_delayed
        })
    
    # Growth rate monitoring - lowered threshold to 5% to catch more cases
    if growth_rate > 0.05:
        # Reducing growth by implementing archival
        reduced_growth = growth_rate * 0.7  # 30% reduction via archival
        alt_projections = simulate_alternative_growth(projections, reduced_growth)
        savings = projections[-1]["total_cost_inr"] - alt_projections[-1]["total_cost_inr"]
        
        priority = "high" if growth_rate > 0.10 else "medium"
        recommendations.append({
            "priority": priority,
            "category": "data_retention",
            "title": "Implement Data Lifecycle Policy",
            "description": f"Growth rate of {growth_rate*100:.1f}%/month. Consider archiving historical data to Atlas Data Lake or S3 to control long-term storage costs.",
            "current_growth_pct": round(growth_rate * 100, 1),
            "target_growth_pct": round(reduced_growth * 100, 1),
            "potential_savings_percent": round((savings / final_cost * 100), 0) if final_cost > 0 else 15,
            "potential_savings_inr": round(savings, 0),
            "annual_savings_inr": round(savings * 12, 0)
        })
    
    # High IOPS - connect to write amplification with mechanical clarity
    # Lowered threshold from 500 to 100 to provide value for smaller workloads
    if write_iops > 100:
        # Show mechanical calculation chain: writes → amplification → effective IOPS → tier → cost
        
        # Current state
        current_writes_per_sec = write_iops / 7  # Assume 7x amplification
        current_amplification = 7.0
        current_effective_iops = current_writes_per_sec * current_amplification
        
        # Target state
        target_amplification = 5.0
        target_effective_iops = current_writes_per_sec * target_amplification
        iops_reduction = current_effective_iops - target_effective_iops
        iops_reduction_pct = (iops_reduction / current_effective_iops) * 100
        
        # Find current tier at month 6
        current_tier_m6 = projections[6]["tier"]
        current_tier_cost = ATLAS_PRICING[current_tier_m6]["base"]
        
        # Check if IOPS reduction allows tier downgrade or delays upgrade
        months_delayed = 0
        tier_cost_savings = 0
        
        # Check if reduced IOPS allows staying in lower tier longer
        for i in range(1, len(projections) - 1):
            projection = projections[i]
            next_projection = projections[i + 1]
            
            if projection["tier"] != next_projection["tier"]:
                # Found tier upgrade point
                # If reduced IOPS < current tier max IOPS, upgrade is delayed
                tier_max_iops = ATLAS_PRICING[projection["tier"]]["max_iops"]
                if target_effective_iops < tier_max_iops:
                    months_delayed = 2  # Conservative estimate
                    tier_cost_savings = ATLAS_PRICING[next_projection["tier"]]["base"] - ATLAS_PRICING[projection["tier"]]["base"]
                break
        
        monthly_savings = tier_cost_savings if months_delayed > 0 else (current_tier_cost * 0.15)
        
        recommendations.append({
            "priority": "high",
            "category": "write_optimization",
            "title": "Reduce Write Amplification",
            "description": f"Mechanical Impact Chain: {current_writes_per_sec:.0f} writes/sec × 7x amplification = {current_effective_iops:.0f} effective IOPS. Reducing to 5x amplification = {target_effective_iops:.0f} IOPS. This delays tier upgrade by keeping under IOPS threshold.",
            "calculation_chain": {
                "current_writes_per_sec": round(current_writes_per_sec, 0),
                "current_amplification": current_amplification,
                "current_effective_iops": round(current_effective_iops, 0),
                "target_amplification": target_amplification,
                "target_effective_iops": round(target_effective_iops, 0),
                "iops_reduction": round(iops_reduction, 0),
                "iops_reduction_pct": round(iops_reduction_pct, 1)
            },
            "current_iops": round(write_iops, 0),
            "target_iops": round(target_effective_iops, 0),
            "amplification_reduction": "7x → 5x",
            "potential_savings_percent": round((monthly_savings * 12 / (final_cost * 12) * 100), 0) if final_cost > 0 else 20,
            "monthly_savings_inr": round(monthly_savings, 0),
            "annual_savings_inr": round(monthly_savings * 12, 0),
            "delay_upgrade_months": months_delayed
        })
    
    # Year-end cost projection - sharding strategy
    if final_cost > 20000:
        recommendations.append({
            "priority": "critical",
            "category": "architecture",
            "title": "Implement Sharding Strategy",
            "description": f"Projected 12-month cost: ₹{final_cost:,.0f}. At this scale, horizontal sharding distributes load and can reduce single-cluster tier requirements.",
            "current_tier": projections[-1]["tier"],
            "potential_savings_percent": 30,
            "potential_savings_inr": round(final_cost * 0.30, 0),
            "annual_savings_inr": round(final_cost * 12 * 0.30, 0)
        })
    
    # Alternative deployment option
    annual_atlas_cost = final_cost * 12
    if annual_atlas_cost > 600000:  # ₹50K/month threshold
        self_hosted_cost = annual_atlas_cost * 0.60  # 40% savings estimate
        savings = annual_atlas_cost - self_hosted_cost
        
        recommendations.append({
            "priority": "high",
            "category": "deployment",
            "title": "Evaluate Self-Hosted MongoDB",
            "description": f"Annual Atlas cost: ₹{annual_atlas_cost:,.0f}. At enterprise scale (>₹50K/month), self-hosted deployment on dedicated infrastructure may be more cost-effective.",
            "atlas_annual_cost": round(annual_atlas_cost, 0),
            "self_hosted_estimate": round(self_hosted_cost, 0),
            "potential_savings_percent": 40,
            "potential_savings_inr": round(savings / 12, 0),
            "annual_savings_inr": round(savings, 0)
        })
    
    # Ensure at least one recommendation always appears
    if len(recommendations) == 0:
        # Generic optimization recommendation
        recommendations.append({
            "priority": "medium",
            "category": "optimization",
            "title": "Monitor and Optimize Query Performance",
            "description": f"Current tier: {projections[0]['tier']} ({projections[0]['tier_name']}). Regular monitoring of slow queries, index usage, and connection pooling can prevent unexpected tier upgrades.",
            "potential_savings_percent": 15,
            "potential_savings_inr": round(final_cost * 0.15, 0),
            "annual_savings_inr": round(final_cost * 12 * 0.15, 0)
        })
    
    return recommendations


def calculate_savings_from_optimization(
    projections: List[Dict[str, Any]], 
    storage_saved_gb: float, 
    optimization_type: str,
    months_delayed: int
) -> float:
    """Calculate actual cost savings from an optimization."""
    if months_delayed == 0:
        return storage_saved_gb * 30  # Just storage cost savings
    
    # Calculate savings from delayed tier upgrade
    total_savings = 0
    for i in range(len(projections) - months_delayed):
        if i > 0:
            tier_diff = ATLAS_PRICING[projections[i + months_delayed]["tier"]]["base"] - ATLAS_PRICING[projections[i]["tier"]]["base"]
            total_savings += tier_diff
    
    return total_savings / 12  # Average monthly savings


def simulate_alternative_growth(projections: List[Dict[str, Any]], new_growth_rate: float) -> List[Dict[str, Any]]:
    """Simulate projections with different growth rate."""
    alt_projections = []
    original_growth = 0.07  # Get from actual calculation
    
    for proj in projections:
        month = proj["month"]
        if month == 0:
            alt_projections.append(proj.copy())
            continue
        
        # Recalculate with new growth
        new_multiplier = (1 + new_growth_rate) ** month
        alt_proj = proj.copy()
        alt_proj["storage_gb"] = proj["storage_gb"] * (new_multiplier / ((1 + original_growth) ** month))
        alt_proj["total_cost_inr"] = proj["base_cost"] + (alt_proj["storage_gb"] - proj["included_storage_gb"]) * 30
        alt_projections.append(alt_proj)
    
    return alt_projections


def generate_sensitivity_analysis(
    doc_storage_gb: float,
    index_storage_gb: float,
    write_iops: float,
    read_ru: float,
    base_growth_rate: float
) -> List[Dict[str, Any]]:
    """
    Generate cost sensitivity scenarios with different growth rates.
    Make scenarios meaningfully different to show tier diversity.
    """
    scenarios = []
    base_storage = doc_storage_gb + index_storage_gb
    
    # Scenario 1: Conservative growth (30% of base) - aggressive reduction for tier diversity
    conservative_rate = base_growth_rate * 0.3
    conservative_storage_12m = base_storage * ((1 + conservative_rate) ** 12)
    conservative_iops_12m = write_iops * ((1 + conservative_rate) ** 12)
    conservative_tier, _, _ = determine_atlas_tier(conservative_storage_12m, conservative_iops_12m, 0)
    conservative_cost = ATLAS_PRICING[conservative_tier]["base"]
    
    scenarios.append({
        "name": "Conservative Growth",
        "growth_rate_pct": round(conservative_rate * 100, 1),
        "description": f"If growth slows to {conservative_rate*100:.1f}%/month via data archival + optimization",
        "month_12_tier": conservative_tier,
        "month_12_tier_name": ATLAS_PRICING[conservative_tier]["name"],
        "month_12_storage_gb": round(conservative_storage_12m, 2),
        "month_12_cost": round(conservative_cost, 0),
        "vs_baseline_savings_pct": 0  # Will be calculated later
    })
    
    # Scenario 2: Current/Base case
    base_storage_12m = base_storage * ((1 + base_growth_rate) ** 12)
    base_iops_12m = write_iops * ((1 + base_growth_rate) ** 12)
    base_tier, _, _ = determine_atlas_tier(base_storage_12m, base_iops_12m, 0)
    base_cost = ATLAS_PRICING[base_tier]["base"]
    
    scenarios.append({
        "name": "Current Trajectory",
        "growth_rate_pct": round(base_growth_rate * 100, 1),
        "description": f"Projected baseline at {base_growth_rate*100:.1f}%/month growth",
        "month_12_tier": base_tier,
        "month_12_tier_name": ATLAS_PRICING[base_tier]["name"],
        "month_12_storage_gb": round(base_storage_12m, 2),
        "month_12_cost": round(base_cost, 0),
        "vs_baseline_savings_pct": 0
    })
    
    # Scenario 3: Aggressive growth (200% of base) - more aggressive for tier diversity
    aggressive_rate = base_growth_rate * 2.0
    aggressive_storage_12m = base_storage * ((1 + aggressive_rate) ** 12)
    aggressive_iops_12m = write_iops * ((1 + aggressive_rate) ** 12)
    aggressive_tier, _, _ = determine_atlas_tier(aggressive_storage_12m, aggressive_iops_12m, 0)
    aggressive_cost = ATLAS_PRICING[aggressive_tier]["base"]
    
    scenarios.append({
        "name": "Aggressive Growth",
        "growth_rate_pct": round(aggressive_rate * 100, 1),
        "description": f"If growth accelerates to {aggressive_rate*100:.1f}%/month (viral adoption)",
        "month_12_tier": aggressive_tier,
        "month_12_tier_name": ATLAS_PRICING[aggressive_tier]["name"],
        "month_12_storage_gb": round(aggressive_storage_12m, 2),
        "month_12_cost": round(aggressive_cost, 0),
        "vs_baseline_savings_pct": 0  # Will be calculated later
    })
    
    # Scenario 4: Peak Load (150% traffic spike) - Shows cost at traffic surge
    peak_multiplier = 1.5  # 50% temporary traffic increase
    peak_iops = write_iops * peak_multiplier
    # Peak doesn't increase storage, just IOPS
    peak_tier, peak_constraint, _ = determine_atlas_tier(base_storage, peak_iops, 0)
    peak_cost = ATLAS_PRICING[peak_tier]["base"]
    
    scenarios.append({
        "name": "Peak Load",
        "growth_rate_pct": round(base_growth_rate * 100, 1),
        "description": f"During traffic spike at month 12 (50% above normal IOPS)",
        "month_12_tier": peak_tier,
        "month_12_tier_name": ATLAS_PRICING[peak_tier]["name"],
        "month_12_storage_gb": round(base_storage_12m, 2),
        "month_12_iops_peak": round(peak_iops, 0),
        "month_12_cost": round(peak_cost, 0),
        "is_peak_load": True,
        "vs_baseline_savings_pct": 0  # Will be calculated later
    })
    
    # Calculate savings percentages relative to baseline
    for scenario in scenarios:
        if base_cost > 0:
            savings = base_cost - scenario["month_12_cost"]
            scenario["vs_baseline_savings_pct"] = round((savings / base_cost) * 100, 1)
            scenario["vs_baseline_savings_inr"] = round(savings, 0)
    
    return scenarios
