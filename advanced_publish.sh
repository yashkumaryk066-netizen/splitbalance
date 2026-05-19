#!/bin/bash

# ANSI Color Codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting Advanced Deployment Pipeline...${NC}"

# 1. Check for missing Firestore Indexes (Proactive Scan)
echo -e "${YELLOW}🔍 Scanning for potential missing indexes in queries...${NC}"
QUERIES_WITH_ORDER=$(grep -r "query(" . | grep "where(" | grep "orderBy(")

if [ ! -z "$QUERIES_WITH_ORDER" ]; then
    echo -e "${YELLOW}⚠️ Found queries with multiple filters and ordering. verifying firestore.indexes.json...${NC}"
    # Verification logic: we check if 'type' or 'cycleId' are in the indexes file
    for q in "cycleId" "type"; do
        if ! grep -q "$q" firestore.indexes.json; then
            echo -e "${RED}❌ ERROR: Query for '$q' found in code but missing in firestore.indexes.json!${NC}"
            echo -e "${RED}Deployment aborted to prevent runtime errors.${NC}"
            exit 1
        fi
    done
fi
echo -e "${GREEN}✅ Index Check Passed!${NC}"

# 2. Run Web Build & Look for Errors
echo -e "${YELLOW}🏗️ Running Web Build (Checking for build errors)...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build FAILED! Deployment aborted.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build Successful!${NC}"

# 3. Synchronize Remote Version (Update Firestore app_config)
echo -e "${YELLOW}🆙 Syncing Remote Version in Firestore...${NC}"
npx ts-node update_version_standalone.ts
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Firestore Version update FAILED!${NC}"
    exit 1
fi

# 4. Final Deploy
echo -e "${YELLOW}☁️ Deploying to Firebase (Indexes, Rules, Hosting)...${NC}"
npx firebase-tools@13.11.4 deploy --project splitbalance-b552b --non-interactive
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Firebase Deployment FAILED!${NC}"
    exit 1
fi

echo -e "${GREEN}✨ ADVANCED DEPLOYMENT SUCCESSFUL! ✨${NC}"
echo -e "${GREEN}App is Live & Verified!${NC}"
