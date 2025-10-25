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
import { db } from '../config/firebase/config';

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
      console.log('Sample distribution ageGroups:', data[0]?.ageGroups);
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

  async setTargetCapacity(userId, targetCapacity) {
    return this.saveUserPreferences(userId, { targetCapacity });
  }

  async getTargetCapacity(userId) {
    const prefs = await this.getUserPreferences(userId);
    if (prefs.success && prefs.data && prefs.data.targetCapacity) {
      return prefs.data.targetCapacity;
    }
    return 900000; // Default fallback
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

  async resetTodayMetrics(userId, dateString) {
    try {
      const metricsRef = doc(db, 'users', userId, 'metrics', dateString);
      await setDoc(metricsRef, {
        totalDistributedToday: 0,
        clientsServedToday: 0,
        lastUpdated: new Date(),
        resetAt: new Date()
      });
      return { success: true, message: 'Today\'s metrics reset in Firebase' };
    } catch (error) {
      console.error('Error resetting today\'s metrics:', error);
      return { 
        success: false, 
        error: this.handleError(error, 'today metrics reset') 
      };
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

  // Complete user data reset
  async resetAllUserData(userId) {
    try {
      const batch = writeBatch(db);

      // Delete inventory data
      const inventoryRef = doc(db, 'users', userId, 'data', 'inventory');
      batch.delete(inventoryRef);

      // Delete activity data
      const activityRef = doc(db, 'users', userId, 'data', 'activity');
      batch.delete(activityRef);

      // Delete user preferences/settings
      const prefsRef = doc(db, 'users', userId, 'settings', 'preferences');
      batch.delete(prefsRef);

      // Execute batch delete for main documents
      await batch.commit();

      // Delete all distributions (need to fetch and delete individually due to subcollection)
      const distributionsRef = collection(db, 'users', userId, 'distributions');
      const distributionsSnapshot = await getDocs(distributionsRef);
      
      if (!distributionsSnapshot.empty) {
        const deleteBatch = writeBatch(db);
        distributionsSnapshot.docs.forEach((doc) => {
          deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
      }

      // Delete all metrics (daily metrics)
      const metricsRef = collection(db, 'users', userId, 'metrics');
      const metricsSnapshot = await getDocs(metricsRef);
      
      if (!metricsSnapshot.empty) {
        const metricsBatch = writeBatch(db);
        metricsSnapshot.docs.forEach((doc) => {
          metricsBatch.delete(doc.ref);
        });
        await metricsBatch.commit();
      }

      // Clean up listeners for this user
      this.unsubscribeAll(userId);

      return { 
        success: true, 
        message: 'All user data deleted successfully from Firebase',
        deletedCollections: ['inventory', 'activity', 'preferences', 'distributions', 'metrics']
      };
    } catch (error) {
      console.error('Error resetting user data:', error);
      return { 
        success: false, 
        error: this.handleError(error, 'complete data reset') 
      };
    }
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

  // ==========================================
  // HISTORICAL SNAPSHOTS & ANALYTICS
  // ==========================================

  /**
   * Save an inventory snapshot for trend analysis
   * @param {string} userId - User ID
   * @param {object} inventoryData - Current inventory state
   * @returns {Promise<object>} Success/error result
   */
  async saveInventorySnapshot(userId, inventoryData) {
    try {
      const snapshotRef = collection(db, 'users', userId, 'inventorySnapshots');
      const timestamp = new Date();
      const dateKey = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      
      await addDoc(snapshotRef, {
        inventory: inventoryData,
        timestamp: serverTimestamp(),
        date: dateKey,
        createdAt: serverTimestamp()
      });

      return { 
        success: true, 
        message: 'Inventory snapshot saved successfully',
        timestamp 
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'inventory snapshot save') 
      };
    }
  }

  /**
   * Get inventory snapshots for trend analysis
   * @param {string} userId - User ID
   * @param {number} days - Number of days to retrieve (default 90)
   * @returns {Promise<Array>} Array of inventory snapshots
   */
  async getInventorySnapshots(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateString = startDate.toISOString().split('T')[0];

      const snapshotsRef = collection(db, 'users', userId, 'inventorySnapshots');
      const q = query(
        snapshotsRef,
        where('date', '>=', startDateString),
        orderBy('date', 'desc'),
        limit(days)
      );

      const querySnapshot = await getDocs(q);
      const snapshots = [];
      
      querySnapshot.forEach((doc) => {
        snapshots.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        });
      });

      return snapshots;
    } catch (error) {
      console.error('Error getting inventory snapshots:', error);
      throw error;
    }
  }

  /**
   * Save calculated analytics metrics (cache to reduce computation)
   * @param {string} userId - User ID
   * @param {string} metricType - Type of metric (turnover, forecast, etc.)
   * @param {object} metricData - Calculated metric data
   * @returns {Promise<object>} Success/error result
   */
  async saveCalculatedMetric(userId, metricType, metricData) {
    try {
      const metricRef = doc(db, 'users', userId, 'calculatedMetrics', metricType);
      
      await setDoc(metricRef, {
        ...metricData,
        calculatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      return { 
        success: true, 
        message: `${metricType} metric saved successfully` 
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'calculated metric save') 
      };
    }
  }

  /**
   * Get calculated analytics metric
   * @param {string} userId - User ID
   * @param {string} metricType - Type of metric to retrieve
   * @returns {Promise<object|null>} Cached metric data or null
   */
  async getCalculatedMetric(userId, metricType) {
    try {
      const metricRef = doc(db, 'users', userId, 'calculatedMetrics', metricType);
      const docSnap = await getDoc(metricRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: docSnap.data(),
          lastUpdated: docSnap.data().lastUpdated?.toDate()
        };
      } else {
        return { 
          success: true, 
          data: null 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'calculated metric load') 
      };
    }
  }

  /**
   * Delete old inventory snapshots (cleanup to save storage)
   * @param {string} userId - User ID
   * @param {number} keepDays - Days to keep (default 180)
   * @returns {Promise<object>} Success/error result
   */
  async cleanupOldSnapshots(userId, keepDays = 180) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];

      const snapshotsRef = collection(db, 'users', userId, 'inventorySnapshots');
      const q = query(
        snapshotsRef,
        where('date', '<', cutoffDateString)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return { 
          success: true, 
          message: 'No old snapshots to clean up',
          deletedCount: 0
        };
      }

      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();

      return { 
        success: true, 
        message: `Deleted ${querySnapshot.size} old snapshots`,
        deletedCount: querySnapshot.size
      };
    } catch (error) {
      return { 
        success: false, 
        error: this.handleError(error, 'snapshot cleanup') 
      };
    }
  }

  /**
   * Get aggregated analytics data for dashboard
   * @param {string} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<object>} Aggregated analytics data
   */
  async getAggregatedAnalytics(userId, days = 30) {
    try {
      const [snapshots, distributions, metrics] = await Promise.all([
        this.getInventorySnapshots(userId, days),
        this.getUserDistributions(userId, 100),
        this.getCalculatedMetric(userId, 'turnover')
      ]);

      return {
        success: true,
        data: {
          inventorySnapshots: snapshots,
          recentDistributions: distributions,
          cachedMetrics: metrics.data,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'aggregated analytics load')
      };
    }
  }
}

// Create singleton instance
const firestoreService = new FirestoreService();
export default firestoreService; 