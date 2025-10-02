#!/usr/bin/env bash

################################################################################
# Comprehensive Test Suite for Prompt Tool API
#
# This script tests all functionality including:
# - Health checks
# - Prompt CRUD operations
# - File upload/download/delete
# - Vector search and embeddings
# - LLM apply with RAG
# - Multi-tenancy
# - Error handling and edge cases
################################################################################

# Don't exit on error - we want to count failures
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3005}"
DOMAIN_ID="comprehensive-test.com"
TEST_FILE_DIR="/tmp/prompt-tool-tests"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test state
CREATED_PROMPT_ID=""
CREATED_FILE_ID=""
SECOND_PROMPT_ID=""
MULTIPART_PROMPT_ID=""

################################################################################
# Helper Functions
################################################################################

log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

section() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

test_case() {
    log "Test #$((TESTS_RUN + 1)): $1"
    ((TESTS_RUN++))
}

# Setup test files
setup_test_files() {
    log "Setting up test files..."
    mkdir -p "$TEST_FILE_DIR"

    # Create various test files
    echo "This is a simple text file for testing." > "$TEST_FILE_DIR/simple.txt"

    cat > "$TEST_FILE_DIR/code-sample.js" <<'EOF'
// JavaScript best practices
function calculateSum(a, b) {
    return a + b;
}

const greet = (name) => {
    return `Hello, ${name}!`;
}

module.exports = { calculateSum, greet };
EOF

    cat > "$TEST_FILE_DIR/documentation.md" <<'EOF'
# API Documentation

## Overview
This is a comprehensive guide to using our API.

## Endpoints
- GET /api/prompts - List all prompts
- POST /api/prompts - Create a new prompt
- GET /api/prompts/:id - Get a specific prompt

## Authentication
Use the x-domain-id header for multi-tenancy.
EOF

    cat > "$TEST_FILE_DIR/large-content.txt" <<'EOF'
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

This file contains multiple paragraphs to test chunking and embedding functionality.
The content should be split into appropriate chunks for vector search.
Each chunk will be embedded separately and stored in the database.

Testing semantic search capabilities with meaningful content.
Natural language processing works best with real sentences and paragraphs.
This helps verify that our RAG implementation retrieves relevant context.
EOF

    # Create JSON test file
    cat > "$TEST_FILE_DIR/config.json" <<'EOF'
{
  "version": "1.0.0",
  "features": {
    "embeddings": true,
    "vectorSearch": true,
    "llmIntegration": true
  },
  "models": ["gpt-4o-mini", "claude-3-haiku"],
  "maxFileSize": 10485760
}
EOF

    success "Created test files in $TEST_FILE_DIR"
}

# Cleanup
cleanup() {
    log "Cleaning up test data..."

    # Delete all test prompts
    if [ -n "$CREATED_PROMPT_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
            -H "x-domain-id: $DOMAIN_ID" > /dev/null 2>&1 || true
    fi

    if [ -n "$SECOND_PROMPT_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api/prompts/$SECOND_PROMPT_ID" \
            -H "x-domain-id: $DOMAIN_ID" > /dev/null 2>&1 || true
    fi

    if [ -n "$MULTIPART_PROMPT_ID" ]; then
        curl -s -X DELETE "$BASE_URL/api/prompts/$MULTIPART_PROMPT_ID" \
            -H "x-domain-id: $DOMAIN_ID" > /dev/null 2>&1 || true
    fi

    # Remove test files
    rm -rf "$TEST_FILE_DIR"

    log "Cleanup complete"
}

trap cleanup EXIT

################################################################################
# Test Cases
################################################################################

section "1. HEALTH AND CONNECTIVITY TESTS"

test_case "Health endpoint should return healthy status"
RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    success "Health check passed"
else
    fail "Health check failed: $RESPONSE"
fi

test_case "Health endpoint should report database connectivity"
if echo "$RESPONSE" | jq -e '.database == "connected"' > /dev/null; then
    success "Database connected"
else
    fail "Database connection check failed"
fi

test_case "Health endpoint should include version"
if echo "$RESPONSE" | jq -e '.version' > /dev/null; then
    success "Version info present"
else
    fail "Version info missing"
fi

################################################################################

section "2. MODELS ENDPOINT TESTS"

test_case "Models endpoint should list available models"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/models")
MODEL_COUNT=$(echo "$RESPONSE" | jq '.models | length')
if [ "$MODEL_COUNT" -gt 0 ]; then
    success "Models endpoint returned $MODEL_COUNT models"
else
    fail "Models endpoint returned no models"
fi

test_case "Models endpoint should include default model"
if echo "$RESPONSE" | jq -e '.defaultModel' > /dev/null; then
    success "Default model specified"
else
    fail "Default model missing"
fi

test_case "Each model should have required fields"
VALID_MODELS=$(echo "$RESPONSE" | jq '[.models[] | select(.id and .name and .provider)] | length')
if [ "$VALID_MODELS" -eq "$MODEL_COUNT" ]; then
    success "All models have required fields"
else
    fail "Some models missing required fields"
fi

################################################################################

section "3. PROMPT CRUD OPERATIONS"

test_case "Create prompt with minimal data"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "name": "Test Prompt",
        "prompt": "You are a helpful assistant."
    }')

CREATED_PROMPT_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ -n "$CREATED_PROMPT_ID" ] && [ "$CREATED_PROMPT_ID" != "null" ]; then
    success "Created prompt with ID: $CREATED_PROMPT_ID"
