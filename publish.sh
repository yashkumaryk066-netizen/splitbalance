#!/bin/bash
echo "Starting EAS Build..."
npx eas-cli build -p android --profile preview --non-interactive > /tmp/eas_build_out.txt 2>&1
URL=$(grep -o 'https://expo.dev/artifacts/eas/.*\.apk' /tmp/eas_build_out.txt | head -n 1)

if [ -z "$URL" ]; then
  echo "EAS Build failed or URL not found."
  exit 1
fi

echo "Got APK URL: $URL"
echo "Downloading APK to public/settlestack.apk..."
curl -L -o public/settlestack.apk "$URL"

if [ $? -ne 0 ]; then
  echo "Downloading APK failed!"
  exit 1
fi

# Ensure LATEST_APK_URL points to our Firebase hosting URL
node -e "
const fs = require('fs');
let content = fs.readFileSync('src/constants/Version.ts', 'utf-8');
content = content.replace(/export const LATEST_APK_URL = '.*';/, \"export const LATEST_APK_URL = 'https://splitbalance-b552b.web.app/settlestack.apk';\");
fs.writeFileSync('src/constants/Version.ts', content);
"

echo "Building Web App..."
npm run build

echo "Syncing Remote Version in Firestore..."
npx ts-node update_version_standalone.ts
if [ $? -ne 0 ]; then
  echo "Firestore Version update FAILED!"
  exit 1
fi

echo "Deploying to Firebase..."
npx firebase-tools@13.11.4 deploy --project splitbalance-b552b --only hosting

echo "Successfully Published and Deployed!"


