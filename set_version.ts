import { db } from './src/services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

const setVersion = async () => {
    try {
        await setDoc(doc(db, 'app_config', 'version'), {
            latestVersion: '1.2.0',
            downloadUrl: 'https://expo.dev/artifacts/eas/qNXZ6H3mqbutE3gAjjTjPN.apk',
            mandatory: false,
            message: 'New Update: Added Profile Photos & Optimization! 🔥'
        });
        console.log('Version updated in Firestore!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

setVersion().then(() => {
    console.log("Success");
}).catch(err => {
    console.error(err);
    process.exit(1);
});
