import { db } from './src/services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

async function updateRemoteVersion() {
  try {
    await setDoc(doc(db, 'app_config', 'version'), {
      latestVersion: '1.3.2',
      downloadUrl: 'https://expo.dev/artifacts/eas/nv7BnktcwhhgD2x3rMRgX7.apk',
      message: 'Calculator integrated! Now enter math expressions like 150+20 directly in amount fields. 🚀',
      mandatory: false
    }, { merge: true });
    console.log('Remote version updated to 1.3.2');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

updateRemoteVersion();
