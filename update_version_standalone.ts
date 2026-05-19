import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB3ASP-dHS0OryBlWdl3CaPvtEkB_i-ZXs",
  authDomain: "splitbalance-b552b.firebaseapp.com",
  projectId: "splitbalance-b552b",
  storageBucket: "splitbalance-b552b.firebasestorage.app",
  messagingSenderId: "40872959188",
  appId: "1:40872959188:web:0bb467c35685a44ac5ef41"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const updateVersion = async () => {
    try {
        await setDoc(doc(db, 'app_config', 'version'), {
            latestVersion: '1.3.3',
            downloadUrl: 'https://github.com/yashkumaryk066-netizen/splitbalance/releases/download/v1.3.3/SettleStack_v1.3.3.apk',
            mandatory: false,
            message: 'Stable update 1.3.3! Split your balances with the best experience yet. 🚀🔥'
        });
        console.log('Successfully updated version in Firestore!');
        process.exit(0);
    } catch (err) {
        console.error('Update failed:', err);
        process.exit(1);
    }
};

updateVersion();
