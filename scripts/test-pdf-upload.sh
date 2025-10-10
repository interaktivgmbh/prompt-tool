#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# Copyright 2025 Interaktiv GmbH

# Test PDF upload and processing through the API

echo "🧪 Testing PDF Upload and Processing"
echo ""

BASE_URL="http://localhost:3005"
DOMAIN_ID="test-pdf"

# Create a test prompt first
echo "1️⃣ Creating test prompt..."
PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "name": "PDF Test Prompt",
    "description": "Testing PDF processing",
    "prompt": "Process this PDF document"
  }')

PROMPT_ID=$(echo "$PROMPT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created prompt ID: $PROMPT_ID"
echo ""

# Upload the PDF file
echo "2️⃣ Uploading PDF file..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/files" \
  -H "x-domain-id: $DOMAIN_ID" \
  -F "files=@Mathematik_Flyer_Web.pdf")

echo "$UPLOAD_RESPONSE" | jq '.'
FILE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.files[0].id')
echo ""

# Wait for processing
echo "⏳ Waiting for embeddings to be generated..."
sleep 3
echo ""

# Get file content to verify extraction
echo "3️⃣ Getting file content..."
curl -s "$BASE_URL/api/prompts/$PROMPT_ID/files/$FILE_ID/content" \
  -H "x-domain-id: $DOMAIN_ID" | jq '.content' | head -c 500
echo ""
echo ""

# Check embeddings were created
echo "4️⃣ Checking embedding statistics..."
curl -s "$BASE_URL/api/search/stats" \
  -H "x-domain-id: $DOMAIN_ID" | jq '.'
echo ""

# Test similarity search with PDF content
echo "5️⃣ Testing similarity search..."
curl -s -X POST "$BASE_URL/api/search" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "Mathematik Studium",
    "topK": 3
  }' | jq '.'
echo ""

echo "✅ PDF upload and processing test complete!"