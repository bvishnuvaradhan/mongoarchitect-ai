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


# ============================
# HACKATHON INTELLIGENCE LAYER
# ============================

CARDINALITY_HINTS = {
    "one_to_one": ["profile", "detail", "setting"],
    "one_to_few": ["address", "phone", "payment method"],
    "one_to_many": ["order", "exam", "attendance", "appointment", "log"],
    "many_to_many": ["tag", "course", "store", "product", "student"],
}

TEMPORAL_KEYWORDS = [
    "history",
    "log",
    "activity",
    "attendance",
    "transaction",
    "event",
    "audit",
]


def detect_cardinality(text: str, relation: str) -> str:
    text = text.lower()
    for card, hints in CARDINALITY_HINTS.items():
        if any(h in text for h in hints):
            return card
    if "many" in text or "multiple" in text:
        return "many_to_many"
    return "one_to_many"


def detect_temporal_data(relation: str) -> bool:
    return any(word in relation.lower() for word in TEMPORAL_KEYWORDS)


def estimate_doc_growth(relation: str) -> str:
    if "history" in relation.lower():
        return "unbounded"
    if "many" in relation.lower():
        return "large_array"
    return "bounded"


def simulate_query_cost(choice: str) -> Dict[str, int]:
    return {
        "embed": {"read_cost": 1, "write_cost": 4, "join_cost": 0},
        "reference": {"read_cost": 3, "write_cost": 1, "join_cost": 2},
    }[choice]


def suggest_sharding(entities: List[str]) -> List[Dict[str, str]]:
    sharding = []
    if "Order" in entities:
        sharding.append({
            "collection": "orders",
            "shardKey": "userId",
            "reason": "High write throughput expected",
        })
    if "Transaction" in entities:
        sharding.append({
            "collection": "transactions",
            "shardKey": "accountId",
            "reason": "Time-series scaling",
        })
    return sharding


def future_risk_score(decisions: Dict[str, str], growth_map: Dict[str, str]) -> int:
    score = 0
    for relation, choice in decisions.items():
        if choice == "embed" and growth_map.get(relation) != "bounded":
            score += 15
        elif choice == "reference":
            score += 5
    return min(score, 100)


def performance_index(query_costs: Dict[str, Dict[str, int]]) -> int:
    read = sum(c["read_cost"] for c in query_costs.values())
    write = sum(c["write_cost"] for c in query_costs.values())
    join = sum(c["join_cost"] for c in query_costs.values())
    return max(0, 100 - (read + write + join))


