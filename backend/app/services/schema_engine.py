from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

import copy
import json
import difflib
import re

from groq import Groq

from ..config import settings

# Initialize Groq client with API key from config
_groq = Groq(api_key=settings.groq_api_key)


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


def _extract_entities(text: str) -> List[str]:
    text = _normalize_text(text)
    text_lower = text.lower()
    entities: List[str] = []

    if re.search(r"\bschool\b", text_lower):
        entities.extend(
            [
                "School",
                "Student",
                "Teacher",
                "Class",
                "Course",
                "Subject",
                "Attendance",
                "Grade",
                "Parent",
            ]
        )

    if re.search(r"\bexam\b|\bexams\b|\btest\b|\bassessment\b", text_lower):
        entities.extend(["Exam", "Question", "Result", "Student", "Subject"])

    if re.search(r"\becommerce\b|\be-commerce\b|\bcommerce\b|\bonline store\b", text_lower):
        entities.extend(["Customer", "Order", "Product", "Cart", "Payment", "Shipment", "Address", "Inventory"])

    if re.search(r"\bhospital\b|\bclinic\b|\bhealthcare\b", text_lower):
        entities.extend(["Patient", "Doctor", "Appointment", "Prescription", "MedicalRecord", "Payment"])

    if re.search(r"\bhr\b|\bhuman resources\b|\bemployee\b", text_lower):
        entities.extend(["Employee", "Department", "Role", "Payroll", "Leave"])

    if re.search(r"\bcrm\b|\bsales\b|\blead\b", text_lower):
        entities.extend(["Lead", "Deal", "Account", "Contact", "Pipeline", "User"])

    if re.search(r"\blogistics\b|\bshipping\b|\bwarehouse\b|\btransport\b", text_lower):
        entities.extend(["Shipment", "Warehouse", "Vehicle", "Route", "Delivery", "Inventory"])

    if re.search(r"\bfinance\b|\bfintech\b|\bbanking\b|\bpayments\b", text_lower):
        entities.extend(["Account", "Transaction", "Card", "Ledger", "Payment", "Budget"])

    for canonical, keywords in ENTITY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", text_lower):
                entities.append(canonical)
                break

    for candidate in _extract_entity_candidates(text):
        normalized = _normalize_term(candidate)
        if not normalized or normalized in STOP_ENTITY_TERMS:
            continue
        keyword_match = _keyword_entity(normalized)
        if keyword_match:
            entities.append(keyword_match)
            continue
        if len(normalized) < 3:
            continue
        entities.append(_title_case(normalized))

    if not entities:
        entities.append("Entity")
    return list(dict.fromkeys(entities))


def _entities_in_sentence(sentence: str, entities: List[str]) -> List[str]:
    present: List[str] = []
    for entity in entities:
        keywords = ENTITY_KEYWORDS.get(entity, [entity.lower()])
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}s?\b", sentence):
                present.append(entity)
                break
    return list(dict.fromkeys(present))