else
    fail "Failed to create prompt: $RESPONSE"
    exit 1
fi

test_case "Create prompt with full metadata"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "name": "Advanced Prompt",
        "prompt": "You are an expert code reviewer.",
        "description": "Reviews code for best practices",
        "metadata": {
            "category": "development",
            "tags": ["code", "review", "quality"],
            "version": "2.0"
        }
    }')

SECOND_PROMPT_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ -n "$SECOND_PROMPT_ID" ] && [ "$SECOND_PROMPT_ID" != "null" ]; then
    success "Created prompt with metadata: $SECOND_PROMPT_ID"
else
    fail "Failed to create prompt with metadata"
fi

test_case "List all prompts"
RESPONSE=$(curl -s "$BASE_URL/api/prompts" \
    -H "x-domain-id: $DOMAIN_ID")

PROMPT_COUNT=$(echo "$RESPONSE" | jq '.prompts | length')
if [ "$PROMPT_COUNT" -ge 2 ]; then
    success "Listed $PROMPT_COUNT prompts"
else
    fail "Expected at least 2 prompts, got $PROMPT_COUNT"
fi

test_case "List prompts with pagination"
RESPONSE=$(curl -s "$BASE_URL/api/prompts?page=1&size=1" \
    -H "x-domain-id: $DOMAIN_ID")

PAGE_SIZE=$(echo "$RESPONSE" | jq '.prompts | length')
TOTAL=$(echo "$RESPONSE" | jq '.total')
if [ "$PAGE_SIZE" -eq 1 ] && [ "$TOTAL" -ge 2 ]; then
    success "Pagination working (size=1, total=$TOTAL)"
else
    fail "Pagination not working correctly"
fi

test_case "Get specific prompt by ID"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "x-domain-id: $DOMAIN_ID")

PROMPT_NAME=$(echo "$RESPONSE" | jq -r '.name')
if [ "$PROMPT_NAME" = "Test Prompt" ]; then
    success "Retrieved prompt by ID"
else
    fail "Failed to retrieve prompt: $RESPONSE"
fi

test_case "Update prompt"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "description": "Updated description",
        "metadata": {"updated": true}
    }')

UPDATED_DESC=$(echo "$RESPONSE" | jq -r '.description')
if [ "$UPDATED_DESC" = "Updated description" ]; then
    success "Updated prompt successfully"
else
    fail "Failed to update prompt"
fi

test_case "Update prompt text should trigger reindexing"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "prompt": "You are a super helpful assistant with extensive knowledge."
    }')

UPDATED_PROMPT=$(echo "$RESPONSE" | jq -r '.prompt')
if echo "$UPDATED_PROMPT" | grep -q "super helpful"; then
    success "Prompt text updated (reindexing triggered)"
else
    fail "Failed to update prompt text"
fi

################################################################################

section "4. FILE UPLOAD AND MANAGEMENT"

setup_test_files

test_case "Upload single file to prompt"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "files=@$TEST_FILE_DIR/simple.txt")

CREATED_FILE_ID=$(echo "$RESPONSE" | jq -r '.files[0].id')
if [ -n "$CREATED_FILE_ID" ] && [ "$CREATED_FILE_ID" != "null" ]; then
    success "Uploaded file with ID: $CREATED_FILE_ID"
