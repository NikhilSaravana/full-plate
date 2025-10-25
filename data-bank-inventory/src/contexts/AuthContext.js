import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase/config';
import firestoreService from '../services/firestoreService';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sign up function
  async function signup(email, password, displayName, organization = '') {
    try {
      setError('');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      if (displayName) {
        await updateProfile(result.user, {
          displayName: displayName
        });
      }
      
      // Create user profile in Firestore with all collected data
      const userProfileData = {
        name: displayName,
        email: email,
        organization: organization,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };
      
      await firestoreService.createUserProfile(result.user.uid, userProfileData);
      
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  // Login function
  async function login(email, password) {
    try {
      setError('');
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last login time in Firestore (but only once per day to save quota)
      if (result.user) {
        try {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          const lastLoginDate = localStorage.getItem(`lastLoginDate_${result.user.uid}`);
          
          // Only update if we haven't updated today already
          if (lastLoginDate !== today) {
            await firestoreService.updateUserProfile(result.user.uid, {
              lastLoginAt: new Date()
            });
            localStorage.setItem(`lastLoginDate_${result.user.uid}`, today);
          }
        } catch (profileError) {
          console.warn('Could not update last login time:', profileError);
          // Don't throw error for profile update failure
        }
      }
      
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  // Password reset function
  async function resetPassword(email) {
    try {
      setError('');
      return await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  // Logout function
  function logout() {
    localStorage.clear(); // Clear all localStorage data on logout
    return signOut(auth);
  }

  // Update user profile
  async function updateUserProfile(updates) {
    try {
      setError('');
      await updateProfile(currentUser, updates);
      setCurrentUser({ ...currentUser, ...updates });
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Get user profile data from Firestore
  async function getUserProfile() {
    if (!currentUser) return null;
    try {
      return await firestoreService.getUserProfile(currentUser.uid);
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  const value = {
    currentUser,
    login,
    signup,
    logout,
    resetPassword,
    updateUserProfile,
    getUserProfile,
    error,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 