def _relationships(input_text: str, entities: List[str]) -> List[str]:
    input_text = _normalize_text(input_text)
    relations: List[str] = []
    nlp = _get_nlp()

    if nlp:
        doc = nlp(input_text)
        sentences = [sent.text for sent in doc.sents] if doc.has_annotation("SENT_START") else [input_text]
    else:
        sentences = re.split(r"[.!?]", input_text)

    for sentence in sentences:
        sentence_lower = sentence.lower()
        present = _entities_in_sentence(sentence_lower, entities)
        if len(present) < 2:
            continue
        for keywords, verb, subjects, objects in RELATION_RULES:
            if any(keyword in sentence_lower for keyword in keywords):
                for subject in present:
                    for obj in present:
                        if subject == obj:
                            continue
                        if subject in subjects and obj in objects:
                            relations.append(f"{subject} {verb} {obj}")

        if "belongs to" in sentence_lower and len(present) >= 2:
            relations.append(f"{present[0]} belongs to {present[1]}")
        elif "has" in sentence_lower or "contains" in sentence_lower or "includes" in sentence_lower:
            relations.append(f"{present[0]} has {present[1]}")

    if not relations:
        input_lower = input_text.lower()
        if "Student" in entities and "Class" in entities:
            relations.append("Student enrolls in Class")
        if "Teacher" in entities and "Class" in entities:
            relations.append("Teacher teaches Class")
        if "Student" in entities and "Course" in entities:
            relations.append("Student enrolls in Course")
        if "Student" in entities and "Grade" in entities:
            relations.append("Student receives Grade")
        if "Student" in entities and "Attendance" in entities:
            relations.append("Student has Attendance")
        if "Parent" in entities and "Student" in entities:
            relations.append("Parent guardians Student")
        if "Exam" in entities and "Question" in entities:
            relations.append("Exam has Question")
        if "Student" in entities and "Exam" in entities:
            relations.append("Student takes Exam")
        if "Result" in entities and "Student" in entities:
            relations.append("Student receives Result")
        if "Result" in entities and "Exam" in entities:
            relations.append("Exam has Result")
        if "Exam" in entities and "Subject" in entities:
            relations.append("Exam belongs to Subject")

        if re.search(r"\becommerce\b|\be-commerce\b|\bcommerce\b|\bonline store\b", input_lower):
            if "Customer" in entities and "Order" in entities:
                relations.append("Customer places Order")
            if "Order" in entities and "Product" in entities:
                relations.append("Order contains Product")
            if "Customer" in entities and "Cart" in entities:
                relations.append("Customer has Cart")
            if "Order" in entities and "Payment" in entities:
                relations.append("Order has Payment")
            if "Order" in entities and "Shipment" in entities:
                relations.append("Order has Shipment")

        if re.search(r"\bhospital\b|\bclinic\b|\bhealthcare\b", input_lower):
            if "Patient" in entities and "Appointment" in entities:
                relations.append("Patient has Appointment")
            if "Doctor" in entities and "Appointment" in entities:
                relations.append("Doctor has Appointment")
            if "Patient" in entities and "Prescription" in entities:
                relations.append("Patient receives Prescription")
            if "Patient" in entities and "MedicalRecord" in entities:
                relations.append("Patient has MedicalRecord")

        if re.search(r"\bhr\b|\bhuman resources\b|\bemployee\b", input_lower):
            if "Employee" in entities and "Department" in entities:
                relations.append("Employee belongs to Department")
            if "Employee" in entities and "Role" in entities:
                relations.append("Employee has Role")
            if "Employee" in entities and "Payroll" in entities:
                relations.append("Employee receives Payroll")
            if "Employee" in entities and "Leave" in entities:
                relations.append("Employee has Leave")

        if re.search(r"\bcrm\b|\bsales\b|\blead\b", input_lower):
            if "Lead" in entities and "Deal" in entities:
                relations.append("Lead converts to Deal")
            if "Account" in entities and "Contact" in entities:
                relations.append("Account has Contact")
            if "User" in entities and "Deal" in entities:
                relations.append("User owns Deal")

        if re.search(r"\blogistics\b|\bshipping\b|\bwarehouse\b|\btransport\b", input_lower):
            if "Shipment" in entities and "Delivery" in entities:
                relations.append("Shipment has Delivery")
            if "Warehouse" in entities and "Inventory" in entities:
                relations.append("Warehouse has Inventory")
            if "Route" in entities and "Vehicle" in entities:
                relations.append("Route uses Vehicle")

        if re.search(r"\bfinance\b|\bfintech\b|\bbanking\b|\bpayments\b", input_lower):
            if "Account" in entities and "Transaction" in entities:
                relations.append("Account has Transaction")
            if "Account" in entities and "Card" in entities:
                relations.append("Account has Card")
            if "Account" in entities and "Ledger" in entities:
                relations.append("Account has Ledger")

    return list(dict.fromkeys(relations))


def _decide_embed_or_reference(text: str, workload_type: str, relationships: List[str]) -> Dict[str, str]:
    text_lower = text.lower()
    decisions = {}
    for relation in relationships:
        relation_lower = relation.lower()
        if "many" in text_lower or "history" in text_lower or "audit" in text_lower:
            decisions[relation] = "reference"
            continue
        if workload_type == "read-heavy" or "frequent" in text_lower:
            decisions[relation] = "embed"
            continue
        if workload_type == "write-heavy":
            decisions[relation] = "reference"
            continue
        if any(word in relation_lower for word in ["has", "contains", "includes", "belongs"]):
            decisions[relation] = "embed"
        else:
            decisions[relation] = "reference"
    return decisions


def _why_not(decisions: Dict[str, str]) -> Dict[str, str]:
    why_not = {}
    for relation, choice in decisions.items():
        if choice == "reference":
            why_not[relation] = "Embedding risks unbounded document growth and update fan-out."
        else:
            why_not[relation] = "Referencing would increase read latency and require extra lookups."
    return why_not


def _confidence(decisions: Dict[str, str]) -> Dict[str, int]:
    confidence = {}
    for relation, choice in decisions.items():
        confidence[relation] = 82 if choice == "reference" else 76
    return confidence


def _attributes(entities: List[str]) -> Dict[str, List[str]]:
    attributes = {}
    for entity in entities:
        attributes[entity] = ENTITY_TEMPLATES.get(entity, ["name", "createdAt"])
    return attributes


def _collection_name(entity: str) -> str:
    return _pluralize(entity.lower())


