#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}🚀 CONTEXTO REAL PIPELINE TEST RUNNER${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check for .env file
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}✅ Found .env file, loading environment variables${NC}"
  export $(grep -v '^#' $ENV_FILE | xargs)
else
  echo -e "${YELLOW}⚠️ No .env file found, using existing environment variables${NC}"
fi

# Check for required environment variables
REQUIRED_VARS=(
  "AZURE_OPENAI_API_KEY"
  "AZURE_OPENAI_ENDPOINT"
  "AZURE_OPENAI_DEPLOYMENT_EMBEDDING"
  "AZURE_OPENAI_DEPLOYMENT_TURBO"
  "PINECONE_API_KEY"
  "PINECONE_ENVIRONMENT"
)

MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo -e "${RED}❌ Missing required environment variables:${NC}"
  for VAR in "${MISSING_VARS[@]}"; do
    echo -e "${RED}   - $VAR${NC}"
  done
  echo -e "${YELLOW}Please set these variables in .env file or export them before running this script${NC}"
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo -e "${YELLOW}Starting real pipeline test with production APIs...${NC}"

# Run the test using ts-node
npx ts-node real-pipeline-test.ts

# Check exit code
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Test completed successfully${NC}"
else
  echo -e "${RED}❌ Test failed${NC}"
  exit 1
fi