def advanced_decision_engine(text: str, relationships: List[str]) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Dict[str, int]]]:
    decisions: Dict[str, str] = {}
    growth_map: Dict[str, str] = {}
    query_costs: Dict[str, Dict[str, int]] = {}

    for rel in relationships:
        cardinality = detect_cardinality(text, rel)
        temporal = detect_temporal_data(rel)
        growth = estimate_doc_growth(rel)

        growth_map[rel] = growth

        if temporal:
            choice = "reference"
        elif cardinality in ["one_to_one", "one_to_few"]:
            choice = "embed"
        elif cardinality == "many_to_many":
            choice = "reference"
        else:
            choice = "reference"

        decisions[rel] = choice
        query_costs[rel] = simulate_query_cost(choice)

    return decisions, growth_map, query_costs


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
        normalized_schema = _normalize_schema(result.get("schema", {}))
        relationships_obj = _normalize_relationships(relationships_obj, decisions_obj)
        version_info = _build_schema_version()

        relationships_list = list(relationships_obj.keys())
        decisions, growth_map, query_costs = advanced_decision_engine(
            input_text, relationships_list
        )
        risk = future_risk_score(decisions, growth_map)
        performance = performance_index(query_costs)
        sharding = suggest_sharding(result.get("entities", []))

        return {
            **version_info,
            "entities": result.get("entities", []),
            "relationships": relationships_obj,
            "attributes": {entity: [] for entity in result.get("entities", [])},
            "decisions": decisions_obj,  # Without nested relationships
            "whyNot": {},
            "confidence": {entity: 95 for entity in result.get("entities", [])},
            "futureRiskScore": risk,
            "performanceIndex": performance,
            "queryCostAnalysis": query_costs,
            "growthRiskMap": growth_map,
            "autoSharding": sharding,
            "schema": normalized_schema,
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
    decisions, growth_map, query_costs = advanced_decision_engine(input_text, relationships)
    relationships_obj = _normalize_relationships(relationships, decisions)
    normalized_schema = _normalize_schema(_schema(entities, decisions))
    version_info = _build_schema_version()
    risk = future_risk_score(decisions, growth_map)
    performance = performance_index(query_costs)
    sharding = suggest_sharding(entities)
    return {
        **version_info,
        "entities": entities,
        "relationships": relationships_obj,
        "attributes": _attributes(entities),
        "decisions": decisions,
        "whyNot": _why_not(decisions),
        "confidence": _confidence(decisions),
        "futureRiskScore": risk,
        "performanceIndex": performance,
        "queryCostAnalysis": query_costs,
        "growthRiskMap": growth_map,
        "autoSharding": sharding,
        "schema": normalized_schema,
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
    old_schema = _normalize_schema(copy.deepcopy(base_result.get("schema", {})))
    old_metrics = _schema_metrics(old_schema)

    prompt = f"""
You are an expert MongoDB schema architect.

CURRENT SCHEMA:
{json.dumps(old_schema, indent=2)}

USER REFINEMENT REQUEST:
{refinement_text}

Workload Type: {workload_type}

Respond with COMPLETE JSON only.
FIRST FIELD MUST be "refinementSummary".
"""

    strict_prompt = f"""
You are an expert MongoDB schema architect.

CURRENT SCHEMA:
{json.dumps(old_schema, indent=2)}

USER REFINEMENT REQUEST:
{refinement_text}

Workload Type: {workload_type}

Return ONLY valid JSON with the following top-level fields:
- refinementSummary (string, first field)
- schema (object, REQUIRED)
- relationships (object or list)
- decisions (object)
- indexes (array)
- warnings (array)
- explanations (object)
- confidence (object)

Do NOT include any text outside the JSON.
"""

    def _run_refinement_llm(prompt_text: str) -> Dict[str, Any]:
        response = _groq.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt_text}],
            max_tokens=3500,
            temperature=0.15,
        )

        raw = response.choices[0].message.content.strip()
        result = _extract_valid_json(raw)
        if not isinstance(result, dict):
            raise ValueError("LLM response is not a JSON object")
        return result

    try:
        result = _run_refinement_llm(prompt)

        if "schema" not in result:
            result = _run_refinement_llm(strict_prompt)

        if "schema" not in result:
            raise ValueError("LLM response missing schema")

        _apply_force_embed_from_refinement(refinement_text, result)
        _apply_force_add_collections_from_refinement(refinement_text, result)

        new_schema = _normalize_schema(result["schema"])
        new_metrics = _schema_metrics(new_schema)
        diff = _diff_schema(old_schema, new_schema)
        schema_changed = not _schemas_equal(old_schema, new_schema)

        summary = result.get("refinementSummary")
        if not _validate_summary(summary, schema_changed):
            summary = _generate_summary(old_metrics, new_metrics, diff, schema_changed)

        relationships_obj = result.get("relationships", {})
        decisions_obj = result.get("decisions", {})
        if "relationships" in decisions_obj and isinstance(decisions_obj["relationships"], dict):
            relationships_obj = decisions_obj.pop("relationships")
        relationships_obj = _normalize_relationships(relationships_obj, decisions_obj)
        version_info = _build_schema_version(base_result)

        relationships_list = list(relationships_obj.keys())
        decisions_ai, growth_map, query_costs = advanced_decision_engine(
            refinement_text, relationships_list
        )
        risk = future_risk_score(decisions_ai, growth_map)
        performance = performance_index(query_costs)
        sharding = suggest_sharding(result.get("entities", []))

        return {
            **version_info,
            "refinementSummary": summary,
            "schema": new_schema,
            "entities": result.get("entities", list(new_schema.keys())),
            "relationships": relationships_obj,
            "decisions": decisions_obj,
            "indexes": result.get("indexes", []),
            "warnings": result.get("warnings", []),
            "explanations": result.get("explanations", {}),
            "confidence": result.get("confidence", {}),
            "futureRiskScore": risk,
            "performanceIndex": performance,
            "queryCostAnalysis": query_costs,
            "growthRiskMap": growth_map,
            "autoSharding": sharding,
            "accessPattern": workload_type,
            "metrics": new_metrics,
            "diff": diff,
        }

    except Exception as e:
        fallback_result = copy.deepcopy(base_result)
        _apply_force_embed_from_refinement(refinement_text, fallback_result)
        _apply_force_add_collections_from_refinement(refinement_text, fallback_result)
        fallback_schema = _normalize_schema(fallback_result.get("schema", old_schema))
        fallback_metrics = _schema_metrics(fallback_schema)
        fallback_diff = _diff_schema(old_schema, fallback_schema)
        fallback_changed = not _schemas_equal(old_schema, fallback_schema)
        fallback_summary = _generate_summary(
            old_metrics,
            fallback_metrics,
            fallback_diff,
            fallback_changed,
        )

        warnings = [f"LLM refinement failed - deterministic fallback: {str(e)}"]
        warnings.extend(fallback_result.get("warnings", []))
        relationships_obj = _normalize_relationships(
            fallback_result.get("relationships", base_result.get("relationships", [])),
            fallback_result.get("decisions", base_result.get("decisions", {})),
        )
        version_info = _build_schema_version(base_result)

        relationships_list = list(relationships_obj.keys())
        decisions_ai, growth_map, query_costs = advanced_decision_engine(
            refinement_text, relationships_list
        )
        risk = future_risk_score(decisions_ai, growth_map)
        performance = performance_index(query_costs)
        sharding = suggest_sharding(fallback_result.get("entities", base_result.get("entities", [])))

        return {
            **version_info,
            "refinementSummary": fallback_summary,
            "schema": fallback_schema,
            "entities": fallback_result.get("entities", base_result.get("entities", [])),
            "relationships": relationships_obj,
            "decisions": fallback_result.get("decisions", base_result.get("decisions", {})),
            "indexes": fallback_result.get("indexes", base_result.get("indexes", [])),
            "warnings": list(dict.fromkeys(warnings)),
            "explanations": fallback_result.get("explanations", base_result.get("explanations", {})),
            "confidence": fallback_result.get("confidence", base_result.get("confidence", {})),
            "futureRiskScore": risk,
            "performanceIndex": performance,
            "queryCostAnalysis": query_costs,
            "growthRiskMap": growth_map,
            "autoSharding": sharding,
            "accessPattern": workload_type,
            "metrics": fallback_metrics,
            "diff": fallback_diff,
        }