def _apply_relation(schema: Dict[str, Any], relation: str, choice: str) -> None:
    parts = relation.split()
    if len(parts) < 3:
        return
    left = parts[0]
    right = parts[-1]
    verb = " ".join(parts[1:-1]).lower()
    left_collection = _collection_name(left)
    right_collection = _collection_name(right)
    if left_collection not in schema or right_collection not in schema:
        return

    right_plural = _pluralize(right.lower())

    if any(word in verb for word in ["has", "contains", "includes", "enrolls", "borrows", "takes", "pays", "receives"]):
        if choice == "embed":
            schema[left_collection][right_plural] = [{"_id": "ObjectId"}]
        else:
            schema[left_collection][f"{right.lower()}Ids"] = ["ObjectId"]
        return

    if any(word in verb for word in ["belongs", "assigned", "reports", "guardians"]):
        if choice == "embed":
            schema[left_collection][right.lower()] = {"_id": "ObjectId"}
        else:
            schema[left_collection][f"{right.lower()}Id"] = "ObjectId"
        return

    if choice == "embed":
        schema[left_collection][right_plural] = [{"_id": "ObjectId"}]
    else:
        schema[right_collection][f"{left.lower()}Id"] = "ObjectId"


def _schema(entities: List[str], decisions: Dict[str, str]) -> Dict[str, Any]:
    schema: Dict[str, Any] = {}
    for entity in entities:
        collection = _collection_name(entity)
        schema[collection] = {"_id": "ObjectId"}
        for field in ENTITY_TEMPLATES.get(entity, ["name", "createdAt"]):
            schema[collection][field] = "string"

    for relation, choice in decisions.items():
        if relation == "User places Order":
            if choice == "embed":
                schema["users"]["orders"] = [
                    {"_id": "ObjectId", "total": "number", "status": "string", "createdAt": "date"}
                ]
            else:
                schema["orders"]["userId"] = "ObjectId"
            continue
        if relation == "Order contains Product":
            if choice == "embed":
                schema["orders"]["items"] = [
                    {"productId": "ObjectId", "quantity": "number", "price": "number"}
                ]
            else:
                schema["orders"]["productIds"] = ["ObjectId"]
            continue
        _apply_relation(schema, relation, choice)
    return schema


def _indexes(decisions: Dict[str, str]) -> List[Dict[str, Any]]:
    indexes: List[Dict[str, Any]] = []
    for relation, choice in decisions.items():
        parts = relation.split()
        if len(parts) < 3:
            continue
        left = parts[0]
        right = parts[-1]
        left_collection = _collection_name(left)
        right_collection = _collection_name(right)
        if choice == "reference":
            indexes.append({"collection": right_collection, "field": f"{left.lower()}Id"})
    return indexes


def _warnings(text: str, decisions: Dict[str, str]) -> List[str]:
    warnings = []
    if "history" in text.lower() and any(choice == "embed" for choice in decisions.values()):
        warnings.append("Embedded history arrays may grow unbounded.")
    if "many" in text.lower() and any(choice == "embed" for choice in decisions.values()):
        warnings.append("Embedding many-to-one data can increase document size and update cost.")
    if "audit" in text.lower() and any(choice == "embed" for choice in decisions.values()):
        warnings.append("Audit logs should usually be referenced to avoid rapid growth.")
    return warnings


def _explanations(decisions: Dict[str, str]) -> Dict[str, str]:
    explanations = {}
    for relation, choice in decisions.items():
        if choice == "reference":
            explanations[relation] = "Referencing keeps documents small and avoids large array growth."
        else:
            explanations[relation] = "Embedding supports fast reads for tightly-coupled data."
    return explanations


