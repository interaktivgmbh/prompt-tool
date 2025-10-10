#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# Copyright 2025 Interaktiv GmbH

# Test PDF content with prompt apply functionality

echo "🧪 Testing Prompt Apply with PDF Content"
echo ""

BASE_URL="http://localhost:3005"
DOMAIN_ID="test-pdf-apply-2"

# Create a test prompt
echo "1️⃣ Creating test prompt with instruction..."
PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "name": "Math Study Assistant",
    "description": "Assistant for mathematics study program questions",
    "prompt": "You are a helpful assistant for students interested in mathematics studies. Answer questions based on the provided program information."
  }')

PROMPT_ID=$(echo "$PROMPT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created prompt ID: $PROMPT_ID"
echo ""

# Upload the PDF file
echo "2️⃣ Uploading Mathematics PDF..."
curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/files" \
  -H "x-domain-id: $DOMAIN_ID" \
  -F "files=@Mathematik_Flyer_Web.pdf" > /dev/null

echo "PDF uploaded successfully"
echo ""

# Wait for embeddings
echo "⏳ Waiting for embeddings to be generated..."
sleep 4
echo ""

# Test apply with context - Question about study duration
echo "3️⃣ Testing apply with context enabled..."
echo "Query: 'Wie lange dauert das Bachelorstudium Mathematik?'"
echo ""
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Wie lange dauert das Bachelorstudium Mathematik?",
    "includeContext": true,
    "maxContextChunks": 3,
    "minSimilarity": 0.5
  }')

# Save to file for better analysis
echo "$APPLY_RESPONSE" > /tmp/apply_response.json

# Display key information
echo "Response Summary:"
echo "================="
echo "Context chunks used: $(echo "$APPLY_RESPONSE" | jq '.contextUsed | length')"
echo "Model: $(echo "$APPLY_RESPONSE" | jq -r '.model')"
echo "Total tokens: $(echo "$APPLY_RESPONSE" | jq '.tokenUsage.totalTokens')"
echo ""

echo "Retrieved Context Chunks:"
echo "========================"
echo "$APPLY_RESPONSE" | jq -r '.contextUsed[] | "Chunk: \(.chunkId)\nScore: \(.similarityScore)\nSource: \(.source)\n---"'
echo ""

echo "LLM Response:"
echo "============"
echo "$APPLY_RESPONSE" | jq -r '.response' | head -20
echo ""

# Test with another query
echo "4️⃣ Testing with career-related query..."
echo "Query: 'Welche Berufsperspektiven gibt es?'"
echo ""
APPLY_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Welche Berufsperspektiven gibt es nach dem Mathematikstudium?",
    "includeContext": true,
    "maxContextChunks": 3,
    "minSimilarity": 0.5
  }')

echo "Context chunks used: $(echo "$APPLY_RESPONSE2" | jq '.contextUsed | length')"
echo ""
echo "Top matching chunk:"
echo "$APPLY_RESPONSE2" | jq -r '.contextUsed[0] | "Score: \(.similarityScore)\nText preview: \(.text | .[0:200])"'
echo ""

echo "✅ Test complete! Full response saved to /tmp/apply_response.json"