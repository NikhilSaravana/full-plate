import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sign up function
  async function signup(email, password, displayName) {
    try {
      setError('');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      if (displayName) {
        await updateProfile(result.user, {
          displayName: displayName
        });
      }
      
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
      return await signInWithEmailAndPassword(auth, email, password);
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

  const value = {
    currentUser,
    login,
    signup,
    logout,
    updateUserProfile,
    error,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 