def generate_schema(input_text: str, workload_type: str) -> Dict[str, Any]:
    """Generate MongoDB schema using Groq API for intelligent reasoning."""
    
    # Detect many-to-many relationships with attributes
    has_pricing = any(kw in input_text.lower() for kw in ['cost', 'price', 'pricing', 'different cost', 'different price'])
    has_inventory = any(kw in input_text.lower() for kw in ['inventory', 'stock', 'quantity', 'availability'])
    
    many_to_many_guidance = ""
    if has_pricing or has_inventory:
        many_to_many_guidance = """
IMPORTANT: If there's a many-to-many relationship with attributes (like products in multiple stores with DIFFERENT prices/costs for each store):
- Create a JUNCTION collection to model this (e.g., "store_inventory", "product_store_mapping", etc.)
- Junction structure: {store_id: ObjectId, product_id: ObjectId, cost/price: Number, quantity: Number}
- This allows efficient queries like "find all products in store X with cost > Y" or "find all stores selling product X with different prices"
"""
    
    prompt = f"""You are a MongoDB schema architect expert. Design an OPTIMAL MongoDB schema for:

User Requirement: {input_text}
Workload Type: {workload_type}

{many_to_many_guidance}

REQUIREMENTS: Respond with DETAILED, COMPLETE JSON only (no markdown, no extra text). Include realistic fields in each collection. Provide SPECIFIC explanations, not generic ones.

Example response format:
{{
  "description": "Complete schema for an e-commerce platform with products, stores, and ratings",
  "schema": {{
    "products": {{
      "_id": "ObjectId",
      "name": "String",
      "description": "String",
      "category": "String",
      "basePrice": "Number",
      "sku": "String",
      "createdAt": "Date"
    }},
    "stores": {{
      "_id": "ObjectId",
      "name": "String", 
      "location": "String",
      "city": "String",
      "phone": "String",
      "createdAt": "Date"
    }},
    "store_inventory": {{
      "_id": "ObjectId",
      "productId": "ObjectId (ref: products)",
      "storeId": "ObjectId (ref: stores)",
      "cost": "Number",
      "quantity": "Number",
      "lastRestocked": "Date"
    }},
    "product_ratings": {{
      "_id": "ObjectId",
      "productId": "ObjectId (ref: products)",
      "userId": "ObjectId",
      "rating": "Number (1-5)",
      "title": "String",
      "comments": [
        {{"text": "String", "createdAt": "Date"}}
      ],
      "createdAt": "Date"
    }}
  }},
  "entities": ["products", "stores", "store_inventory", "product_ratings"],
  "relationships": [
    "products -> store_inventory -> stores (many-to-many)",
    "products -> product_ratings (one-to-many)"
  ],
  "decisions": {{
    "products": "→ SEPARATE COLLECTION (SCALABILITY) - Enables independent product catalog management",
    "stores": "→ SEPARATE COLLECTION - Supports multi-store operations and inventory tracking",
    "store_inventory": "→ JUNCTION COLLECTION - Essential for many-to-many with DIFFERENT COSTS per store",
    "product_ratings": "→ SEPARATE COLLECTION - Prevents array growth issues for unbounded ratings",
    "relationships": {{
      "Products to Stores": "JUNCTION COLLECTION - Allows different pricing per store, efficient store lookups",
      "Ratings to Products": "SEPARATE COLLECTION - Enables pagination and archiving of old ratings",
      "Comments to Ratings": "EMBED - Atomic access, comments always with their rating"
    }}
  }},
  "indexes": [
    {{"collection": "store_inventory", "fields": ["storeId", "productId"], "unique": true, "reason": "Fast lookup of product prices in a specific store"}},
    {{"collection": "store_inventory", "field": "productId", "reason": "Find all stores selling a product"}},
    {{"collection": "product_ratings", "field": "productId", "reason": "Fetch all ratings for a product with pagination"}}
  ],
  "warnings": [
    "Ratings collection can grow large: implement pagination and consider archiving old ratings (>1 year)",
    "Store_inventory size scales with products × stores: ensure both indexes for performance"
  ],
  "explanations": {{
    "Why Separate Collections": "Products, stores, and ratings are independent entities with separate growth patterns. Separation allows independent scaling.",
    "Junction Collection for Many-to-Many": "Each product-store pair needs DIFFERENT costs. Query examples: 'Products in store X', 'Stores selling product Y at cost < $50'",
    "Separate Ratings Collection": "If ratings array embedded in products, it grows without bound. Separate collection enables pagination, archiving, and efficient indexing.",
    "Comments Embedded": "Comments are always accessed with ratings. Embedding is optimal for frequently accessed correlated data.",
    "Access Patterns": "Read-heavy: index on storeId for fast store lookups. Rated products: index on productId for fast rating fetch. Time-based: createdAt index for recent reviews."
  }}
}}"""
    
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
        return {
            "entities": result.get("entities", []),
            "relationships": relationships_obj,  # Now a proper dict
            "attributes": {entity: [] for entity in result.get("entities", [])},
            "decisions": decisions_obj,  # Without nested relationships
            "whyNot": {},
            "confidence": {entity: 95 for entity in result.get("entities", [])},
            "schema": result.get("schema", {}),
            "indexes": result.get("indexes", []),
            "warnings": result.get("warnings", []),
            "explanations": result.get("explanations", {"design": result.get("description", "Schema generated by Groq")}),
            "accessPattern": workload_type,
        }
        
    except Exception as e:
        # Fallback to rule-based generation if Groq fails
        return _generate_schema_fallback(input_text, workload_type, str(e))


def _generate_schema_fallback(input_text: str, workload_type: str, error: str) -> Dict[str, Any]:
    """Fallback rule-based schema generation if Groq fails."""
    entities = _extract_entities(input_text)
    relationships = _relationships(input_text, entities)
    decisions = _decide_embed_or_reference(input_text, workload_type, relationships)
    return {
        "entities": entities,
        "relationships": relationships,
        "attributes": _attributes(entities),
        "decisions": decisions,
        "whyNot": _why_not(decisions),
        "confidence": _confidence(decisions),
        "schema": _schema(entities, decisions),
        "indexes": _indexes(decisions),
        "warnings": _warnings(input_text, decisions) + [f"Fallback NLP mode (Groq error: {error})"],
        "explanations": _explanations(decisions),
        "accessPattern": workload_type,
    }


def _to_camel(term: str) -> str:
    parts = [part for part in re.split(r"\s+|_", term) if part]
    if not parts:
        return term
    return parts[0].lower() + "".join(part.capitalize() for part in parts[1:])


def _resolve_collection(schema: Dict[str, Any], name: str) -> str | None:
    normalized = _normalize_term(name)
    if not normalized:
        return None
    candidates = {
        normalized,
        _pluralize(normalized),
        _singularize(normalized),
    }
    for candidate in candidates:
        if candidate in schema:
            return candidate
    return None


