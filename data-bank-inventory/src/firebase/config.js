import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// if nothing is there ask me for the values
const isUsingEnvVars = process.env.REACT_APP_FIREBASE_API_KEY && 
                      process.env.REACT_APP_FIREBASE_PROJECT_ID;

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Log config
if (process.env.NODE_ENV === 'development') {
  if (isUsingEnvVars) {
    console.log('🔥 Firebase: Using environment variables from .env file');
    console.log('📋 Project ID:', firebaseConfig.projectId);
  } else {
    console.log('🔥 Firebase: Using demo configuration (localStorage only)');
    console.log('💡 To use real Firebase, create a .env file with your Firebase credentials');
  }
}


let app;
try {
  app = initializeApp(firebaseConfig);
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Firebase initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  throw error;
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Connect to emulators in development (optional)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('🔧 Connected to Firebase emulators');
  } catch (error) {
    console.log('⚠️ Firebase emulators already connected or not available');
  }
}

// Export configuration status for other components to use
export const isFirebaseConfigured = isUsingEnvVars;

export default app; 