def _extract_attributes(schema: Dict[str, Any]) -> Dict[str, List[str]]:
    """Extract attributes from schema for each collection."""
    attributes = {}
    for collection, fields in schema.items():
        if isinstance(fields, dict):
            attributes[_title_case(collection)] = list(fields.keys())
    return attributes


def _extract_paths(schema: Dict[str, Any]) -> List[str]:
    """Flatten schema into a list of dotted paths (arrays include [])."""
    paths: List[str] = []

    def walk(obj: Any, prefix: str = "") -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                new_prefix = f"{prefix}.{key}" if prefix else key
                paths.append(new_prefix)
                walk(value, new_prefix)
        elif isinstance(obj, list) and obj:
            walk(obj[0], prefix + "[]")

    if isinstance(schema, dict):
        walk(schema)
    return sorted(paths)


def _diff_schema(old_schema: Dict[str, Any], new_schema: Dict[str, Any]) -> Dict[str, List[str]]:
    old_paths = set(_extract_paths(old_schema))
    new_paths = set(_extract_paths(new_schema))

    return {
        "added": sorted(new_paths - old_paths),
        "removed": sorted(old_paths - new_paths),
    }


def _extract_valid_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise ValueError("Invalid JSON from LLM")


def _validate_summary(summary: str, schema_changed: bool) -> bool:
    if not isinstance(summary, str) or len(summary.strip()) < 30:
        return False

    lowered = summary.lower()
    forbidden = [
        "applied refinement",
        "implemented ",
        "requested changes",
    ]

    if any(word in lowered for word in forbidden):
        return False

    if schema_changed and lowered.startswith("no schema changes"):
        return False

    return True


