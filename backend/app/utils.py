from __future__ import annotations

from typing import Any, Dict, Iterable, List

from bson import ObjectId


def to_object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


def serialize_doc(doc: Dict[str, Any] | None) -> Dict[str, Any] | None:
    if not doc:
        return doc
    doc["_id"] = str(doc["_id"])
    return doc


def serialize_docs(docs: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [serialize_doc(doc) for doc in docs]