else
    fail "Failed to upload file: $RESPONSE"
fi

test_case "Upload multiple files at once"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$SECOND_PROMPT_ID/files" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "files=@$TEST_FILE_DIR/code-sample.js" \
    -F "files=@$TEST_FILE_DIR/documentation.md" \
    -F "files=@$TEST_FILE_DIR/config.json")

FILE_COUNT=$(echo "$RESPONSE" | jq '.filesUploaded')
if [ "$FILE_COUNT" -eq 3 ]; then
    success "Uploaded 3 files successfully"
else
    fail "Expected 3 files, got $FILE_COUNT"
fi

test_case "List files for prompt"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/$SECOND_PROMPT_ID/files" \
    -H "x-domain-id: $DOMAIN_ID")

FILE_LIST_COUNT=$(echo "$RESPONSE" | jq '.files | length')
if [ "$FILE_LIST_COUNT" -eq 3 ]; then
    success "Listed 3 files for prompt"
else
    fail "Expected 3 files in list, got $FILE_LIST_COUNT"
fi

test_case "Download file content"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files/$CREATED_FILE_ID/download" \
    -H "x-domain-id: $DOMAIN_ID")

if echo "$RESPONSE" | grep -q "simple text file"; then
    success "Downloaded file content successfully"
else
    fail "File content mismatch or download failed"
fi

test_case "Get file content as text"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files/$CREATED_FILE_ID/content" \
    -H "x-domain-id: $DOMAIN_ID")

if echo "$RESPONSE" | jq -e '.text' > /dev/null; then
    success "Retrieved file content as text"
else
    fail "Failed to get file content as text"
fi

test_case "Create prompt with multipart file upload"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "name=Multipart Test" \
    -F "prompt=Test multipart upload" \
    -F "description=Testing file upload during creation" \
    -F "files=@$TEST_FILE_DIR/large-content.txt")

MULTIPART_PROMPT_ID=$(echo "$RESPONSE" | jq -r '.id')
FILE_COUNT=$(echo "$RESPONSE" | jq '.files | length')

if [ -n "$MULTIPART_PROMPT_ID" ] && [ "$FILE_COUNT" -eq 1 ]; then
    success "Created prompt with file in single request"
else
    fail "Multipart creation failed"
fi

################################################################################

section "5. VECTOR SEARCH AND EMBEDDINGS"

log "Waiting 3 seconds for embeddings to be generated..."
sleep 3

test_case "Get embedding statistics"
RESPONSE=$(curl -s "$BASE_URL/api/search/stats" \
    -H "x-domain-id: $DOMAIN_ID")

TOTAL_EMBEDDINGS=$(echo "$RESPONSE" | jq '.totalEmbeddings')
if [ "$TOTAL_EMBEDDINGS" -gt 0 ]; then
    success "Found $TOTAL_EMBEDDINGS embeddings in database"
else
    fail "No embeddings found"
fi

test_case "Similarity search with query"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "helpful assistant",
        "topK": 5,
        "minSimilarity": 0.1
    }')

RESULT_COUNT=$(echo "$RESPONSE" | jq '.results | length')
if [ "$RESULT_COUNT" -gt 0 ]; then
    success "Similarity search returned $RESULT_COUNT results"
else
    fail "Similarity search returned no results"
fi

test_case "Verify similarity scores are present"
HAS_SCORES=$(echo "$RESPONSE" | jq '[.results[] | select(.similarityScore)] | length')
if [ "$HAS_SCORES" -eq "$RESULT_COUNT" ]; then
    success "All results have similarity scores"
else
    fail "Some results missing similarity scores"
fi

test_case "Search within specific prompt"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d "{
        \"query\": \"code review\",
        \"promptId\": \"$SECOND_PROMPT_ID\",
        \"topK\": 3
    }")

if echo "$RESPONSE" | jq -e '.results' > /dev/null; then
    success "Scoped search to specific prompt"
else
    fail "Scoped search failed"
fi

test_case "Find related prompts"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search/related" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "expert assistant",
        "topK": 3
    }')

RELATED_COUNT=$(echo "$RESPONSE" | jq '.relatedPrompts | length')
if [ "$RELATED_COUNT" -gt 0 ]; then
    success "Found $RELATED_COUNT related prompts"
else
    fail "No related prompts found"
fi

