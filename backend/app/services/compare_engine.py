from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

from datetime import datetime, timezone
import uuid

import copy
import json
import difflib
import re

from groq import Groq

from ..config import settings

# Initialize Groq client with API key from config
_groq = Groq(api_key=settings.groq_api_key)
MODEL = "llama-3.3-70b-versatile"


ENTITY_TEMPLATES: Dict[str, List[str]] = {
    "User": ["name", "email", "createdAt"],
    "Order": ["total", "status", "createdAt"],
    "Product": ["name", "price", "category"],
    "Invoice": ["total", "dueDate", "status"],
    "School": ["name", "address", "establishedAt"],
    "Student": ["firstName", "lastName", "email", "gradeLevel", "enrollmentDate"],
    "Teacher": ["name", "email", "department", "hiredAt"],
    "Class": ["name", "section", "room", "schedule"],
    "Course": ["title", "code", "credits"],
    "Subject": ["name", "code"],
    "Grade": ["value", "type", "recordedAt"],
    "Attendance": ["date", "status"],
    "Exam": ["name", "date", "score"],
    "Question": ["text", "type", "points"],
    "Result": ["score", "grade", "recordedAt"],
    "Parent": ["name", "phone", "email"],
    "Fee": ["amount", "dueDate", "status"],
    "Payment": ["amount", "method", "paidAt"],
    "Library": ["name", "location"],
    "Book": ["title", "author", "isbn"],
    "Department": ["name", "head"],
    "Staff": ["name", "role"],
    "Schedule": ["dayOfWeek", "startTime", "endTime"],
    "Bus": ["route", "capacity"],
    "Hostel": ["name", "capacity"],
    "Customer": ["name", "email", "phone", "createdAt"],
    "Cart": ["status", "updatedAt"],
    "PaymentMethod": ["type", "provider", "last4"],
    "Shipment": ["status", "carrier", "trackingNumber"],
    "Address": ["line1", "city", "state", "postalCode"],
    "Inventory": ["sku", "quantity", "location"],
    "Patient": ["name", "dob", "phone", "email"],
    "Doctor": ["name", "specialty", "email"],
    "Appointment": ["scheduledAt", "status", "reason"],
    "Prescription": ["medication", "dosage", "issuedAt"],
    "MedicalRecord": ["summary", "createdAt"],
    "Employee": ["name", "email", "title", "hiredAt"],
    "Role": ["name", "level"],
    "Payroll": ["period", "gross", "net"],
    "Leave": ["type", "startDate", "endDate"],
    "Lead": ["name", "source", "status"],
    "Deal": ["name", "stage", "value"],
    "Account": ["name", "industry", "owner"],
    "Contact": ["name", "email", "phone"],
    "Pipeline": ["name", "stages"],
    "Warehouse": ["name", "location", "capacity"],
    "Vehicle": ["plate", "type", "capacity"],
    "Route": ["name", "distance"],
    "Delivery": ["status", "eta", "deliveredAt"],
    "Ledger": ["name", "type"],
    "Transaction": ["amount", "type", "createdAt"],
    "Card": ["brand", "last4", "expiry"],
    "Budget": ["name", "period", "amount"],
}

