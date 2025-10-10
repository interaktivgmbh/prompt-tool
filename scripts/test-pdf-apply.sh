#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# Copyright 2025 Interaktiv GmbH

# Test PDF content with prompt apply functionality

echo "🧪 Testing Prompt Apply with PDF Content"
echo ""

BASE_URL="http://localhost:3005"
DOMAIN_ID="test-pdf-apply"

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
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/files" \
  -H "x-domain-id: $DOMAIN_ID" \
  -F "files=@Mathematik_Flyer_Web.pdf")

echo "Upload response:"
echo "$UPLOAD_RESPONSE" | jq '.files[0] | {id, filename, mimeType, sizeBytes}'
echo ""

# Wait for embeddings
echo "⏳ Waiting for embeddings to be generated..."
sleep 4
echo ""

# Test apply with context - Question about study duration
echo "3️⃣ Testing apply with context - Question about study duration..."
echo "Query: 'Wie lange dauert das Bachelorstudium Mathematik?'"
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Wie lange dauert das Bachelorstudium Mathematik?",
    "includeContext": true,
    "maxContextChunks": 3,
    "minSimilarity": 0.5
  }')

echo "$APPLY_RESPONSE" | jq '{
  query,
  response: .response | .[0:200] + "...",
  contextUsed: .contextUsed | length,
  contextChunks: .contextUsed | map({
    chunkId,
    source,
    similarityScore,
    textPreview: .text[0:100] + "..."
  })
}'
echo ""

# Test apply with context - Question about career perspectives
echo "4️⃣ Testing apply with context - Question about career perspectives..."
echo "Query: 'Welche Berufsperspektiven gibt es nach dem Mathematikstudium?'"
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Welche Berufsperspektiven gibt es nach dem Mathematikstudium?",
    "includeContext": true,
    "maxContextChunks": 3,
    "minSimilarity": 0.5
  }')

echo "$APPLY_RESPONSE" | jq '{
  query,
  response: .response | .[0:200] + "...",
  contextUsed: .contextUsed | length,
  contextChunks: .contextUsed | map({
    chunkId,
    source,
    similarityScore,
    textPreview: .text[0:100] + "..."
  })
}'
echo ""

# Test apply without context for comparison
echo "5️⃣ Testing apply WITHOUT context (for comparison)..."
echo "Query: 'Welche Programmiersprachen werden im Studium gelehrt?'"
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Welche Programmiersprachen werden im Studium gelehrt?",
    "includeContext": false
  }')

echo "$APPLY_RESPONSE" | jq '{
  query,
  response: .response | .[0:200] + "...",
  contextUsed: .contextUsed | length
}'
echo ""

# Test with a query that should retrieve specific PDF chunks
echo "6️⃣ Testing specific content retrieval..."
echo "Query: 'Was sind die Inhalte der Vorlesung Analysis I?'"
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/apply" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Was sind die Inhalte der Vorlesung Analysis I?",
    "includeContext": true,
    "maxContextChunks": 5,
    "minSimilarity": 0.4
  }')

echo "$APPLY_RESPONSE" | jq '{
  query,
  response: .response | .[0:300] + "...",
  contextUsed: .contextUsed | length,
  model,
  tokenUsage,
  executionTimeMs,
  topContext: .contextUsed[0] | {
    similarityScore,
    textPreview: .text[0:200] + "..."
  }
}'
echo ""

echo "✅ Prompt apply with PDF content test complete!"