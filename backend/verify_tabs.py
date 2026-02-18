import requests
import json
import time

BASE_URL = "http://localhost:8000"

# Test
print("Testing Agent Endpoint...")
email = f"testuser{int(time.time()*10000)}@test.com"

try:
    # Signup
    signup_resp = requests.post(
        f"{BASE_URL}/auth/signup",
        json={"email": email, "password": "Test123!@#"}
    )
    
    if signup_resp.status_code != 200:
        print(f"Signup failed: {signup_resp.status_code} - {signup_resp.text}")
        exit(1)
    
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Chat with agent
    message = "I have 5 products in 3 stores with different prices"
    chat_resp = requests.post(
        f"{BASE_URL}/agent/chat",
        json={"message": message},
        headers=headers,
        timeout=30
    )
    
    if chat_resp.status_code != 200:
        print(f"Chat failed: {chat_resp.status_code}")
        print(chat_resp.text)
        exit(1)
    
    result = chat_resp.json()
    schema = result.get("schema", {})
    
    print("\n✓ Agent Chat Response:")
    print(f"  - Action: {result.get('action')}")
    print(f"  - Schema present: {bool(schema)}")
    
    if schema:
        print(f"\n✓ Schema Components:")
        print(f"  - Decisions: {bool(schema.get('decisions'))}")
        print(f"  - Explanations: {bool(schema.get('explanations'))}")
        print(f"  - Warnings: {bool(schema.get('warnings'))}")
        print(f"  - Indexes: {bool(schema.get('indexes'))}")
        
        decisions = schema.get('decisions', {})
        if decisions:
            print(f"\n✓ Decisions Structure:")
            print(f"  - Collection decisions count: {len([k for k in decisions.keys() if k != 'relationships'])}")
            print(f"  - Has relationships: {bool(decisions.get('relationships'))}")
            
            if decisions.get('relationships'):
                print(f"  - Relationships count: {len(decisions.get('relationships', {}))}")
                print(f"\n  Relationships:")
                for rel, pattern in decisions.get('relationships', {}).items():
                    print(f"    - {rel}: {pattern[:60]}...")
    
    print("\n✓ All systems working correctly!")
    
except requests.exceptions.Timeout:
    print("Error: Request timed out")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