ENTITY_KEYWORDS: Dict[str, List[str]] = {
    "School": ["school", "campus"],
    "Student": ["student", "students", "pupil", "learner"],
    "Teacher": ["teacher", "teachers", "faculty", "instructor"],
    "Class": ["class", "classes", "classroom", "section"],
    "Course": ["course", "courses", "curriculum"],
    "Subject": ["subject", "subjects"],
    "Grade": ["grade", "grades", "mark", "score", "result"],
    "Attendance": ["attendance", "presence", "absence"],
    "Exam": ["exam", "exams", "test", "assessment"],
    "Question": ["question", "questions", "mcq", "quiz"],
    "Result": ["result", "results", "score", "grade"],
    "Parent": ["parent", "parents", "guardian"],
    "Fee": ["fee", "fees", "tuition"],
    "Payment": ["payment", "payments", "invoice", "receipt"],
    "Library": ["library"],
    "Book": ["book", "books"],
    "Department": ["department", "dept"],
    "Staff": ["staff", "employee"],
    "Schedule": ["schedule", "timetable"],
    "Bus": ["bus", "transport"],
    "Hostel": ["hostel", "dorm", "residence"],
    "Customer": ["customer", "customers", "buyer", "client"],
    "Cart": ["cart", "basket"],
    "PaymentMethod": ["payment method", "card", "wallet"],
    "Shipment": ["shipment", "shipping", "delivery"],
    "Address": ["address", "addresses"],
    "Inventory": ["inventory", "stock", "warehouse stock"],
    "Patient": ["patient", "patients"],
    "Doctor": ["doctor", "doctors", "physician"],
    "Appointment": ["appointment", "appointments", "visit"],
    "Prescription": ["prescription", "medication"],
    "MedicalRecord": ["medical record", "record", "ehr"],
    "Employee": ["employee", "employees", "staff"],
    "Role": ["role", "roles", "designation"],
    "Payroll": ["payroll", "salary", "payslip"],
    "Leave": ["leave", "time off", "vacation"],
    "Lead": ["lead", "leads", "prospect"],
    "Deal": ["deal", "deals", "opportunity"],
    "Account": ["account", "accounts", "company"],
    "Contact": ["contact", "contacts"],
    "Pipeline": ["pipeline", "funnel"],
    "Warehouse": ["warehouse", "fulfillment"],
    "Vehicle": ["vehicle", "truck", "van"],
    "Route": ["route", "routes"],
    "Delivery": ["delivery", "deliveries"],
    "Ledger": ["ledger", "journal"],
    "Transaction": ["transaction", "transactions", "transfer"],
    "Card": ["card", "credit card", "debit card"],
    "Budget": ["budget", "forecast"],
}

RELATION_RULES: List[Tuple[List[str], str, List[str], List[str]]] = [
    (["enroll", "admit", "register"], "enrolls in", ["Student"], ["Class", "Course"]),
    (["teach", "instruct"], "teaches", ["Teacher"], ["Subject", "Course", "Class"]),
    (["grade", "score", "mark", "result"], "receives", ["Student"], ["Grade"]),
    (["exam", "test", "assessment"], "takes", ["Student"], ["Exam"]),
    (["attendance", "present", "absent"], "has", ["Student"], ["Attendance"]),
    (["parent", "guardian"], "guardians", ["Parent"], ["Student"]),
    (["fee", "tuition", "payment"], "pays", ["Student"], ["Fee", "Payment"]),
    (["library", "book"], "borrows", ["Student"], ["Book"]),
]

STOP_ENTITY_TERMS = {
    "data",
    "information",
    "detail",
    "details",
    "record",
    "records",
    "system",
    "platform",
    "app",
    "apps",
    "application",
    "a",
    "an",
    "the",
}

GENERIC_SUFFIXES = {"app", "apps", "application", "system", "platform"}
ARTICLE_TOKENS = {"a", "an", "the"}

_NLP = None

MISSPELLINGS = {
    "auit": "audit",
    "aduit": "audit",
    "attendence": "attendance",
    "studnet": "student",
    "techer": "teacher",
    "clas": "class",
    "subjet": "subject",
    "commerece": "commerce",
    "ecommerece": "ecommerce",
    "e-commerece": "ecommerce",
    "e commerece": "ecommerce",
}

_VOCAB = sorted(
    {
        keyword
        for keywords in ENTITY_KEYWORDS.values()
        for keyword in keywords
    }
    | {key.lower() for key in ENTITY_KEYWORDS.keys()}
    | set(GENERIC_SUFFIXES)
    | {"collection", "entity", "field", "fields", "schema", "embed", "reference"}
)


def _get_nlp():
    global _NLP
    if _NLP is not None:
        return _NLP
    try:
        import spacy

        try:
            _NLP = spacy.load("en_core_web_sm")
        except OSError:
            _NLP = spacy.blank("en")
    except Exception:
        _NLP = None
    return _NLP


def _singularize(term: str) -> str:
    if term.endswith("ies") and len(term) > 3:
        return term[:-3] + "y"
    if term.endswith("ses") and len(term) > 3:
        return term[:-2]
    if term.endswith("s") and not term.endswith("ss") and len(term) > 3:
        return term[:-1]
    return term