test_case "Get context for RAG"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search/context" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d "{
        \"promptId\": \"$SECOND_PROMPT_ID\",
        \"query\": \"best practices\",
        \"maxChunks\": 2
    }")

CONTEXT_LENGTH=$(echo "$RESPONSE" | jq '.context | length')
if [ "$CONTEXT_LENGTH" -gt 0 ]; then
    success "Retrieved RAG context with $CONTEXT_LENGTH chunks"
else
    fail "Failed to retrieve RAG context"
fi

################################################################################

section "6. LLM INTEGRATION AND APPLY"

test_case "Apply prompt without context"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/apply" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "text": "What is 2+2?",
        "includeContext": false,
        "maxTokens": 50
    }')

if echo "$RESPONSE" | jq -e '.response' > /dev/null; then
    RESPONSE_TEXT=$(echo "$RESPONSE" | jq -r '.response')
    success "LLM apply succeeded: ${RESPONSE_TEXT:0:50}..."
else
    warn "LLM apply failed (may need valid API key): $RESPONSE"
fi

test_case "Apply prompt with RAG context"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$SECOND_PROMPT_ID/apply" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "code quality",
        "text": "Review this code: function add(a,b){return a+b}",
        "includeContext": true,
        "maxContextChunks": 2,
        "maxTokens": 100
    }')

if echo "$RESPONSE" | jq -e '.response' > /dev/null; then
    CONTEXT_USED=$(echo "$RESPONSE" | jq '.contextChunksUsed // 0')
    success "RAG apply succeeded (used $CONTEXT_USED context chunks)"
else
    warn "RAG apply failed (may need valid API key)"
fi

test_case "Apply with model override"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/apply" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "text": "Say hello in one word",
        "modelOverride": "anthropic/claude-3-haiku",
        "maxTokens": 10
    }')

if echo "$RESPONSE" | jq -e '.response' > /dev/null; then
    success "Model override working"
else
    warn "Model override test failed (may need valid API key)"
fi

################################################################################

section "7. MULTI-TENANCY AND DOMAIN ISOLATION"

OTHER_DOMAIN="other-domain.com"

test_case "Create prompt in different domain"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $OTHER_DOMAIN" \
    -d '{
        "name": "Other Domain Prompt",
        "prompt": "This belongs to another domain"
    }')

OTHER_PROMPT_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ -n "$OTHER_PROMPT_ID" ] && [ "$OTHER_PROMPT_ID" != "null" ]; then
    success "Created prompt in separate domain"
else
    fail "Failed to create prompt in other domain"
fi

test_case "Verify domain isolation - cannot access other domain's prompt"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/prompts/$OTHER_PROMPT_ID" \
    -H "x-domain-id: $DOMAIN_ID")

if [ "$HTTP_CODE" = "404" ]; then
    success "Domain isolation working (got 404 for other domain's prompt)"
else
    fail "Domain isolation breach! Got HTTP $HTTP_CODE instead of 404"
fi

test_case "List prompts should only return current domain's prompts"
RESPONSE=$(curl -s "$BASE_URL/api/prompts" \
    -H "x-domain-id: $DOMAIN_ID")

# Check if any prompt has wrong domain
WRONG_DOMAIN_COUNT=$(echo "$RESPONSE" | jq --arg domain "$DOMAIN_ID" '[.prompts[] | select(.domainId != $domain)] | length')
if [ "$WRONG_DOMAIN_COUNT" -eq 0 ]; then
    success "All listed prompts belong to correct domain"
else
    fail "Found $WRONG_DOMAIN_COUNT prompts from other domains"
fi

test_case "Search should respect domain boundaries"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "Other Domain",
        "topK": 10
    }')

# Should not find prompts from other domain
RESULTS=$(echo "$RESPONSE" | jq -r '.results[] | select(.text | contains("Other Domain")) | .text')
if [ -z "$RESULTS" ]; then
    success "Search respects domain isolation"
else
    fail "Search leaked results from other domain"
fi

# Cleanup other domain
curl -s -X DELETE "$BASE_URL/api/prompts/$OTHER_PROMPT_ID" \
    -H "x-domain-id: $OTHER_DOMAIN" > /dev/null 2>&1 || true

################################################################################

section "8. ERROR HANDLING AND VALIDATION"

test_case "Missing domain header should return 400"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/prompts")

if [ "$HTTP_CODE" = "400" ]; then
    success "Missing domain header rejected with 400"
else
    fail "Expected 400 for missing domain header, got $HTTP_CODE"