def _ensure_collection(schema: Dict[str, Any], entities: List[str], attributes: Dict[str, List[str]], name: str) -> str:
    normalized = _normalize_term(name)
    collection = _pluralize(normalized)
    if collection not in schema:
        schema[collection] = {"_id": "ObjectId"}
    entity = _title_case(normalized)
    if entity not in entities:
        entities.append(entity)
    if entity not in attributes:
        attributes[entity] = ENTITY_TEMPLATES.get(entity, ["name", "createdAt"])
    for field in attributes[entity]:
        schema[collection].setdefault(field, "string")
    return collection


def _remove_entity(entities: List[str], attributes: Dict[str, List[str]], name: str) -> None:
    entity = _title_case(_normalize_term(name))
    if entity in entities:
        entities.remove(entity)
    attributes.pop(entity, None)


def _update_relationships(relationships: List[str], old: str, new: str) -> List[str]:
    updated = []
    for relation in relationships:
        updated.append(relation.replace(old, new))
    return list(dict.fromkeys(updated))


def apply_refinement(base_result: Dict[str, Any], refinement_text: str, workload_type: str) -> Dict[str, Any]:
    """Apply refinement using LLM to regenerate schema with updated decisions, warnings, and relationships."""
    
    current_schema = base_result.get("schema", {})
    current_decisions = base_result.get("decisions", {})
    current_explanations = base_result.get("explanations", {})
    
    prompt = f"""You are a MongoDB schema architect expert. You need to REFINE an existing schema based on a user's modification request.

CURRENT SCHEMA:
{json.dumps(current_schema, indent=2)}

CURRENT DECISIONS:
{json.dumps(current_decisions, indent=2)}

USER REFINEMENT REQUEST: {refinement_text}

Workload Type: {workload_type}

CRITICAL ANALYSIS REQUIREMENTS:
1. **Understand the goal** - What is the user trying to achieve? (e.g., reduce depth, add field, improve performance)
2. **Evaluate feasibility** - CAN you fully achieve this goal with the current schema?
3. **Report honestly** - Did you succeed, partially succeed, or fail? Why?
4. **Provide next steps** - If the goal wasn't fully met, what else needs to be done?

TASK: Apply the refinement and return a COMPLETE, UPDATED schema with:
1. Modified schema structure (add/remove/rename fields/collections as requested)
2. **refinementSummary** - Clear statement of what was achieved and what wasn't
3. Updated decisions explaining why each collection is separate/embedded
4. Updated relationships
5. Updated indexes
6. Updated warnings (include if goal wasn't fully met)
7. Updated explanations (specific to the changes made AND why certain changes weren't possible)
8. Updated confidence scores

IMPORTANT RULES:
- If user requests "reduce max depth to X", count nesting levels carefully (arrays of objects add depth!)
- If adding a field to a nested object (like "address"), add it INSIDE that object, not at root level
- If the request mentions "whether X or Y or Z", create an enum field: {{"type": "enum(['X', 'Y', 'Z'])"}} NOT nested
- Use camelCase for field names
- Be HONEST in refinementSummary - if you couldn't fully achieve the goal, say so and explain why
- Suggest alternatives in explanations if the exact request isn't feasible

DEPTH CALCULATION EXAMPLE:
- users.name = depth 1
- users.address.city = depth 2
- users.address.type.value = depth 3
- cart.products[].productId = depth 3 (array counts as level!)
- cart.products[].productId.type = depth 4

🚨 CRITICAL: Your JSON response MUST start with "refinementSummary" as the very first field. This is NON-NEGOTIABLE.
Without this field, the response is considered INVALID.

RESPOND WITH COMPLETE JSON ONLY (no markdown, no extra text):

{{
  "refinementSummary": "⚠️ MANDATORY - ONE detailed sentence with SPECIFIC ACTIONS and NUMBERS. Format: 'Successfully [specific action taken] by [what you changed], reducing [metric] from X to Y and [another metric] from A to B.' OR 'Failed/Partially achieved [goal]: [specific reason]. Current [metric]=X (target was Y).' NEVER just say 'Applied refinement: [user request]' - that's too generic!",
  "description": "Brief description of what was changed",
  "schema": {{"collection_name": {{"field": "Type"}}}},
  "entities": ["list", "of", "collections"],
  "relationships": ["collection1 -> collection2 (type)"],
  "decisions": {{
    "collection_name": "→ DECISION - Specific reason",
    "relationships": {{
      "Relationship Name": "DECISION - Why this pattern"
    }}
  }},
  "indexes": [
    {{"collection": "name", "fields": ["field"], "unique": true/false, "reason": "Specific reason"}}
  ],
  "warnings": ["Specific warning with context", "If goal not met: Warning about remaining issues"],
  "explanations": {{
    "Key Topic": "Detailed explanation of why this design choice",
    "refinement": "Specific detail about what changed (e.g., 'Removed products[] array from orders and orders[] array from products, eliminated 17 redundant fields')",
    "Alternatives": "⚠️ MANDATORY if new warnings added - ONE actionable solution (NOT trade-off explanation). Example: 'To resolve data inconsistency warnings, use MongoDB change streams or application-level event handlers to sync updates between related collections.'"
  }},
  "confidence": {{"collection_name": 85}},
  "accessPattern": "{workload_type}"
}}

EXAMPLE refinementSummary - GOOD:
"Successfully normalized schema by removing denormalized product and order arrays from collections, reducing total fields from 108 to 91 and depth from 4 to 3."
"Flattened all nested enum objects (role.type.type → role), reducing max depth from 5 to 3 and simplifying 15 field structures across 9 collections."

EXAMPLE refinementSummary - BAD (too generic):
"Applied refinement: do normalizing" ❌
"Successfully normalized the schema" ❌  

EXAMPLE refinementSummary PARTIAL SUCCESS:
"Partially achieved depth target: Reduced from 5 to 3 by flattening enums and address fields, but depth 2 impossible due to cartItems array structure (array of objects = depth 3)."

EXAMPLE refinementSummary FAILURE:
"Failed to achieve max depth 2 (current: 4). Converted all ObjectId to String but embedded arrays (cartItems, orderItems) inherently require depth 3+. Would need full denormalization to separate collections."

⚠️ MANDATORY "Alternatives" FIELD WHEN:
- New warnings added → MUST suggest how to resolve them (e.g., "To prevent data inconsistency between orders and orderItems, implement MongoDB transactions or change streams for automatic synchronization")
- Refinement partially failed → MUST suggest next step to complete it
- Refinement created trade-offs → MUST suggest how to mitigate them
- DO NOT just restate the problem - provide an actionable next step that reduces warnings

EXAMPLE Alternatives GOOD:
"To prevent data inconsistency warnings, implement MongoDB change streams to automatically sync updates between orders and orderItems collections, or use multi-document transactions."
"To reduce depth to 2, convert cartItemIds array-of-strings into a separate cartItems collection with userId reference."

EXAMPLE Alternatives BAD (too generic):
"Consider using transactions" ❌
"May need to optimize" ❌

🚨 CRITICAL RULES:
1. refinementSummary MUST be FIRST field with SPECIFIC ACTIONS and NUMBERS (not just "Applied refinement: [request]")
2. If new warnings added, Alternatives field is MANDATORY with actionable solution
3. Include before→after metrics (depth, fields, collections)
4. Be honest about success/partial/failure
5. Alternatives must help REDUCE warnings, not explain them"""

    try:
        response = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.2
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
                # Fallback to regex-based approach if LLM fails
                return _apply_refinement_regex(base_result, refinement_text, workload_type)
        
        # Process relationships similar to generate_schema
        relationships_obj = result.get("relationships", {})
        decisions_obj = result.get("decisions", {})
        
        if "relationships" in decisions_obj and isinstance(decisions_obj["relationships"], dict):
            relationships_obj = decisions_obj.pop("relationships")
        elif isinstance(relationships_obj, list):
            rel_dict = {}
            for rel_str in relationships_obj:
                rel_dict[rel_str] = result.get("decisions", {}).get(rel_str, "reference")
            relationships_obj = rel_dict
        
        # Ensure all required fields exist
        final_result = {
            "schema": result.get("schema", current_schema),
            "entities": result.get("entities", list(result.get("schema", {}).keys())),
            "relationships": list(relationships_obj.keys()) if isinstance(relationships_obj, dict) else relationships_obj,
            "attributes": _extract_attributes(result.get("schema", {})),
            "decisions": decisions_obj,
            "whyNot": result.get("whyNot", {}),
            "indexes": result.get("indexes", []),
            "warnings": result.get("warnings", []),
            "explanations": result.get("explanations", {}),
            "confidence": result.get("confidence", {}),
            "accessPattern": workload_type
        }
        
        # Add refinement note to explanations
        if "explanations" not in final_result:
            final_result["explanations"] = {}
        final_result["explanations"]["refinement"] = f"Applied refinement: {refinement_text.strip()}"
        
        return final_result
        
    except Exception as e:
        # Fallback to regex-based approach if LLM fails
        print(f"LLM refinement failed: {e}, falling back to regex approach")
        return _apply_refinement_regex(base_result, refinement_text, workload_type)


