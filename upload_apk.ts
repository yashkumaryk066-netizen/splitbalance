import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyB3ASP-dHS0OryBlWdl3CaPvtEkB_i-ZXs",
  authDomain: "splitbalance-b552b.firebaseapp.com",
  projectId: "splitbalance-b552b",
  storageBucket: "splitbalance-b552b.appspot.com",
  messagingSenderId: "40872959188",
  appId: "1:40872959188:web:0bb467c35685a44ac5ef41"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Find the apk file in the current directory or public directory
function findApk() {
  const files = fs.readdirSync('.');
  const apkFiles = files.filter(f => f.endsWith('.apk'));
  if (apkFiles.length > 0) {
    // Sort by modification time to get the newest
    apkFiles.sort((a, b) => {
      return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
    });
    return apkFiles[0];
  }
  
  if (fs.existsSync('public/settlestack.apk')) {
    return 'public/settlestack.apk';
  }
  return null;
}

async function upload() {
  const apkPath = findApk();
  if (!apkPath) {
    console.error('No APK file found to upload.');
    process.exit(1);
  }
  
  console.log(`Found APK: ${apkPath}`);
  try {
    const fileBuffer = fs.readFileSync(apkPath);
    const storageRef = ref(storage, 'settlestack.apk');
    console.log('Uploading to Firebase Storage...');
    const snapshot = await uploadBytes(storageRef, fileBuffer, {
      contentType: 'application/vnd.android.package-archive'
    });
    console.log('Uploaded successfully!');
    const url = await getDownloadURL(snapshot.ref);
    console.log('DOWNLOAD_URL_START:' + url + ':DOWNLOAD_URL_END');
    process.exit(0);
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

upload();