def _pluralize(term: str) -> str:
    if term.endswith("y") and len(term) > 2:
        return term[:-1] + "ies"
    if term.endswith("s"):
        return term + "es"
    return term + "s"


def _title_case(term: str) -> str:
    return "".join(word.capitalize() for word in term.split())


def _normalize_term(term: str) -> str:
    term = re.sub(r"[^a-zA-Z\s]", " ", term).strip().lower()
    if not term:
        return ""
    parts = [_singularize(part) for part in term.split() if part]
    while parts and parts[0] in ARTICLE_TOKENS:
        parts = parts[1:]
    if parts and parts[-1] in GENERIC_SUFFIXES and len(parts) > 1:
        parts = parts[:-1]
    return " ".join(parts)


def _keyword_entity(term: str) -> str | None:
    for entity, keywords in ENTITY_KEYWORDS.items():
        if term in keywords:
            return entity
    return None


def _extract_entity_candidates(text: str) -> Iterable[str]:
    nlp = _get_nlp()
    if not nlp:
        return []
    doc = nlp(text)
    candidates: List[str] = []

    if doc.has_annotation("DEP"):
        for chunk in doc.noun_chunks:
            candidates.append(chunk.text)
    if doc.has_annotation("POS"):
        for token in doc:
            if token.pos_ in {"NOUN", "PROPN"}:
                candidates.append(token.lemma_ or token.text)
    if not candidates:
        for token in doc:
            if token.is_alpha and token.text.istitle():
                candidates.append(token.text)
    return candidates


def _normalize_text(text: str) -> str:
    normalized = text
    for wrong, right in MISSPELLINGS.items():
        normalized = re.sub(rf"\b{re.escape(wrong)}\b", right, normalized, flags=re.IGNORECASE)
    tokens = re.findall(r"[A-Za-z]+|\W+", normalized)
    corrected = []
    for token in tokens:
        if not token.isalpha():
            corrected.append(token)
            continue
        lower = token.lower()
        if len(lower) < 4 or lower in _VOCAB:
            corrected.append(token)
            continue
        matches = difflib.get_close_matches(lower, _VOCAB, n=1, cutoff=0.86)
        corrected.append(matches[0] if matches else token)
    return "".join(corrected)
    return normalized


def _normalize_type(value: Any) -> Any:
    if isinstance(value, str):
        lowered = value.strip().lower()
        mapping = {
            "string": "string",
            "text": "string",
            "str": "string",
            "number": "number",
            "int": "number",
            "integer": "number",
            "float": "number",
            "double": "number",
            "date": "date",
            "datetime": "date",
            "bool": "boolean",
            "boolean": "boolean",
            "object": "object",
            "array": "array",
            "objectid": "ObjectId",
            "object id": "ObjectId",
        }
        return mapping.get(lowered, value)
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    return "string"


def _normalize_field(value: Any) -> Any:
    if isinstance(value, dict):
        normalized = {}
        for key, nested in value.items():
            if not isinstance(key, str):
                continue
            normalized[key] = _normalize_field(nested)
        return normalized
    if isinstance(value, list):
        if not value:
            return []
        return [_normalize_field(value[0])]
    return _normalize_type(value)