def _extract_attributes(schema: Dict[str, Any]) -> Dict[str, List[str]]:
    """Extract attributes from schema for each collection."""
    attributes = {}
    for collection, fields in schema.items():
        if isinstance(fields, dict):
            attributes[_title_case(collection)] = list(fields.keys())
    return attributes


def _apply_refinement_regex(base_result: Dict[str, Any], refinement_text: str, workload_type: str) -> Dict[str, Any]:
    """Legacy regex-based refinement (fallback when LLM fails)."""
    result = copy.deepcopy(base_result)
    schema: Dict[str, Any] = result.get("schema", {})
    entities: List[str] = result.get("entities", [])
    attributes: Dict[str, List[str]] = result.get("attributes", {})
    relationships: List[str] = result.get("relationships", [])
    decisions: Dict[str, str] = result.get("decisions", {})

    refinement_text = _normalize_text(refinement_text)
    sentences = re.split(r"[.!?]", refinement_text)

    for sentence in sentences:
        text = sentence.strip()
        if not text:
            continue
        lower = text.lower()

        add_collection = re.search(r"add (collection|entity|table)\s+(named\s+)?(?P<name>[\w\s]+)", lower)
        if add_collection:
            name = add_collection.group("name")
            collection = _ensure_collection(schema, entities, attributes, name)
            fields_match = re.search(r"with\s+(fields\s+)?(?P<fields>[\w\s,]+)", lower)
            if fields_match:
                fields = re.split(r",|and", fields_match.group("fields"))
                for field in fields:
                    field_name = _to_camel(_normalize_term(field))
                    if not field_name:
                        continue
                    schema[collection][field_name] = "string"
                    entity_name = _title_case(_normalize_term(name))
                    attributes.setdefault(entity_name, []).append(field_name)
            continue

        remove_collection = re.search(r"remove (collection|entity|table)\s+(named\s+)?(?P<name>[\w\s]+)", lower)
        if remove_collection:
            name = remove_collection.group("name")
            collection = _resolve_collection(schema, name)
            if collection:
                schema.pop(collection, None)
            _remove_entity(entities, attributes, name)
            relationships = [rel for rel in relationships if _title_case(_normalize_term(name)) not in rel]
            decisions = {rel: decision for rel, decision in decisions.items() if _title_case(_normalize_term(name)) not in rel}
            continue

        rename_collection = re.search(
            r"rename (collection|entity|table)\s+(?P<old>[\w\s]+)\s+to\s+(?P<new>[\w\s]+)",
            lower,
        )
        if rename_collection:
            old = rename_collection.group("old")
            new = rename_collection.group("new")
            old_collection = _resolve_collection(schema, old)
            if old_collection:
                new_collection = _pluralize(_normalize_term(new))
                schema[new_collection] = schema.pop(old_collection)
                old_entity = _title_case(_normalize_term(old))
                new_entity = _title_case(_normalize_term(new))
                if old_entity in entities:
                    entities[entities.index(old_entity)] = new_entity
                if old_entity in attributes:
                    attributes[new_entity] = attributes.pop(old_entity)
                relationships = _update_relationships(relationships, old_entity, new_entity)
                decisions = {
                    rel.replace(old_entity, new_entity): decision for rel, decision in decisions.items()
                }
            continue

        add_field = re.search(r"add field\s+(?P<field>[\w\s]+)\s+to\s+(?P<collection>[\w\s]+)", lower)
        # Also support simpler patterns like "add <field> to/for <collection>"
        if not add_field:
            add_field = re.search(r"add\s+(?P<field>[\w\s]+?)\s+(?:to|for|in)\s+(?P<collection>[\w\s]+)", lower)
        if add_field:
            field = _to_camel(_normalize_term(add_field.group("field")))
            collection = _ensure_collection(schema, entities, attributes, add_field.group("collection"))
            if field:
                schema[collection][field] = "string"
                entity_name = _title_case(_normalize_term(add_field.group("collection")))
                attributes.setdefault(entity_name, []).append(field)
            continue

        add_fields = re.search(r"add fields\s+(?P<fields>[\w\s,]+)\s+to\s+(?P<collection>[\w\s]+)", lower)
        if add_fields:
            fields = re.split(r",|and", add_fields.group("fields"))
            collection = _ensure_collection(schema, entities, attributes, add_fields.group("collection"))
            entity_name = _title_case(_normalize_term(add_fields.group("collection")))
            for field in fields:
                field_name = _to_camel(_normalize_term(field))
                if not field_name:
                    continue
                schema[collection][field_name] = "string"
                attributes.setdefault(entity_name, []).append(field_name)
            continue

        remove_field = re.search(
            r"remove field\s+(?P<field>[\w\s]+)\s+from\s+(?P<collection>[\w\s]+)", lower
        )
        # Also support simpler patterns like "remove <field> from/for <collection>"
        if not remove_field:
            remove_field = re.search(
                r"remove\s+(?P<field>[\w\s]+?)\s+(?:from|for|in)\s+(?P<collection>[\w\s]+)", lower
            )
        if remove_field:
            field = _to_camel(_normalize_term(remove_field.group("field")))
            collection = _resolve_collection(schema, remove_field.group("collection"))
            if collection and field in schema.get(collection, {}):
                schema[collection].pop(field, None)
            # Also check nested fields (e.g., "zip" in "address")  
            elif collection:
                for key, value in schema.get(collection, {}).items():
                    if isinstance(value, dict) and field in value:
                        schema[collection][key].pop(field, None)
            entity_name = _title_case(_normalize_term(remove_field.group("collection")))
            if entity_name in attributes and field in attributes[entity_name]:
                attributes[entity_name].remove(field)
            continue

        rename_field = re.search(
            r"rename field\s+(?P<old>[\w\s]+)\s+to\s+(?P<new>[\w\s]+)\s+in\s+(?P<collection>[\w\s]+)",
            lower,
        )
        if rename_field:
            old_field = _to_camel(_normalize_term(rename_field.group("old")))
            new_field = _to_camel(_normalize_term(rename_field.group("new")))
            collection = _resolve_collection(schema, rename_field.group("collection"))
            if collection and old_field in schema.get(collection, {}):
                schema[collection][new_field] = schema[collection].pop(old_field)
            entity_name = _title_case(_normalize_term(rename_field.group("collection")))
            if entity_name in attributes:
                if old_field in attributes[entity_name]:
                    attributes[entity_name][attributes[entity_name].index(old_field)] = new_field
            continue

        change_field_type = re.search(
            r"change field\s+(?P<field>[\w\s]+)\s+to\s+(?P<type>[\w\s]+)\s+in\s+(?P<collection>[\w\s]+)",
            lower,
        )
        if change_field_type:
            field = _to_camel(_normalize_term(change_field_type.group("field")))
            field_type = _normalize_term(change_field_type.group("type"))
            collection = _resolve_collection(schema, change_field_type.group("collection"))
            if collection and field:
                normalized_type = {
                    "string": "string",
                    "text": "string",
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
                }.get(field_type, field_type)
                schema[collection][field] = normalized_type
            continue

        embed_match = re.search(r"embed\s+(?P<child>[\w\s]+)\s+in\s+(?P<parent>[\w\s]+)", lower)
        if embed_match:
            child = _title_case(_normalize_term(embed_match.group("child")))
            parent = _title_case(_normalize_term(embed_match.group("parent")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{parent} has {child}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "embed"
            _apply_relation(schema, relation, "embed")
            continue

        embed_alt = re.search(r"make\s+(?P<child>[\w\s]+)\s+embedded\s+under\s+(?P<parent>[\w\s]+)", lower)
        if embed_alt:
            child = _title_case(_normalize_term(embed_alt.group("child")))
            parent = _title_case(_normalize_term(embed_alt.group("parent")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{parent} has {child}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "embed"
            _apply_relation(schema, relation, "embed")
            continue

        reference_match = re.search(r"reference\s+(?P<child>[\w\s]+)\s+in\s+(?P<parent>[\w\s]+)", lower)
        if reference_match:
            child = _title_case(_normalize_term(reference_match.group("child")))
            parent = _title_case(_normalize_term(reference_match.group("parent")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{parent} has {child}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "reference"
            _apply_relation(schema, relation, "reference")
            continue

        reference_alt = re.search(
            r"use references for\s+(?P<child>[\w\s]+)\s+in\s+(?P<parent>[\w\s]+)",
            lower,
        )
        if reference_alt:
            child = _title_case(_normalize_term(reference_alt.group("child")))
            parent = _title_case(_normalize_term(reference_alt.group("parent")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{parent} has {child}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "reference"
            _apply_relation(schema, relation, "reference")
            continue

        has_many = re.search(r"(?P<parent>[\w\s]+)\s+has many\s+(?P<child>[\w\s]+)", lower)
        if has_many:
            parent = _title_case(_normalize_term(has_many.group("parent")))
            child = _title_case(_normalize_term(has_many.group("child")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{parent} has {child}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "reference"
            _apply_relation(schema, relation, "reference")
            continue

        belongs_to = re.search(r"(?P<child>[\w\s]+)\s+belongs to\s+(?P<parent>[\w\s]+)", lower)
        if belongs_to:
            parent = _title_case(_normalize_term(belongs_to.group("parent")))
            child = _title_case(_normalize_term(belongs_to.group("child")))
            _ensure_collection(schema, entities, attributes, child)
            _ensure_collection(schema, entities, attributes, parent)
            relation = f"{child} belongs to {parent}"
            if relation not in relationships:
                relationships.append(relation)
            decisions[relation] = "reference"
            _apply_relation(schema, relation, "reference")
            continue

    decisions = dict(decisions)
    result["schema"] = schema
    result["entities"] = entities
    result["attributes"] = attributes
    result["relationships"] = list(dict.fromkeys(relationships))
    result["decisions"] = decisions
    result["indexes"] = _indexes(decisions)
    result["whyNot"] = _why_not(decisions)
    result["confidence"] = _confidence(decisions)
    result["explanations"] = _explanations(decisions)
    warnings = result.get("warnings", [])
    warnings.extend(_warnings(refinement_text, decisions))
    result["warnings"] = list(dict.fromkeys(warnings))
    result["accessPattern"] = workload_type
    result["explanations"]["refinement"] = f"Applied refinement: {refinement_text.strip()}"
    return result
