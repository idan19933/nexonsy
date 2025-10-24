import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let bucket = null;

try {
    // Parse the Firebase service account from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Initialize Firebase Admin
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'online-shop-24c4f.appspot.com'
    });

    bucket = admin.storage().bucket();
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.log('⚠️ Personality uploads will not persist across deployments');
}

export { admin, bucket };