def _normalize_schema(schema: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(schema, dict):
        return {}
    normalized_schema: Dict[str, Any] = {}
    for collection, fields in schema.items():
        if not isinstance(collection, str):
            continue
        if not isinstance(fields, dict):
            normalized_schema[collection] = {"_id": "ObjectId"}
            continue
        normalized_fields = _normalize_field(fields)
        if "_id" not in normalized_fields:
            normalized_fields["_id"] = "ObjectId"
        normalized_schema[collection] = normalized_fields
    return normalized_schema


def _normalize_type(value: Any) -> Any:
    if isinstance(value, str):
        lowered = value.strip().lower()
        mapping = {
            "string": "string",
            "text": "string",
            "str": "string",
            "number": "number",
            "int": "number",
            "integer": "number",
            "float": "number",
            "double": "number",
            "date": "date",
            "datetime": "date",
            "bool": "boolean",
            "boolean": "boolean",
            "object": "object",
            "array": "array",
            "objectid": "ObjectId",
            "object id": "ObjectId",
        }
        return mapping.get(lowered, value)
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    return "string"


def _build_schema_version(base_result: Dict[str, Any] | None = None) -> Dict[str, Any]:
    previous_version_id = None
    next_version = 1
    if isinstance(base_result, dict):
        previous_version_id = base_result.get("schemaVersionId")
        try:
            next_version = int(base_result.get("schemaVersion", 0)) + 1
        except (TypeError, ValueError):
            next_version = 1

    return {
        "schemaVersion": next_version,
        "schemaVersionId": str(uuid.uuid4()),
        "previousVersionId": previous_version_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def _parse_embed_reference(value: Any) -> str | None:
    if isinstance(value, str):
        lowered = value.lower()
        if "embed" in lowered:
            return "embed"
        if "reference" in lowered:
            return "reference"
    return None


def _normalize_relationships(relationships_obj: Any, decisions_obj: Any) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    decisions = decisions_obj if isinstance(decisions_obj, dict) else {}

    if isinstance(relationships_obj, dict):
        for relation, choice in relationships_obj.items():
            if not isinstance(relation, str):
                continue
            normalized_choice = _parse_embed_reference(choice)
            if not normalized_choice:
                normalized_choice = _parse_embed_reference(decisions.get(relation))
            if not normalized_choice and isinstance(choice, str):
                normalized[relation] = choice
                continue
            normalized[relation] = normalized_choice or "reference"
    elif isinstance(relationships_obj, list):
        for relation in relationships_obj:
            if not isinstance(relation, str):
                continue
            normalized_choice = _parse_embed_reference(decisions.get(relation))
            if normalized_choice:
                normalized[relation] = normalized_choice
            else:
                normalized[relation] = relation

    if not normalized and isinstance(decisions, dict):
        for relation, choice in decisions.items():
            if not isinstance(relation, str) or not _looks_like_relation(relation):
                continue
            normalized_choice = _parse_embed_reference(choice)
            if normalized_choice:
                normalized[relation] = normalized_choice
            elif isinstance(choice, str):
                normalized[relation] = choice

    return normalized


def _looks_like_relation(text: str) -> bool:
    lowered = text.lower()
    return any(
        token in lowered
        for token in ["->", " has ", " belongs ", " contains ", " includes ", " enrolls ", " borrows ", " takes ", " pays ", " receives ", " teaches ", " owns ", " uses ", " places ", " converts "]
    )


def _infer_relationships_from_schema(schema: Dict[str, Any]) -> Dict[str, str]:
    inferred: Dict[str, str] = {}
    if not schema or not isinstance(schema, dict):
        return inferred

    for collection, fields in schema.items():
        if not isinstance(fields, dict):
            continue
        for field_name in fields.keys():
            if not isinstance(field_name, str):
                continue
            if field_name.endswith("Ids"):
                base = field_name[:-3]
                target = _pluralize(base) if base else ""
                if target:
                    inferred[f"{collection} -> {target}"] = f"{collection} has many {target} (via {field_name})"
            elif field_name.endswith("Id"):
                base = field_name[:-2]
                target = _pluralize(base) if base else ""
                if target:
                    inferred[f"{collection} -> {target}"] = f"{collection} references {target} (via {field_name})"
            elif field_name.endswith("_id") and field_name != "_id":
                base = field_name[:-3]
                target = _pluralize(base) if base else ""
                if target:
                    inferred[f"{collection} -> {target}"] = f"{collection} references {target} (via {field_name})"

    return inferred


def _get_model_prompt_for_comparison(model_name: str, input_text: str, workload_type: str) -> str:
    """Generate model-specific prompt with different design philosophies - OPTIMIZED FOR COMPARISON."""
    
    # Base many-to-many guidance
    has_pricing = any(kw in input_text.lower() for kw in ['cost', 'price', 'pricing', 'different cost', 'different price'])
    has_inventory = any(kw in input_text.lower() for kw in ['inventory', 'stock', 'quantity', 'availability'])
    
    many_to_many_guidance = ""
    if has_pricing or has_inventory:
        many_to_many_guidance = """
IMPORTANT: If there's a many-to-many relationship with attributes (like products in multiple stores with DIFFERENT prices/costs for each store):
- Create a JUNCTION collection to model this (e.g., "store_inventory", "product_store_mapping", etc.)
- Junction structure: {store_id: ObjectId, product_id: ObjectId, cost/price: Number, quantity: Number}
"""
    
    if model_name == "claude":
        system_prompt = """You are Claude, a MongoDB schema architect trained by Anthropic.
Your design philosophy: **Maximum normalization and consistency**. 
STRICT RULES:
- ALWAYS prefer separate collections over embedding (normalization first)
- Use ObjectId references EXCLUSIVELY - no embedded documents for relationships
- Every relationship MUST have its own collection (even many-to-many gets junction collection)
- Prioritize ACID-like constraints and data integrity over query performance
- Multiple lookups are acceptable if they ensure data consistency
- Example: Student-Course relationship MUST be in a separate 'enrollments' collection, never embedded

Design principles:
- Logical clarity and data consistency are paramount
- Reference by default, embed NEVER unless absolutely necessary
- Favor well-indexed reference fields over embedding
- Single source of truth for every piece of data"""
        
    elif model_name == "gpt":
        system_prompt = """You are GPT-4, a MongoDB schema architect trained by OpenAI.
Your design philosophy: **Pragmatic balance between normalization and performance**.
BALANCED APPROACH:
- Embed ONE-TO-MANY if child always accessed with parent (e.g., user profile with address)
- Reference MANY-TO-MANY and loosely-coupled relationships
- Consider query frequency: frequent queries might warrant strategic embedding
- Avoid huge arrays but accept small embedded documents
- Example: Student → Classes: embed if <10 classes per student, else reference

Design principles:
- What's the most common query pattern?
- How big will embedded arrays grow?
- Is data duplicate acceptable or problematic?
- Practical trade-offs between simplicity and performance"""
        
    elif model_name == "gemini":
        system_prompt = """You are Gemini, a MongoDB schema architect trained by Google.
Your design philosophy: **Aggressive denormalization for read performance**.
PERFORMANCE-FIRST RULES:
- Embed related data that's ALWAYS queried together (cut query count in half)
- DUPLICATE data across collections if it eliminates joins
- Aggressively denormalize frequently accessed relationships
- Accept data duplication for query performance gains
- Example: Store product price in BOTH products collection AND store_inventory collection

Design principles:
- Minimize joins - embed first, ask about consistency later
- Read-heavy optimization takes priority
- Sharding patterns that scale horizontally
- Pre-aggregate data where possible
- Denorm is acceptable - consistency is flexible"""
        
    elif model_name == "groq":
        system_prompt = """You are Groq, a MongoDB schema architect.
Your design philosophy: **Real-time speed and minimal latency**.
SPEED-OPTIMIZED RULES:
- Ultra-aggressive denormalization to minimize database roundtrips
- Embed everything that could be a separate query
- Duplicate data liberally if it reduces latency by even 1ms
- Design for single-document queries where possible
- Example: Embed full product details in every order item, not just productId

Design principles:
- Minimize round-trips - even at the cost of data duplication
- Fast data retrieval over storage efficiency
- Throughput matters more than consistency
- Pre-compute and cache in document
- Real-time streaming friendly patterns"""
        
    elif model_name == "llama":
        system_prompt = """You are LLaMA, an open-source MongoDB schema architect by Meta.
Your design philosophy: **Efficient and practical for resource-constrained systems**.
RESOURCE-AWARE RULES:
- Create minimal collections to reduce memory and index overhead
- Embed strategically to reduce collection count (2-3 main collections vs 10+)
- Use references for large relationships but embed small metadata
- Practical approach: what works without excessive resources?
- Example: Combine related entities into 1-2 main collections with embedded sub-documents

Design principles:
- Efficiency and simplicity over complexity
- Reduce index fragmentation and memory usage
- Practical for teams with limited infrastructure
- Balance between MongoDB flexibility and relational discipline"""
        
    elif model_name == "mistral":
        system_prompt = """You are Mistral, a compact and fast MongoDB schema architect.
Your design philosophy: **Lean, fast, and pragmatically denormalized**.
LEAN RULES:
- Keep schema structure simple and predictable
- Embed common relationships to reduce complexity
- Avoid over-engineering - use the simplest design that works
- Fast queries through strategic denormalization
- Example: User collection contains: basic info, recent orders summary, settings - all in one document

Design principles:
- Simplicity and speed without over-design
- Practical denormalization for real-world queries
- Minimal collection overhead
- Good performance without aggressive optimization"""
        
    else:
        system_prompt = """You are an expert MongoDB schema architect.
Design OPTIMAL schemas for the given requirements."""
    
    # COMPARISON-OPTIMIZED prompt with explicit constraints
    prompt = f"""{system_prompt}

Design an OPTIMAL MongoDB schema for:

User Requirement: {input_text}
Workload Type: {workload_type}

{many_to_many_guidance}

CRITICAL REQUIREMENTS: 
1. Respond with VALID JSON ONLY (no markdown, no extra text, no explanations)
2. Include realistic MongoDB field names (not generic "field1", "field2")
3. Collections MUST be specific to the domain (not "Collection1", "Collection2")
4. Provide detailed design reasoning in explanations
5. Include ALL warnings you see
6. JSON structure MUST be valid and complete

REQUIRED JSON FIELDS:
{{
  "description": "YOUR DOMAIN DESCRIPTION",
  "schema": {{ COLLECTIONS WITH FIELDS }},
  "entities": [ ENTITY NAMES ],
  "relationships": [ RELATIONSHIP DESCRIPTIONS ],
  "decisions": {{ EMBED/REFERENCE DECISIONS }},
  "indexes": [ INDEXES ],
  "warnings": [ DESIGN WARNINGS ],
  "explanations": {{ DESIGN RATIONALE }}
}}

MANDATORY EXAMPLE (follow this structure EXACTLY):
{{
  "description": "School management system with normalized students, teachers, and classes",
  "schema": {{
    "students": {{
      "_id": "ObjectId",
      "firstName": "String",
      "lastName": "String",
      "email": "String",
      "enrollmentDate": "Date",
      "gradeLevel": "Number"
    }},
    "teachers": {{
      "_id": "ObjectId",
      "name": "String",
      "email": "String",
      "department": "String",
      "hiredDate": "Date",
      "specialization": "String"
    }},
    "classes": {{
      "_id": "ObjectId",
      "name": "String",
      "section": "String",
      "room": "String",
      "classCode": "String",
      "createdAt": "Date"
    }},
    "enrollments": {{
      "_id": "ObjectId",
      "studentId": "ObjectId",
      "classId": "ObjectId",
      "enrollmentDate": "Date",
      "status": "String"
    }},
    "assignments": {{
      "_id": "ObjectId",
      "teacherId": "ObjectId",
      "classId": "ObjectId",
      "subject": "String",
      "assignedDate": "Date"
    }}
  }},
  "entities": ["students", "teachers", "classes", "enrollments", "assignments"],
  "relationships": [
    "students enroll in classes",
    "teachers teach classes",
    "assignments belong to classes"
  ],
  "decisions": {{
    "students": "SEPARATE COLLECTION - Independent entity with unique identity",
    "teachers": "SEPARATE COLLECTION - Independent entity with own data",
    "classes": "SEPARATE COLLECTION - Shared resource between students and teachers",
    "enrollments": "JUNCTION COLLECTION (if many-to-many) - Tracks student-class relationships",
    "assignments": "SEPARATE COLLECTION - Tracks teacher assignment to classes"
  }},
  "indexes": [
    {{"collection": "students", "field": "email", "reason": "Fast student lookup by email"}},
    {{"collection": "enrollments", "field": "studentId", "reason": "Query all classes for a student"}},
    {{"collection": "enrollments", "field": "classId", "reason": "Query all students in a class"}},
    {{"collection": "teachers", "field": "department", "reason": "Filter teachers by department"}}
  ],
  "warnings": [
    "Normalize all relationships to avoid update anomalies",
    "Ensure referential integrity between collections",
    "Use junction collection for many-to-many to prevent data duplication"
  ],
  "explanations": {{
    "Design": "Fully normalized approach prioritizing data consistency and avoiding update anomalies. Each entity is in its own collection with clear foreign key relationships. Many-to-many relationships use junction collections. This design requires more queries but ensures single source of truth.",
    "Claude": "This follows Claude's philosophy of maximum normalization",
    "Performance": "Trade-off: More queries but stronger consistency guarantees"
  }}
}}

NOW GENERATE THE SCHEMA FOR: {input_text}
Respond ONLY with valid JSON, absolutely no text before or after the JSON."""
    
    return prompt


def generate_schema_for_comparison(input_text: str, workload_type: str, model_name: str = "groq") -> Dict[str, Any]:
    """Generate MongoDB schema using Groq API with model-specific philosophy - OPTIMIZED FOR COMPARISON."""
    
    # Get model-specific prompt
    prompt = _get_model_prompt_for_comparison(model_name, input_text, workload_type)
    
    try:
        response = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Try to parse as JSON
        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            # If not valid JSON, try extracting JSON from the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(response_text[json_start:json_end])
            else:
                raise ValueError("Could not parse Groq response as JSON")
        
        # Extract relationships from decisions if nested, or use top-level relationships
        relationships_obj = result.get("relationships", {})
        decisions_obj = result.get("decisions", {})
        
        # If relationships is nested in decisions, extract it
        if "relationships" in decisions_obj and isinstance(decisions_obj["relationships"], dict):
            relationships_obj = decisions_obj.pop("relationships")
        elif isinstance(relationships_obj, list):
            # Convert list of relationship strings to dict if needed
            rel_dict = {}
            for rel in relationships_obj:
                if isinstance(rel, str):
                    parts = rel.split(" -> ")
                    if len(parts) >= 2:
                        rel_name = " to ".join(parts[:2])
                        rel_dict[rel_name] = rel
            relationships_obj = rel_dict if rel_dict else {}
        
        # Ensure all required fields exist
        normalized_schema = _normalize_schema(result.get("schema", {}))
        relationships_obj = _normalize_relationships(relationships_obj, decisions_obj)
        if not relationships_obj:
            relationships_obj = _infer_relationships_from_schema(normalized_schema)
        version_info = _build_schema_version()

        return {
            **version_info,
            "entities": result.get("entities", []),
            "relationships": relationships_obj,
            "attributes": {entity: [] for entity in result.get("entities", [])},
            "decisions": decisions_obj,
            "whyNot": {},
            "confidence": {entity: 95 for entity in result.get("entities", [])},
            "schema": normalized_schema,
            "indexes": result.get("indexes", []),
            "warnings": result.get("warnings", []),
            "explanations": result.get("explanations", {"design": result.get("description", "Schema generated by comparison engine")}),
            "accessPattern": workload_type,
        }
        
    except Exception as e:
        # Return error-safe fallback for comparison
        return {
            "schemaVersion": 1,
            "schemaVersionId": str(uuid.uuid4()),
            "previousVersionId": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "entities": [],
            "relationships": {},
            "attributes": {},
            "decisions": {},
            "whyNot": {},
            "confidence": {},
            "schema": {},
            "indexes": [],
            "warnings": [f"Comparison schema generation failed: {str(e)}"],
            "explanations": {"error": str(e)},
            "accessPattern": workload_type,
        }


def compare_schemas(schema1: Dict[str, Any], schema2: Dict[str, Any]) -> Dict[str, Any]:
    """Compare two schemas and return detailed analysis."""
    
    # Extract collections from both schemas
    collections1 = set(schema1.get("schema", {}).keys()) if isinstance(schema1, dict) else set()
    collections2 = set(schema2.get("schema", {}).keys()) if isinstance(schema2, dict) else set()
    
    # Calculate differences
    only_in_1 = sorted(collections1 - collections2)
    only_in_2 = sorted(collections2 - collections1)
    common = sorted(collections1 & collections2)
    
    # Calculate similarity score using Jaccard Index (proper metric)
    # Jaccard = (intersection / union) * 100
    union_size = len(collections1 | collections2)
    if union_size > 0:
        similarity_score = (len(common) / union_size) * 100
    else:
        similarity_score = 0.0
    
    return {
        "onlyIn1": only_in_1,
        "onlyIn2": only_in_2,
        "common": common,
        "similarityScore": similarity_score,
        "schema1_collection_count": len(collections1),
        "schema2_collection_count": len(collections2),
    }


def compare_schemas_detailed(schema1: Dict[str, Any], schema2: Dict[str, Any]) -> Dict[str, Any]:
    """Compare two schemas with detailed field-level differences for each model."""
    
    schema1_data = schema1.get("schema", {})
    schema2_data = schema2.get("schema", {})
    
    collections1 = set(schema1_data.keys())
    collections2 = set(schema2_data.keys())
    
    only_in_1 = sorted(collections1 - collections2)
    only_in_2 = sorted(collections2 - collections1)
    common = sorted(collections1 & collections2)
    
    # Detailed differences for each model
    model1_details = {
        "onlyCollections": only_in_1,  # Collections only in model1
        "missingCollections": only_in_2,  # Collections in model2 but NOT in model1
        "commonCollections": common,
        "fieldDifferences": {}  # Field differences in common collections
    }
    
    model2_details = {
        "onlyCollections": only_in_2,  # Collections only in model2
        "missingCollections": only_in_1,  # Collections in model1 but NOT in model2
        "commonCollections": common,
        "fieldDifferences": {}  # Field differences in common collections
    }
    
    # Analyze field-level differences in common collections
    for collection in common:
        schema1_fields = set(schema1_data.get(collection, {}).keys())
        schema2_fields = set(schema2_data.get(collection, {}).keys())
        
        only_in_model1_fields = sorted(schema1_fields - schema2_fields)
        only_in_model2_fields = sorted(schema2_fields - schema1_fields)
        common_fields = sorted(schema1_fields & schema2_fields)
        
        if only_in_model1_fields or only_in_model2_fields or (schema1_fields != schema2_fields):
            model1_details["fieldDifferences"][collection] = {
                "extraFields": only_in_model1_fields,  # Fields in model1 but not model2
                "missingFields": only_in_model2_fields,  # Fields in model2 but not model1
                "commonFields": common_fields
            }
            model2_details["fieldDifferences"][collection] = {
                "extraFields": only_in_model2_fields,  # Fields in model2 but not model1
                "missingFields": only_in_model1_fields,  # Fields in model1 but not model2
                "commonFields": common_fields
            }
    
    # Overall similarity
    union_size = len(collections1 | collections2)
    if union_size > 0:
        similarity_score = (len(common) / union_size) * 100
    else:
        similarity_score = 0.0
    
    return {
        "model1": model1_details,
        "model2": model2_details,
        "summary": {
            "onlyIn1": only_in_1,
            "onlyIn2": only_in_2,
            "common": common,
            "similarityScore": similarity_score,
            "schema1_collection_count": len(collections1),
            "schema2_collection_count": len(collections2),
        }
    }


def get_available_models() -> List[Dict[str, str]]:
    """Return list of available AI models for comparison."""
    return [
        {"id": "claude", "name": "Claude", "emoji": "🟦", "philosophy": "Maximum normalization & consistency"},
        {"id": "gpt", "name": "GPT-4", "emoji": "🟧", "philosophy": "Pragmatic balance"},
        {"id": "gemini", "name": "Gemini", "emoji": "🟨", "philosophy": "High-performance at scale"},
        {"id": "groq", "name": "Groq", "emoji": "⚡", "philosophy": "Real-time speed"},
        {"id": "llama", "name": "LLaMA", "emoji": "🦙", "philosophy": "Resource-efficient practical"},
        {"id": "mistral", "name": "Mistral", "emoji": "🌪️", "philosophy": "Lean & pragmatic"},
    ]


def validate_model_name(model_name: str) -> bool:
    """Check if model name is valid."""
    valid_models = {m["id"] for m in get_available_models()}
    return model_name.lower() in valid_models
