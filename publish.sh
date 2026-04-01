#!/bin/bash
echo "Starting EAS Build..."
npx eas-cli build -p android --profile preview --non-interactive > /tmp/eas_build_out.txt 2>&1
URL=$(grep -o 'https://expo.dev/artifacts/eas/.*\.apk' /tmp/eas_build_out.txt | head -n 1)

if [ -z "$URL" ]; then
  echo "EAS Build failed or URL not found."
  exit 1
fi

echo "Got APK URL: $URL"

# Update Version.ts with specific node script instead of sed to comply with AI rules
node -e "
const fs = require('fs');
let content = fs.readFileSync('src/constants/Version.ts', 'utf-8');
content = content.replace(/https:\/\/expo\.dev\/artifacts\/eas\/.*\.apk/, '$URL');
fs.writeFileSync('src/constants/Version.ts', content);
"

echo "Building Web App..."
npm run build

echo "Deploying to Firebase..."
npx firebase-tools@13.11.4 deploy --project splitbalance-b552b --only hosting

echo "Successfully Published and Deployed!"