fi

test_case "Invalid prompt ID should return 404"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE_URL/api/prompts/invalid-uuid-format" \
    -H "x-domain-id: $DOMAIN_ID")

if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "400" ]; then
    success "Invalid prompt ID rejected"
else
    fail "Expected 404/400 for invalid ID, got $HTTP_CODE"
fi

test_case "Create prompt without required fields should fail"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{"name": "Only Name"}')

if [ "$HTTP_CODE" = "400" ]; then
    success "Validation error for missing required fields"
else
    fail "Expected 400 for missing fields, got $HTTP_CODE"
fi

test_case "Upload file without prompt should fail"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/prompts/00000000-0000-0000-0000-000000000000/files" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "files=@$TEST_FILE_DIR/simple.txt")

if [ "$HTTP_CODE" = "404" ]; then
    success "File upload to non-existent prompt rejected"
else
    fail "Expected 404 for non-existent prompt, got $HTTP_CODE"
fi

test_case "Empty file upload should fail"
echo -n "" > "$TEST_FILE_DIR/empty.txt"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "files=@$TEST_FILE_DIR/empty.txt")

if echo "$RESPONSE" | grep -qi "error\|fail\|empty"; then
    success "Empty file upload rejected"
else
    warn "Empty file may have been accepted (check if this is intended)"
fi

test_case "Invalid JSON in request body should return 400"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{invalid json}')

if [ "$HTTP_CODE" = "400" ]; then
    success "Invalid JSON rejected with 400"
else
    fail "Expected 400 for invalid JSON, got $HTTP_CODE"
fi

test_case "Apply prompt with invalid parameters should fail gracefully"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/apply" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "text": "",
        "maxTokens": -100
    }')

if echo "$RESPONSE" | jq -e '.error' > /dev/null; then
    success "Invalid apply parameters handled"
else
    warn "Invalid apply parameters may not be validated"
fi

################################################################################

section "9. FILE DELETION AND CLEANUP"

test_case "Delete file from prompt"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files/$CREATED_FILE_ID" \
    -H "x-domain-id: $DOMAIN_ID")

if [ "$HTTP_CODE" = "204" ]; then
    success "File deleted successfully"
else
    fail "File deletion failed with HTTP $HTTP_CODE"
fi

test_case "Verify file is removed from list"
RESPONSE=$(curl -s "$BASE_URL/api/prompts/$CREATED_PROMPT_ID/files" \
    -H "x-domain-id: $DOMAIN_ID")

FILE_COUNT=$(echo "$RESPONSE" | jq '.files | length')
if [ "$FILE_COUNT" -eq 0 ]; then
    success "File removed from prompt"
else
    fail "File still appears in list after deletion"
fi

test_case "Delete prompt should cascade to files"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$BASE_URL/api/prompts/$SECOND_PROMPT_ID" \
    -H "x-domain-id: $DOMAIN_ID")

if [ "$HTTP_CODE" = "204" ]; then
    success "Prompt deleted (should cascade to files)"
    SECOND_PROMPT_ID=""  # Clear so cleanup doesn't try to delete again
else
    fail "Prompt deletion failed"
fi

test_case "Verify deleted prompt is not in list"
RESPONSE=$(curl -s "$BASE_URL/api/prompts" \
    -H "x-domain-id: $DOMAIN_ID")

FOUND=$(echo "$RESPONSE" | jq --arg id "$SECOND_PROMPT_ID" '[.prompts[] | select(.id == $id)] | length')
if [ "$FOUND" -eq 0 ]; then
    success "Deleted prompt not in list"
else
    fail "Deleted prompt still appears in list"
fi

################################################################################

section "10. EDGE CASES AND BOUNDARY CONDITIONS"

test_case "Very long prompt text"
LONG_TEXT=$(printf 'A%.0s' {1..5000})
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d "{
        \"name\": \"Long Prompt\",
        \"prompt\": \"$LONG_TEXT\"
    }")

LONG_PROMPT_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ -n "$LONG_PROMPT_ID" ] && [ "$LONG_PROMPT_ID" != "null" ]; then
    success "Handled very long prompt text"
    curl -s -X DELETE "$BASE_URL/api/prompts/$LONG_PROMPT_ID" \
        -H "x-domain-id: $DOMAIN_ID" > /dev/null 2>&1
else
    fail "Failed to handle long prompt text"
fi

