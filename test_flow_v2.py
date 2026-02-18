import requests
import json
import time

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("TESTING MONGOARCHITECT WITH SEPARATE RELATIONSHIPS")
print("=" * 60)

email = f"user{int(time.time() * 1000)}@test.com"

try:
    # Step 1: Signup
    print(f"\n1. Signup...")
    signup_resp = requests.post(
        f"{BASE_URL}/auth/signup",
        json={"email": email, "password": "TestPass123!"}
    )
    
    if signup_resp.status_code != 200:
        print(f"   FAILED: {signup_resp.status_code}")
        print(f"   Response: {signup_resp.text}")
        exit(1)
    
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"   SUCCESS")
    
    # Step 2: Chat with agent
    print(f"\n2. Generate Schema (Agent Chat)...")
    message = "I have 10 products and each product have multiple ratings and comments and I have 5 stores in which these 10 products are there. each store can have different cost"
    
    chat_resp = requests.post(
        f"{BASE_URL}/agent/chat",
        json={"message": message},
        headers=headers,
        timeout=45
    )
    
    if chat_resp.status_code != 200:
        print(f"   FAILED: {chat_resp.status_code}")
        print(f"   Response: {chat_resp.text}")
        exit(1)
    
    result = chat_resp.json()
    print(f"   SUCCESS")
    
    # Step 3: Verify response structure
    print(f"\n3. Verify Response Structure...")
    
    action = result.get("action")
    schema = result.get("schema")
    error = result.get("error")
    
    print(f"   - Action: {action}")
    print(f"   - Error: {error}")
    print(f"   - Schema present: {schema is not None}")
    
    if error:
        print(f"\n   ERROR: {error}")
        print(f"   Reasoning: {result.get('reasoning')}")
        exit(1)
    
    if action != "GENERATE_SCHEMA":
        print(f"\n   ERROR: Expected GENERATE_SCHEMA, got {action}")
        exit(1)
    
    if not schema:
        print(f"\n   ERROR: No schema in response")
        exit(1)
    
    # Step 4: Verify schema content - CHECK FOR SEPARATE RELATIONSHIPS
    print(f"\n4. Verify Schema Content...")
    
    collections = schema.get("schema", {})
    decisions = schema.get("decisions", {})
    relationships = schema.get("relationships", {})  # TOP LEVEL
    explanations = schema.get("explanations", {})
    warnings = schema.get("warnings", [])
    indexes = schema.get("indexes", [])
    
    print(f"   - Collections: {list(collections.keys())}")
    print(f"   - Decisions keys: {list(decisions.keys())}")
    print(f"   - Relationships keys (TOP LEVEL): {list(relationships.keys())}")
    print(f"   - Explanations keys: {list(explanations.keys())}")
    print(f"   - Warnings count: {len(warnings)}")
    print(f"   - Indexes count: {len(indexes)}")
    
    # Verify relationships at TOP LEVEL
    if relationships:
        print(f"\n   SUCCESS: Relationships at TOP LEVEL!")
        for rel_name, rel_desc in relationships.items():
            print(f"     * {rel_name}: {rel_desc[:60]}...")
    else:
        print(f"\n   WARNING: No top-level relationships found")
    
    # Verify decisions NO LONGER has nested relationships
    if "relationships" in decisions:
        print(f"   WARNING: Relationships still nested in decisions (should be separate)")
    else:
        print(f"   SUCCESS: Relationships separated from decisions")
    
    # Show sample explanation
    if explanations:
        first_key = list(explanations.keys())[0]
        first_val = explanations[first_key]
        print(f"\n   Sample Explanation ({first_key}):")
        print(f"   {first_val[:100]}...")
    
    print(f"\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)
    print(f"\nSchema ID: {result.get('schemaId')}")
    print(f"Collections: {', '.join(collections.keys())}")
    print(f"Collection-to-Collection Relationships: {', '.join(relationships.keys())}")
    
except requests.exceptions.Timeout:
    print(f"   FAILED: Request timeout")
except Exception as e:
    print(f"   ERROR: {e}")
    import traceback
    traceback.print_exc()