def _generate_summary(
    old_metrics: Dict[str, int],
    new_metrics: Dict[str, int],
    diff: Dict[str, List[str]],
    schema_changed: bool,
) -> str:
    if not schema_changed:
        return (
            "No schema changes made - structure remains "
            f"{new_metrics['collections']} collections and "
            f"{new_metrics['fields']} fields."
        )

    summary = (
        "Successfully updated schema: collections "
        f"{old_metrics['collections']}→{new_metrics['collections']}, "
        f"fields {old_metrics['fields']}→{new_metrics['fields']}, "
        f"depth {old_metrics['depth']}→{new_metrics['depth']}."
    )

    if diff["added"]:
        summary += f" Added paths: {', '.join(diff['added'][:3])}."
    if diff["removed"]:
        summary += f" Removed paths: {', '.join(diff['removed'][:3])}."

    return summary


def _count_fields(value: Any) -> int:
    """Count fields across schema including nested objects."""
    if isinstance(value, dict):
        total = 0
        for v in value.values():
            total += 1
            total += _count_fields(v)
        return total
    if isinstance(value, list):
        if not value:
            return 0
        return _count_fields(value[0])
    return 0


def _max_depth(value: Any, depth: int = 0) -> int:
    """Compute max depth where arrays add depth."""
    if isinstance(value, dict):
        if not value:
            return depth
        return max(_max_depth(v, depth + 1) for v in value.values())
    if isinstance(value, list):
        if not value:
            return depth + 1
        return max(_max_depth(item, depth + 1) for item in value)
    return depth


def _schema_metrics(schema: Dict[str, Any]) -> Dict[str, int]:
    return {
        "collections": len(schema) if isinstance(schema, dict) else 0,
        "fields": _count_fields(schema),
        "depth": _max_depth(schema)
    }


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

def _deep_normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _deep_normalize(obj[k]) for k in sorted(obj)}
    if isinstance(obj, list):
        return sorted(
            [_deep_normalize(x) for x in obj],
            key=lambda x: json.dumps(x, sort_keys=True)
        )
    return obj


