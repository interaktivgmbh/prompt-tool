# SPDX-License-Identifier: Apache-2.0
# Copyright 2025 Interaktiv GmbH

# Configuration
KEYCLOAK_URL="https://auth.ai.interaktiv.de"
KEYCLOAK_REALM="kyra"
CLIENT_ID="kyra"
CLIENT_SECRET="JmXDrlQKuWH69iDwUPMT7VnNGpuOrZ1K"

BASE_URL="https://kyra.interaktiv.de/api/tools/prompt-tool"
DOMAIN_ID="test.com"

echo "🧪 Testing Prompt Tool API via Kyra Gateway"
echo ""

# Get access token from Keycloak
echo "🔑 Getting access token from Keycloak..."
TOKEN_RESPONSE=$(curl -s -X POST \
  "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "$TOKEN_RESPONSE" | json_pp
  exit 1
fi

echo "✅ Access token obtained (length: ${#ACCESS_TOKEN})"
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
curl -s "$BASE_URL/health" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | json_pp
echo ""

# Test 2: Create prompt
echo "2️⃣ Creating test prompt..."
PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "name": "Customer Support Bot",
    "description": "Helpful customer support assistant",
    "prompt": "You are a helpful customer support assistant. Be polite and professional.",
    "modelId": "gpt-3.5-turbo"
  }')

echo "$PROMPT_RESPONSE" | json_pp
PROMPT_ID=$(echo "$PROMPT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created prompt ID: $PROMPT_ID"
echo ""

# Wait for indexing
echo "⏳ Waiting for embeddings to be generated..."
sleep 2
echo ""

# Test 3: List prompts
echo "3️⃣ Listing prompts..."
curl -s "$BASE_URL/api/prompts?limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Test 4: Get single prompt
echo "4️⃣ Getting single prompt..."
curl -s "$BASE_URL/api/prompts/$PROMPT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Test 5: Similarity search
echo "5️⃣ Testing similarity search..."
curl -s -X POST "$BASE_URL/api/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "help customers with questions",
    "topK": 3
  }' | json_pp
echo ""

# Test 6: Get stats
echo "6️⃣ Getting embedding statistics..."
curl -s "$BASE_URL/api/search/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Test 7: Update prompt
echo "7️⃣ Updating prompt..."
curl -s -X PATCH "$BASE_URL/api/prompts/$PROMPT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "description": "Updated description"
  }' | json_pp
echo ""

# Test 8: Delete prompt
echo "8️⃣ Deleting prompt..."
curl -s -X DELETE "$BASE_URL/api/prompts/$PROMPT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-domain-id: $DOMAIN_ID"
echo "Deleted"
echo ""

echo "✅ API tests complete!"