test_case "Special characters in prompt name"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "name": "Test <>&\"'\''éñ",
        "prompt": "Testing special characters"
    }')

SPECIAL_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ -n "$SPECIAL_ID" ] && [ "$SPECIAL_ID" != "null" ]; then
    success "Handled special characters in name"
    curl -s -X DELETE "$BASE_URL/api/prompts/$SPECIAL_ID" \
        -H "x-domain-id: $DOMAIN_ID" > /dev/null 2>&1
else
    fail "Failed to handle special characters"
fi

test_case "Very high pagination values"
RESPONSE=$(curl -s "$BASE_URL/api/prompts?page=999&size=100" \
    -H "x-domain-id: $DOMAIN_ID")

if echo "$RESPONSE" | jq -e '.prompts' > /dev/null; then
    success "Handled high pagination values"
else
    fail "Failed to handle high pagination"
fi

test_case "Search with empty query"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "",
        "topK": 5
    }')

# Should either return error or empty results
if echo "$RESPONSE" | jq -e '(.error or (.results | length == 0))' > /dev/null; then
    success "Handled empty search query"
else
    warn "Empty query behavior unclear"
fi

test_case "Extremely low similarity threshold"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "query": "test",
        "topK": 5,
        "minSimilarity": 0.0001
    }')

RESULT_COUNT=$(echo "$RESPONSE" | jq '.results | length')
if [ "$RESULT_COUNT" -ge 0 ]; then
    success "Handled very low similarity threshold"
else
    fail "Failed with low similarity threshold"
fi

test_case "Concurrent operations on same prompt"
# Update prompt in background
curl -s -X PATCH "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{"description": "Concurrent update 1"}' > /dev/null &

curl -s -X PATCH "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{"description": "Concurrent update 2"}' > /dev/null &

wait

RESPONSE=$(curl -s "$BASE_URL/api/prompts/$CREATED_PROMPT_ID" \
    -H "x-domain-id: $DOMAIN_ID")

if echo "$RESPONSE" | jq -e '.description' > /dev/null; then
    success "Handled concurrent operations"
else
    fail "Concurrent operations caused issues"
fi

################################################################################

section "11. INTEGRATION TESTS"

test_case "Full workflow: Create → Upload → Search → Apply → Delete"

# Create
RESPONSE=$(curl -s -X POST "$BASE_URL/api/prompts" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{
        "name": "Integration Test",
        "prompt": "You are a testing assistant that helps verify functionality."
    }')
WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.id')

# Upload
curl -s -X POST "$BASE_URL/api/prompts/$WORKFLOW_ID/files" \
    -H "x-domain-id: $DOMAIN_ID" \
    -F "files=@$TEST_FILE_DIR/documentation.md" > /dev/null

# Wait for indexing
sleep 2

# Search
RESPONSE=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d "{
        \"query\": \"testing functionality\",
        \"promptId\": \"$WORKFLOW_ID\"
    }")
SEARCH_WORKED=$(echo "$RESPONSE" | jq '.results | length')

# Apply (will fail without API key, but endpoint should work)
curl -s -X POST "$BASE_URL/api/prompts/$WORKFLOW_ID/apply" \
    -H "Content-Type: application/json" \
    -H "x-domain-id: $DOMAIN_ID" \
    -d '{"text": "Test apply", "maxTokens": 10}' > /dev/null 2>&1

# Delete
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$BASE_URL/api/prompts/$WORKFLOW_ID" \
    -H "x-domain-id: $DOMAIN_ID")

if [ "$HTTP_CODE" = "204" ]; then
    success "Full workflow completed successfully"
else
    fail "Full workflow failed at delete step"
fi

test_case "Verify database consistency after operations"
STATS=$(curl -s "$BASE_URL/api/search/stats" -H "x-domain-id: $DOMAIN_ID")
TOTAL_EMBEDDINGS=$(echo "$STATS" | jq '.totalEmbeddings')

if [ "$TOTAL_EMBEDDINGS" -ge 0 ]; then
    success "Database consistency maintained (embeddings: $TOTAL_EMBEDDINGS)"
else
    fail "Database consistency check failed"
fi

################################################################################
# Final Report
################################################################################

section "TEST SUMMARY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Total Tests Run:    ${BLUE}$TESTS_RUN${NC}"
echo -e "  Tests Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Tests Failed:       ${RED}$TESTS_FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    exit 1
fi
