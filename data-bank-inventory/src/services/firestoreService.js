import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  INVENTORY: 'inventory',
  DISTRIBUTIONS: 'distributions',
  ACTIVITY: 'activity'
};

class FirestoreService {
  constructor() {
    this.listeners = new Map(); // Track active listeners for cleanup
  }

  // Enhanced error handling
  handleError(error, operation) {
    console.error(`Firestore ${operation} error:`, error);
    
    // Return user-friendly error messages
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to perform this action.';
      case 'unavailable':
        return 'Service temporarily unavailable. Please try again.';
      case 'unauthenticated':
        return 'Please sign in to continue.';
      case 'not-found':
        return 'The requested data was not found.';
      case 'already-exists':
        return 'This data already exists.';
      default:
        return `Operation failed: ${error.message}`;
    }
  }

  // User data operations
  async createUserProfile(userId, userData) {
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, userId), {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async getUserProfile(userId) {
    try {
      const docRef = doc(db, COLLECTIONS.USERS, userId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, userData) {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
        ...userData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Inventory operations
  async saveInventory(userId, inventoryData) {
    try {
      const inventoryRef = doc(db, 'users', userId, 'data', 'inventory');
      
      await setDoc(inventoryRef, {
        categories: inventoryData,
        lastUpdated: serverTimestamp(),
        version: '2.0'
      }, { merge: true });

      return { success: true, message: 'Inventory saved successfully' };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'inventory save') 
      };
    }
  }

  async getInventory(userId) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'inventory');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error getting inventory:', error);
      throw error;
    }
  }

  // Real-time inventory synchronization
  subscribeToInventory(userId, callback) {
    try {
      const inventoryRef = doc(db, 'users', userId, 'data', 'inventory');
      
      const unsubscribe = onSnapshot(inventoryRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          callback({
            success: true,
            data: data.categories || {},
            lastUpdated: data.lastUpdated?.toDate() || new Date(),
            syncStatus: 'synced'
          });
        } else {
          // Initialize empty inventory if none exists
          callback({
            success: true,
            data: {
              'DAIRY': 0,
              'GRAIN': 0,
              'PROTEIN': 0,
              'FRUIT': 0,
              'VEG': 0,
              'PRODUCE': 0,
              'MISC': 0
            },
            lastUpdated: new Date(),
            syncStatus: 'initialized'
          });
        }
      }, (error) => {
        callback({
          success: false,
          error: this.handleError(error, 'inventory subscription'),
          syncStatus: 'error'
        });
      });

      this.listeners.set(`inventory_${userId}`, unsubscribe);
      return unsubscribe;
    } catch (error) {
      callback({
        success: false,
        error: this.handleError(error, 'inventory subscription setup'),
        syncStatus: 'error'
      });
    }
  }

  // Distribution operations
  async addDistribution(userId, distributionData) {
    try {
      const distributionsRef = collection(db, 'users', userId, 'distributions');
      const docRef = doc(distributionsRef);
      await setDoc(docRef, {
        ...distributionData,
        date: distributionData.date || serverTimestamp(),
        createdAt: serverTimestamp(),
        id: docRef.id
      });
      return { 
        success: true, 
        message: 'Distribution recorded successfully',
        id: docRef.id 
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'distribution save') 
      };
    }
  }

  // FIXED: Load distributions from the correct user subcollection
  async getUserDistributions(userId, limitCount = 1000) {
    try {
      const q = query(
        collection(db, 'users', userId, 'distributions'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Loaded user distributions from Firestore:', data);
      return data;
    } catch (error) {
      console.error('Error getting user distributions:', error);
      throw error;
    }
  }

  // Real-time distribution history synchronization
  subscribeToDistributions(userId, callback) {
    try {
      const distributionsRef = collection(db, 'users', userId, 'distributions');
      const q = query(distributionsRef, orderBy('date', 'desc'), limit(100));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const distributions = [];
        snapshot.forEach((doc) => {
          distributions.push({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.() || doc.data().date
          });
        });

        callback({
          success: true,
          data: distributions,
          count: distributions.length,
          syncStatus: 'synced'
        });
      }, (error) => {
        callback({
          success: false,
          error: this.handleError(error, 'distributions subscription'),
          syncStatus: 'error'
        });
      });

      this.listeners.set(`distributions_${userId}`, unsubscribe);
      return unsubscribe;
    } catch (error) {
      callback({
        success: false,
        error: this.handleError(error, 'distributions subscription setup'),
        syncStatus: 'error'
      });
    }
  }

  // Batch update multiple distributions
  async batchUpdateDistributions(userId, distributions) {
    try {
      const batch = writeBatch(db);
      
      distributions.forEach((distribution) => {
        const docRef = doc(db, 'users', userId, 'distributions', distribution.id || doc().id);
        batch.set(docRef, {
          ...distribution,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      return { 
        success: true, 
        message: `${distributions.length} distributions updated successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'batch distribution update') 
      };
    }
  }

  // User preferences and settings
  async saveUserPreferences(userId, preferences) {
    try {
      const prefsRef = doc(db, 'users', userId, 'settings', 'preferences');
      
      await setDoc(prefsRef, {
        ...preferences,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      return { success: true, message: 'Preferences saved successfully' };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'preferences save') 
      };
    }
  }

  async getUserPreferences(userId) {
    try {
      const prefsRef = doc(db, 'users', userId, 'settings', 'preferences');
      const docSnap = await getDoc(prefsRef);
      
      if (docSnap.exists()) {
        return { 
          success: true, 
          data: docSnap.data(),
          lastUpdated: docSnap.data().lastUpdated?.toDate()
        };
      } else {
        // Return default preferences
        return { 
          success: true, 
          data: {
            orderingUnit: 'pounds',
            unitConfigurations: null,
            notifications: true,
            autoBackup: true
          },
          isDefault: true
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'preferences load') 
      };
    }
  }

  // Activity operations
  async addActivity(userId, activityData) {
    try {
      await addDoc(collection(db, COLLECTIONS.ACTIVITY), {
        userId,
        ...activityData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  }

  async getUserActivities(userId, limitCount = 20) {
    try {
      const q = query(
        collection(db, COLLECTIONS.ACTIVITY),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting activities:', error);
      throw error;
    }
  }

  // Activity feed management
  async saveActivity(userId, activities) {
    try {
      const activityRef = doc(db, 'users', userId, 'data', 'activity');
      
      await setDoc(activityRef, {
        items: activities.slice(0, 50), // Keep only last 50 activities
        lastUpdated: serverTimestamp()
      }, { merge: true });

      return { success: true, message: 'Activity saved successfully' };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'activity save') 
      };
    }
  }

  async getActivity(userId) {
    try {
      const activityRef = doc(db, 'users', userId, 'data', 'activity');
      const docSnap = await getDoc(activityRef);
      
      if (docSnap.exists()) {
        return { 
          success: true, 
          data: docSnap.data().items || [],
          lastUpdated: docSnap.data().lastUpdated?.toDate()
        };
      } else {
        return { success: true, data: [] };
      }
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'activity load') 
      };
    }
  }

  // Data export for backup
  async exportUserData(userId) {
    try {
      const [inventory, distributions, preferences, activity] = await Promise.all([
        getDoc(doc(db, 'users', userId, 'data', 'inventory')),
        getDocs(collection(db, 'users', userId, 'distributions')),
        getDoc(doc(db, 'users', userId, 'settings', 'preferences')),
        getDoc(doc(db, 'users', userId, 'data', 'activity'))
      ]);

      const exportData = {
        inventory: inventory.exists() ? inventory.data() : null,
        distributions: [],
        preferences: preferences.exists() ? preferences.data() : null,
        activity: activity.exists() ? activity.data() : null,
        exportDate: new Date().toISOString(),
        userId: userId,
        version: '2.0'
      };

      distributions.forEach((doc) => {
        exportData.distributions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, data: exportData };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'data export') 
      };
    }
  }

  // Data import from backup
  async importUserData(userId, importData) {
    try {
      const batch = writeBatch(db);

      // Import inventory
      if (importData.inventory) {
        const inventoryRef = doc(db, 'users', userId, 'data', 'inventory');
        batch.set(inventoryRef, {
          ...importData.inventory,
          importedAt: serverTimestamp()
        });
      }

      // Import preferences
      if (importData.preferences) {
        const prefsRef = doc(db, 'users', userId, 'settings', 'preferences');
        batch.set(prefsRef, {
          ...importData.preferences,
          importedAt: serverTimestamp()
        });
      }

      // Import activity
      if (importData.activity) {
        const activityRef = doc(db, 'users', userId, 'data', 'activity');
        batch.set(activityRef, {
          ...importData.activity,
          importedAt: serverTimestamp()
        });
      }

      await batch.commit();

      // Import distributions separately due to batch size limits
      if (importData.distributions && importData.distributions.length > 0) {
        const distributionBatches = [];
        for (let i = 0; i < importData.distributions.length; i += 500) {
          distributionBatches.push(importData.distributions.slice(i, i + 500));
        }

        for (const batchData of distributionBatches) {
          const distBatch = writeBatch(db);
          batchData.forEach((distribution) => {
            const docRef = doc(db, 'users', userId, 'distributions', distribution.id || doc().id);
            distBatch.set(docRef, {
              ...distribution,
              importedAt: serverTimestamp()
            });
          });
          await distBatch.commit();
        }
      }

      return { 
        success: true, 
        message: 'Data imported successfully',
        imported: {
          inventory: !!importData.inventory,
          distributions: importData.distributions?.length || 0,
          preferences: !!importData.preferences,
          activity: !!importData.activity
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'data import') 
      };
    }
  }

  // Daily metrics operations
  async getTodayMetrics(userId, dateString) {
    try {
      const metricsRef = doc(db, 'users', userId, 'metrics', dateString);
      const docSnap = await getDoc(metricsRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error('Error getting today\'s metrics:', error);
      throw error;
    }
  }

  async setTodayMetrics(userId, dateString, metrics) {
    try {
      const metricsRef = doc(db, 'users', userId, 'metrics', dateString);
      await setDoc(metricsRef, {
        ...metrics,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error setting today\'s metrics:', error);
      throw error;
    }
  }

  // Add a new distribution record
  async addDistributionRecord(userId, distribution) {
    try {
      const colRef = collection(db, 'users', userId, 'distributions');
      const docRef = await addDoc(colRef, {
        ...distribution,
        createdAt: serverTimestamp()
      });
      console.log('[FIRESTORE] Saved distribution:', docRef.id, distribution);
    } catch (error) {
      console.error('[FIRESTORE] Error adding distribution record:', error, distribution);
      throw error;
    }
  }

  // Cleanup listeners
  unsubscribeAll(userId) {
    const userListeners = Array.from(this.listeners.keys()).filter(key => 
      key.includes(userId)
    );
    
    userListeners.forEach(key => {
      const unsubscribe = this.listeners.get(key);
      if (unsubscribe) {
        unsubscribe();
        this.listeners.delete(key);
      }
    });
  }

  // Connection status monitoring
  onConnectionStateChange(callback) {
    // This would typically use Firebase's connection state monitoring
    // For now, we'll simulate it with a simple online/offline check
    const handleOnline = () => callback({ connected: true, timestamp: new Date() });
    const handleOffline = () => callback({ connected: false, timestamp: new Date() });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    callback({ 
      connected: navigator.onLine, 
      timestamp: new Date() 
    });

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

// Create singleton instance
const firestoreService = new FirestoreService();
export default firestoreService; 