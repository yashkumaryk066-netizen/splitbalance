#!/bin/bash
echo "Starting EAS Build..."
npx eas-cli build -p android --profile preview --non-interactive > /tmp/eas_build_out.txt 2>&1
URL=$(grep -o 'https://expo.dev/artifacts/eas/.*\.apk' /tmp/eas_build_out.txt | head -n 1)

if [ -z "$URL" ]; then
  echo "EAS Build failed or URL not found."
  exit 1
fi

echo "Got APK URL: $URL"
echo "Downloading APK locally and as public zip asset..."
curl -L -o public/settlestack.zip "$URL"

if [ $? -ne 0 ]; then
  echo "Downloading APK failed!"
  exit 1
fi

# Keep a local copy for GitHub release
cp public/settlestack.zip SettleStack.apk

VERSION=$(node -p "require('./app.json').expo.version")
echo "Creating GitHub Release for v$VERSION..."
gh release create "v$VERSION" SettleStack.apk --title "Release v$VERSION" --notes "SettleStack Android Release v$VERSION" 2>/dev/null || gh release upload "v$VERSION" SettleStack.apk --clobber

if [ $? -ne 0 ]; then
  echo "GitHub Release upload failed!"
  exit 1
fi

echo "Updating version configuration files..."
node -e "
const fs = require('fs');
const v = require('./app.json').expo.version;
const url = 'https://splitbalance-b552b.web.app/download.html';

// Update Version.ts
let vContent = fs.readFileSync('src/constants/Version.ts', 'utf-8');
vContent = vContent.replace(/export const APP_VERSION = '.*';/, \`export const APP_VERSION = '\${v}';\`);
vContent = vContent.replace(/export const LATEST_APK_URL = '.*';/, \`export const LATEST_APK_URL = '\${url}';\`);
fs.writeFileSync('src/constants/Version.ts', vContent);

// Update update_version_standalone.ts
let uContent = fs.readFileSync('update_version_standalone.ts', 'utf-8');
uContent = uContent.replace(/latestVersion: '.*',/, \`latestVersion: '\${v}',\`);
uContent = uContent.replace(/downloadUrl: '.*',/, \`downloadUrl: '\${url}',\`);
fs.writeFileSync('update_version_standalone.ts', uContent);
"

# Clean up local temp APK
rm SettleStack.apk


echo "Building Web App..."
npm run build

echo "Syncing Remote Version in Firestore..."
npx ts-node update_version_standalone.ts
if [ $? -ne 0 ]; then
  echo "Firestore Version update FAILED!"
  exit 1
fi

echo "Deploying Web App to Firebase..."
npx firebase-tools@13.11.4 deploy --project splitbalance-b552b --only hosting

echo "Successfully Published and Deployed!"



