#!/bin/bash

# Run Pipeline Test Script
# This script executes the end-to-end test for the AI pipeline

# Set environment variables for testing
export NODE_ENV=development

# Check if .env file exists and source it
if [ -f "../.env" ]; then
  echo "Loading environment variables from ../.env"
  export $(grep -v '^#' ../.env | xargs)
fi

# Check for required environment variables
if [ -z "$AZURE_OPENAI_API_KEY" ]; then
  echo "❌ Error: AZURE_OPENAI_API_KEY is not set"
  exit 1
fi

if [ -z "$PINECONE_API_KEY" ] || [ -z "$PINECONE_ENVIRONMENT" ]; then
  echo "❌ Error: PINECONE_API_KEY or PINECONE_ENVIRONMENT is not set"
  exit 1
fi

echo "🚀 Running AI Pipeline E2E Test"
echo "Using Azure OpenAI deployment: $AZURE_OPENAI_DEPLOYMENT_EMBEDDING for embeddings"
echo "Using Azure OpenAI deployment: $AZURE_OPENAI_DEPLOYMENT_TURBO for completions"

# Run the test script using ts-node
cd ..
npx ts-node --project tsconfig.json ./test-files/test-pipeline.ts

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Test completed successfully"
else
  echo "❌ Test failed"
  exit 1
fi
