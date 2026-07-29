#!/bin/bash

echo "=== NeoPass API Test Script ==="
echo ""

# Health check
echo "1. Testing health check..."
curl -s http://localhost:8787/ | jq .
echo ""

# Login
echo "2. Logging in as testuser..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}')

echo "$LOGIN_RESPONSE" | jq .
echo ""

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token received"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:50}..."
echo ""

# Account info
echo "3. Fetching account info..."
curl -s http://localhost:8787/api/account \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# AI models list
echo "4. Listing available AI models..."
curl -s http://localhost:8787/api/ai/models | jq .
echo ""

# AI solve endpoint (note: this may fail locally as AI uses remote)
echo "5. Testing AI solve endpoint (MCQ)..."
curl -s -X POST http://localhost:8787/api/ai/solve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2 + 2? A) 3 B) 4 C) 5 D) 6", "type": "mcq"}' | jq .
echo ""

# AI chat endpoint
echo "6. Testing AI chat endpoint..."
curl -s -X POST http://localhost:8787/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello, can you help me with a quick math question?"}]}' | jq .
echo ""

echo "=== Test Complete ==="
