#!/bin/bash

BASE_URL="http://localhost:3005"
DOMAIN_ID="test.com"

echo "🧪 Testing File Operations with NextCloud"
echo ""

# Create a test file
TEST_FILE="/tmp/test-document.txt"
cat > "$TEST_FILE" <<EOF
This is a test document for the prompt tool.

It contains multiple paragraphs of text that should be
processed and indexed by the embedding service.

The file upload should:
1. Upload to NextCloud via WebDAV
2. Extract text content
3. Generate embeddings
4. Make it searchable

This helps verify the complete file processing pipeline.
EOF

echo "1️⃣ Created test file: $TEST_FILE"
echo ""

# Create a prompt
echo "2️⃣ Creating prompt..."
PROMPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "name": "Test Prompt with File",
    "description": "Testing file upload and processing",
    "prompt": "You are a helpful assistant.",
    "modelId": "gpt-3.5-turbo"
  }')

echo "$PROMPT_RESPONSE" | json_pp
PROMPT_ID=$(echo "$PROMPT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created prompt ID: $PROMPT_ID"
echo ""

# Upload file to prompt
echo "3️⃣ Uploading file to prompt..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$PROMPT_ID/files" \
  -H "x-domain-id: $DOMAIN_ID" \
  -F "files=@$TEST_FILE")

echo "$UPLOAD_RESPONSE" | json_pp
FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Uploaded file ID: $FILE_ID"
echo ""

# Wait for indexing
echo "⏳ Waiting for embeddings to be generated..."
sleep 3
echo ""

# List files
echo "4️⃣ Listing files for prompt..."
curl -s "$BASE_URL/api/prompts/$PROMPT_ID/files" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Get file content as text
echo "5️⃣ Getting file content..."
curl -s "$BASE_URL/api/prompts/$PROMPT_ID/files/$FILE_ID/content" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Search for content from the file
echo "6️⃣ Searching for file content..."
curl -s -X POST "$BASE_URL/api/search" \
  -H "Content-Type: application/json" \
  -H "x-domain-id: $DOMAIN_ID" \
  -d '{
    "query": "file upload processing pipeline",
    "topK": 5
  }' | json_pp
echo ""

# Get embedding stats
echo "7️⃣ Getting embedding statistics..."
curl -s "$BASE_URL/api/search/stats" \
  -H "x-domain-id: $DOMAIN_ID" | json_pp
echo ""

# Download file
echo "8️⃣ Downloading file..."
curl -s "$BASE_URL/api/prompts/$PROMPT_ID/files/$FILE_ID/download" \
  -H "x-domain-id: $DOMAIN_ID" \
  -o "/tmp/downloaded-file.txt"
echo "Downloaded to /tmp/downloaded-file.txt"
echo "File content:"
cat "/tmp/downloaded-file.txt"
echo ""
echo ""

# Delete file
echo "9️⃣ Deleting file..."
curl -s -X DELETE "$BASE_URL/api/prompts/$PROMPT_ID/files/$FILE_ID" \
  -H "x-domain-id: $DOMAIN_ID"
echo "File deleted"
echo ""

# Cleanup prompt
echo "🧹 Cleaning up..."
curl -s -X DELETE "$BASE_URL/api/prompts/$PROMPT_ID" \
  -H "x-domain-id: $DOMAIN_ID"
echo "Prompt deleted"
rm -f "$TEST_FILE" "/tmp/downloaded-file.txt"
echo ""

echo "✅ File operations test complete!"