def _schemas_equal(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    return _deep_normalize(a) == _deep_normalize(b)


def _looks_like_relation(text: str) -> bool:
    lowered = text.lower()
    return any(
        token in lowered
        for token in ["->", " has ", " belongs ", " contains ", " includes ", " enrolls ", " borrows ", " takes ", " pays ", " receives ", " teaches ", " owns ", " uses ", " places ", " converts "]
    )


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
            normalized[relation] = normalized_choice or "reference"
    elif isinstance(relationships_obj, list):
        for relation in relationships_obj:
            if not isinstance(relation, str):
                continue
            normalized_choice = _parse_embed_reference(decisions.get(relation))
            normalized[relation] = normalized_choice or "reference"

    if not normalized and isinstance(decisions, dict):
        for relation, choice in decisions.items():
            if not isinstance(relation, str) or not _looks_like_relation(relation):
                continue
            normalized_choice = _parse_embed_reference(choice)
            if normalized_choice:
                normalized[relation] = normalized_choice

    return normalized


def _is_application_request(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    keywords = [
        "transaction",
        "change stream",
        "changestream",
        "session.withtransaction",
        "watch()",
        "trigger",
        "event handler",
        "sync updates",
        "change streams"
    ]
    return any(keyword in lowered for keyword in keywords)


def _apply_force_embed_from_refinement(refinement_text: str, result: Dict[str, Any]) -> bool:
    """Apply a forced embed move when refinement asks to keep child in parent collection."""
    if not refinement_text or not isinstance(result, dict):
        return False

    schema = result.get("schema")
    if not isinstance(schema, dict):
        return False

    text = refinement_text.lower()
    patterns = [
        r"keep\s+(?P<child>[\w\s]+?)\s+in\s+(?P<parent>[\w\s]+?)\s+collection",
        r"keep\s+(?P<child>[\w\s]+?)\s+in\s+(?P<parent>[\w\s]+?)\s+only",
        r"embed\s+(?P<child>[\w\s]+?)\s+in\s+(?P<parent>[\w\s]+?)",
    ]

    match = None
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            break

    if not match:
        return False

    child = _normalize_term(match.group("child"))
    parent = _normalize_term(match.group("parent"))
    if not child or not parent:
        return False

    child_collection = _resolve_collection(schema, child)
    parent_collection = _resolve_collection(schema, parent)

    if not child_collection or not parent_collection:
        return False
    if child_collection == parent_collection:
        return False

    child_fields = schema.get(child_collection)
    if not isinstance(child_fields, dict):
        return False

    embed_field = _pluralize(_to_camel(child))
    embedded_doc = {k: v for k, v in child_fields.items() if k != "_id"}
    if not embedded_doc:
        embedded_doc = {"_id": "ObjectId"}

    parent_fields = schema.get(parent_collection)
    if not isinstance(parent_fields, dict):
        return False
    if embed_field not in parent_fields:
        parent_fields[embed_field] = [embedded_doc]

    # Remove child collection and related id references.
    schema.pop(child_collection, None)

    child_singular = _singularize(child)
    candidate_ids = {
        f"{_to_camel(child_singular)}Id",
        f"{_to_camel(child)}Id",
    }

    for collection, fields in schema.items():
        if isinstance(fields, dict):
            for field in list(fields.keys()):
                if field in candidate_ids:
                    fields.pop(field, None)

    # Update entities/attributes/decisions if present.
    child_entity = _title_case(_normalize_term(child))
    entities = result.get("entities")
    if isinstance(entities, list):
        result["entities"] = [e for e in entities if e != child_entity]

    attributes = result.get("attributes")
    if isinstance(attributes, dict):
        attributes.pop(child_entity, None)

    decisions = result.get("decisions")
    if isinstance(decisions, dict):
        decisions.pop(child_collection, None)
        if parent_collection in decisions and isinstance(decisions[parent_collection], str):
            decisions[parent_collection] = decisions[parent_collection] + " Guests embedded for locality"

    result["schema"] = schema
    return True


def _apply_force_add_collections_from_refinement(refinement_text: str, result: Dict[str, Any]) -> bool:
    """Add collections when refinement explicitly requests new collections."""
    if not refinement_text or not isinstance(result, dict):
        return False

    schema = result.get("schema")
    if not isinstance(schema, dict):
        return False

    text = refinement_text.lower()
    patterns = [
        r"add\s+collections?\s+(?:named\s+)?(?P<names>[\w\s,]+)",
        r"add\s+collections?\s+for\s+(?P<names>[\w\s,]+)",
        r"add\s+(?P<names>[\w\s,]+?)\s+collections?",
        r"add\s+(?P<names>[\w\s,]+)",
    ]

    names: List[str] = []
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        raw_names = match.group("names")
        if not raw_names:
            continue
        tokens = re.split(r",|\band\b", raw_names)
        for token in tokens:
            cleaned = token.strip()
            if not cleaned or cleaned in {"collection", "collections", "entity", "entities", "table", "tables", "also"}:
                continue
            names.append(cleaned)
        if names:
            break

    if not names:
        return False

    entities = result.get("entities", [])
    attributes = result.get("attributes", {})
    decisions = result.get("decisions", {})

    changed = False
    for name in names:
        collection = _ensure_collection(schema, entities, attributes, name)
        if isinstance(decisions, dict):
            decisions.setdefault(collection, "→ SEPARATE COLLECTION - Requested in refinement")
        changed = True

    result["schema"] = schema
    result["entities"] = entities
    result["attributes"] = attributes
    if isinstance(decisions, dict):
        result["decisions"] = decisions
    return changed


def _is_bad_summary(summary: Any, refinement_text: str, schema_changed: bool) -> bool:
    if not isinstance(summary, str):
        return True
    text = summary.strip()
    if not text:
        return True
    lowered = text.lower()
    if lowered.startswith("applied refinement"):
        return True
    if lowered.startswith("implemented "):
        return True
    if "applied refinement:" in lowered:
        return True
    if len(lowered) < 30:
        return True
    if not schema_changed:
        if not (lowered.startswith("no schema changes") or lowered.startswith("cannot implement")):
            return True
    else:
        if lowered.startswith("no schema changes"):
            return True
    request = (refinement_text or "").strip().lower()
    if request and lowered == request:
        return True
    return False


def _build_refinement_summary(
    refinement_text: str,
    old_schema: Dict[str, Any],
    new_schema: Dict[str, Any],
    old_metrics: Dict[str, int],
    new_metrics: Dict[str, int],
    schema_changed: bool
) -> str:
    if not schema_changed:
        if _is_application_request(refinement_text):
            return (
                "No schema changes made - request requires application code implementation. "
                f"Total fields remain {new_metrics['fields']} and collections remain {new_metrics['collections']}."
            )
        return (
            "No schema changes made - requested changes did not alter schema structure. "
            f"Total fields remain {new_metrics['fields']} and collections remain {new_metrics['collections']}."
        )

    added_collections = sorted(set(new_schema.keys()) - set(old_schema.keys()))
    removed_collections = sorted(set(old_schema.keys()) - set(new_schema.keys()))
    diffs = _diff_schema(old_schema, new_schema)

    summary = (
        "Updated schema: collections "
        f"{old_metrics['collections']} -> {new_metrics['collections']}, "
        f"total fields {old_metrics['fields']} -> {new_metrics['fields']}, "
        f"max depth {old_metrics['depth']} -> {new_metrics['depth']}."
    )

    if added_collections:
        summary += f" Added collections: {', '.join(added_collections)}."
    if removed_collections:
        summary += f" Removed collections: {', '.join(removed_collections)}."
    if diffs["added"]:
        summary += f" Added paths: {', '.join(diffs['added'][:3])}."
    if diffs["removed"]:
        summary += f" Removed paths: {', '.join(diffs['removed'][:3])}."

    return summary


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
    normalized_schema = _normalize_schema(schema)
    version_info = _build_schema_version(base_result)
    result["schema"] = normalized_schema
    result["entities"] = entities
    result["attributes"] = attributes
    result["relationships"] = _normalize_relationships(relationships, decisions)
    result["decisions"] = decisions
    result["indexes"] = _indexes(decisions)
    result["whyNot"] = _why_not(decisions)
    result["confidence"] = _confidence(decisions)
    result["explanations"] = _explanations(decisions)
    warnings = result.get("warnings", [])
    warnings.extend(_warnings(refinement_text, decisions))
    result["warnings"] = list(dict.fromkeys(warnings))
    result["accessPattern"] = workload_type
    result["explanations"]["refinement"] = f"Refinement request: {refinement_text.strip()}"
    result.update(version_info)
    return result
