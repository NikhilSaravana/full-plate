import React, { useState, useEffect } from 'react';
import { useAuth } from '../../backend/contexts/AuthContext';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import { useNotifications } from '../../backend/contexts/NotificationContext';
import MyPlateCalculator from './MyPlateCalculator';
import InventoryManager from './InventoryManager';
import SurveyInterface from './SurveyInterface';
import DistributionInterface from './DistributionInterface';
import UnitConfiguration from './UnitConfiguration';
import ConfirmationDialog from '../components/ConfirmationDialog';
import ReportsInterface from './ReportsInterface';
import GuidedTour from '../components/GuidedTour';
import LanguageSelector from '../components/LanguageSelector';
import GlobalSearch from '../components/GlobalSearch';
import firestoreService from '../../backend/services/firestoreService';
import { UnitConverters } from './UnitConfiguration';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCombinedAlerts } from '../../backend/utils/alertUtils';
import { SYSTEM_CONFIG, setTargetCapacity } from '../../backend/utils/FoodCategoryMapper';
import { getCategoryStatus, MYPLATE_GOALS } from '../../backend/utils/FoodCategoryMapper';

// Default unit configurations for inventory units
const DEFAULT_UNIT_CONFIGS = {
  PALLET: {
    name: 'Pallet',
    abbreviation: 'PLT',
    baseWeight: 1500, // Default average pallet weight in lbs
    categorySpecific: {
      'DAIRY': 1200,
      'GRAIN': 1400,
      'PROTEIN': 1600,
      'FRUIT': 1300,
      'VEG': 1450,
      'PRODUCE': 1100,
      'MISC': 1500
    }
  },
  CASE: {
    name: 'Case',
    abbreviation: 'CS',
    baseWeight: 25, // Default case weight in lbs
    categorySpecific: {
      'DAIRY': 30,
      'GRAIN': 20,
      'PROTEIN': 35,
      'FRUIT': 25,
      'VEG': 28,
      'PRODUCE': 22,
      'MISC': 25
    }
  },
  POUNDS: {
    name: 'Pounds',
    abbreviation: 'LB',
    baseWeight: 1,
    categorySpecific: {}
  }
};



const Dashboard = () => {
  const { currentUser, logout, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const { showSuccess, showError, showInfo } = useNotifications();

  // Real inventory state that starts empty and gets populated by user data
  const [currentInventory, setCurrentInventory] = useState({
    'DAIRY': 0,
    'GRAIN': 0,
    'PROTEIN': 0,
    'FRUIT': 0,
    'VEG': 0,
    'PRODUCE': 0,
    'MISC': 0
  });

  const [successMessage, setSuccessMessage] = useState('');


  const [activeTab, setActiveTab] = useState('overview');
  const [activeOverviewSection, setActiveOverviewSection] = useState('dashboard');
  const [recentActivity, setRecentActivity] = useState([]);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  
  // Debouncing for inventory saves to prevent excessive Firestore writes
  const [inventorySaveTimeout, setInventorySaveTimeout] = useState(null);
  
  // Debounced inventory save function - only saves after 2 seconds of no changes
  const debouncedSaveInventory = (inventoryData) => {
    if (inventorySaveTimeout) {
      clearTimeout(inventorySaveTimeout);
    }
    
    const timeout = setTimeout(() => {
      if (currentUser) {
        firestoreService.saveInventory(currentUser.uid, inventoryData)
          .catch(err => console.warn('Failed to save inventory to Firestore:', err));
      }
    }, 2000); // 2 second delay
    
    setInventorySaveTimeout(timeout);
  };

  // Enhanced Distribution Tracking
  const [distributionHistory, setDistributionHistory] = useState([]);
  const [surveyHistory, setSurveyHistory] = useState([]);
  const [outgoingMetrics, setOutgoingMetrics] = useState({
    totalDistributedToday: 0,
    totalDistributedWeek: 0,
    clientsServedToday: 0,
    avgDistributionSize: 0
  });

  // Default unit config for initialization
  const [unitConfig, setUnitConfig] = useState(DEFAULT_UNIT_CONFIGS);

  // Helper to get namespaced key
  const nsKey = (base) => currentUser ? `${base}_${currentUser.uid}` : base;

  // Enhanced localStorage operations with error handling
  const safeLocalStorageGet = (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(nsKey(key));
      if (!item) return defaultValue;
      const parsed = JSON.parse(item);
      return parsed;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      setStorageStatus('error');
      return defaultValue;
    }
  };

  const safeLocalStorageSet = (key, value) => {
    try {
      localStorage.setItem(nsKey(key), JSON.stringify(value));
      setStorageStatus('healthy');
      return true;
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
      setStorageStatus('error');
      // Try to free up space by removing old data
      if (error.name === 'QuotaExceededError') {
        cleanupOldData();
        // Try again after cleanup
        try {
          localStorage.setItem(nsKey(key), JSON.stringify(value));
          setStorageStatus('healthy');
          return true;
        } catch (retryError) {
          console.error('Failed to save even after cleanup:', retryError);
          return false;
        }
      }
      return false;
    }
  };

  // Helper to get today's date string
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Manual reset function for today's metrics
  const resetTodayMetrics = async () => {
    try {
      // Reset local state
      setOutgoingMetrics(prev => ({
        ...prev,
        totalDistributedToday: 0,
        clientsServedToday: 0
      }));
      
      // Reset Firebase metrics if user is authenticated
      if (currentUser) {
        const today = getTodayString();
        const result = await firestoreService.resetTodayMetrics(currentUser.uid, today);
        
        if (result.success) {
          console.log('Manual reset: Today\'s metrics reset to zero (local and cloud)');
          showAutoSaveStatus('Today\'s metrics reset to zero (local and cloud)', false);
        } else {
          console.log('Manual reset: Today\'s metrics reset locally, cloud reset failed');
          showAutoSaveStatus('Today\'s metrics reset locally, cloud reset failed: ' + result.error, true);
        }
      } else {
        console.log('Manual reset: Today\'s metrics reset to zero (local only)');
        showAutoSaveStatus('Today\'s metrics reset to zero (local only)', false);
      }
    } catch (error) {
      console.error('Error resetting today metrics:', error);
      showAutoSaveStatus('Failed to reset today\'s metrics', true);
    }
  };



  // Load user profile data from Firestore on login (cached to avoid repeated reads)
  useEffect(() => {
    if (!currentUser) return;
    
    // Check if we already have the profile data to avoid unnecessary reads
    if (userProfile && userProfile.email === currentUser.email) {
      return; // Already have the correct profile data
    }
    
    // Try to load from localStorage first to avoid Firestore read
    const cachedProfile = safeLocalStorageGet('userProfile', null);
    if (cachedProfile && cachedProfile.email === currentUser.email) {
      setUserProfile(cachedProfile);
      return;
    }
    
    // Only read from Firestore if not cached
    getUserProfile().then(profile => {
      if (profile) {
        setUserProfile(profile);
        // Cache the profile data
        safeLocalStorageSet('userProfile', profile);
      }
    }).catch(error => {
      console.error('Error loading user profile:', error);
    });
  }, [currentUser]); // Removed getUserProfile from dependencies to prevent re-runs

  // Load today's metrics from Firestore on login
  useEffect(() => {
    if (!currentUser) return;
    const today = getTodayString();
    firestoreService.getTodayMetrics(currentUser.uid, today)
      .then(data => {
        if (data) {
          setOutgoingMetrics({
            totalDistributedToday: data.totalDistributedToday || 0,
            totalDistributedWeek: data.totalDistributedWeek || 0,
            clientsServedToday: data.clientsServedToday || 0,
            avgDistributionSize: data.avgDistributionSize || 0
          });
        }
      })
      .catch(err => {
        console.error("Failed to load today's metrics from Firestore:", err);
      });
  }, [currentUser]);

  // Save outgoingMetrics to Firestore whenever it changes
  useEffect(() => {
    if (!currentUser) return;
    const today = getTodayString();
    firestoreService.setTodayMetrics(currentUser.uid, today, outgoingMetrics)
      .catch(err => {
        console.error("Failed to save today's metrics to Firestore:", err);
      });
  }, [outgoingMetrics, currentUser]);

  // Unit Toggle System for ordering calculations
  const [orderingUnit, setOrderingUnit] = useState('POUND'); // Default to POUND

  // Enhanced Local Storage Management
  const [storageStatus, setStorageStatus] = useState('healthy');
  const [lastBackupTime, setLastBackupTime] = useState(null);

  // Phase 7A: Enhanced UI State Management
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  });
  const [currentSection, setCurrentSection] = useState('overview'); // For breadcrumb navigation
  const [showHelp, setShowHelp] = useState(false);

  // Guided Tour State
  const [showTour, setShowTour] = useState(false);
  const [isTourRunning, setIsTourRunning] = useState(false);

  // Firebase Integration State
  const [syncStatus, setSyncStatus] = useState('disconnected'); // 'connected', 'syncing', 'error', 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState({ connected: false });
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(false);

  // Pie chart colors
  const CATEGORY_COLORS = {
    'DAIRY': 'var(--accent-primary)', // Blue
    'GRAIN': 'var(--success)', // Green
    'PROTEIN': 'var(--warning)', // Yellow
    'FRUIT': 'var(--error)', // Red
    'VEG': '#17a2b8', // Teal
    'PRODUCE': '#6f42c1', // Purple
    'MISC': '#fd7e14', // Orange
  };

  // Prepare data for pie chart
  const pieData = Object.entries(currentInventory)
    .filter(([category, weight]) => weight > 0)
    .map(([category, weight]) => ({ name: category, value: weight }));

  // Enhanced data validation and error handling
  const validateData = (data, type) => {
    try {
      if (!data) return false;
      
      switch (type) {
        case 'inventory':
          return typeof data === 'object' && 
                 Object.keys(data).every(key => typeof data[key] === 'number');
        case 'activity':
          return Array.isArray(data) && 
                 data.every(item => item.timestamp && item.message);
        case 'distributions':
          return Array.isArray(data) && 
                 data.every(item => item && typeof item === 'object' && 
                 (item.totalDistributed !== undefined || item.totalDistributed === 0) && 
                 item.date);
        default:
          return true;
      }
    } catch (error) {
      console.error(`Data validation failed for ${type}:`, error);
      return false;
    }
  };

  // Cleanup old data to free up localStorage space
  const cleanupOldData = () => {
    try {
      // Remove old activity entries (keep only last 50)
      const activity = safeLocalStorageGet('foodBankActivity', []);
      if (activity.length > 50) {
        const trimmedActivity = activity.slice(0, 50);
        safeLocalStorageSet('foodBankActivity', trimmedActivity);
      }

      // Remove old distribution entries (keep only last 100) - REMOVED: This is now handled by the new system

      console.log('Old data cleaned up to free storage space');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Auto-backup functionality
  const createAutoBackup = () => {
    try {
      const backupData = {
        inventory: currentInventory,
        activity: recentActivity,
        distributions: distributionHistory,
        orderingUnit: orderingUnit,
        timestamp: new Date().toISOString(),
        version: '2.0'
      };

      const backupKey = `backup_${Date.now()}`;
      safeLocalStorageSet(backupKey, backupData);
      setLastBackupTime(new Date());

      // Keep only last 5 backups
      const allKeys = Object.keys(localStorage);
      const backupKeys = allKeys.filter(key => key.startsWith('backup_')).sort();
      if (backupKeys.length > 5) {
        const keysToRemove = backupKeys.slice(0, backupKeys.length - 5);
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      console.log('Auto-backup created successfully');
    } catch (error) {
      console.error('Auto-backup failed:', error);
    }
  };

  // Auto-backup every 10 minutes
  useEffect(() => {
    const backupInterval = setInterval(createAutoBackup, 10 * 60 * 1000);
    return () => clearInterval(backupInterval);
  }, [currentInventory, recentActivity, distributionHistory]);

  // Enhanced data loading with validation
  useEffect(() => {
    if (!currentUser) return;
    // No longer clearing localStorage keys - using proper namespacing instead
    try {
      const savedInventory = safeLocalStorageGet('foodBankInventory');
      const savedActivity = safeLocalStorageGet('foodBankActivity', []);
      const hasBeenSetup = safeLocalStorageGet('foodBankSetupComplete');
      // Validate and load inventory
      if (savedInventory && validateData(savedInventory, 'inventory')) {
        setCurrentInventory(savedInventory);
      }
      // Validate and load activity
      if (validateData(savedActivity, 'activity')) {
        setRecentActivity(savedActivity);
      }
      // Distribution loading is now handled by the separate useEffect below
      if (hasBeenSetup) {
        setIsFirstTime(false);
      }
      setStorageStatus('healthy');
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      setStorageStatus('error');
      showAutoSaveStatus('Error loading saved data', true);
    }
  }, [currentUser]);

  // Enhanced data saving with safe storage functions
  useEffect(() => {
    if (!currentUser) return;
    safeLocalStorageSet('foodBankInventory', currentInventory);
    if (Object.values(currentInventory).some(val => val > 0)) {
      showAutoSaveStatus('Inventory saved');
      // Save to cloud if user is authenticated and connected
      if (currentUser && !connectionStatus.connected) {
        setPendingChanges(true);
      }
    }
  }, [currentInventory, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    safeLocalStorageSet('foodBankActivity', recentActivity);
    if (recentActivity.length > 0) {
      showAutoSaveStatus('Activity saved');
      // Save to cloud if user is authenticated
      if (currentUser && !connectionStatus.connected) {
        setPendingChanges(true);
      }
    }
  }, [recentActivity, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    safeLocalStorageSet('orderingUnit', orderingUnit);
    // Only explicit saves allowed
  }, [orderingUnit, currentUser]);

  // --- Calculate outgoingMetrics from distributionHistory ---
  useEffect(() => {
    if (!currentUser) return;
    const now = new Date();
    const todayString = now.toISOString().split('T')[0];
    // Start of today (local time)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Start of week (local, Sunday)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    const todaysDistributions = distributionHistory.filter(dist => {
      // Use timestamp, createdAt, or date
      let distDate = null;
      if (dist.createdAt && dist.createdAt.toDate) distDate = dist.createdAt.toDate();
      else if (dist.createdAt && typeof dist.createdAt === 'string') distDate = new Date(dist.createdAt);
      else if (dist.timestamp) distDate = new Date(dist.timestamp);
      else if (dist.date) {
        // Handle date string in YYYY-MM-DD format
        if (typeof dist.date === 'string' && dist.date.includes('-')) {
          distDate = new Date(dist.date + 'T00:00:00');
        } else {
          distDate = new Date(dist.date);
        }
      }
      if (!distDate || isNaN(distDate.getTime())) return false;
      
      // Compare with today's date range (local time)
      const distDateString = distDate.toISOString().split('T')[0];
      return distDateString === todayString;
    });
    
    const weekDistributions = distributionHistory.filter(dist => {
      let distDate = null;
      if (dist.createdAt && dist.createdAt.toDate) distDate = dist.createdAt.toDate();
      else if (dist.createdAt && typeof dist.createdAt === 'string') distDate = new Date(dist.createdAt);
      else if (dist.timestamp) distDate = new Date(dist.timestamp);
      else if (dist.date) {
        // Handle date string in YYYY-MM-DD format
        if (typeof dist.date === 'string' && dist.date.includes('-')) {
          distDate = new Date(dist.date + 'T00:00:00');
        } else {
          distDate = new Date(dist.date);
        }
      }
      if (!distDate || isNaN(distDate.getTime())) return false;
      return distDate >= startOfWeek && distDate <= now;
    });
    
    const totalToday = todaysDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
    const totalWeek = weekDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
    const clientsToday = todaysDistributions.reduce((sum, dist) => sum + (dist.clientsServed || 0), 0);
    const avgSize = distributionHistory.length > 0
      ? distributionHistory.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0) / distributionHistory.length
      : 0;
    
    console.log(`Today's metrics calculation: ${todaysDistributions.length} distributions, ${totalToday} lbs, ${clientsToday} clients`);
    
    setOutgoingMetrics(prev => ({
      ...prev,
      totalDistributedToday: totalToday,
      totalDistributedWeek: totalWeek,
      clientsServedToday: clientsToday,
      avgDistributionSize: avgSize
    }));
  }, [distributionHistory, currentUser]);

  // --- Midnight Reset Timer ---
  useEffect(() => {
    if (!currentUser) return;
    // Calculate ms until next midnight (local time)
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msToMidnight = nextMidnight - now;
    const timer = setTimeout(() => {
      // Explicitly reset today's metrics to zero at midnight
      setOutgoingMetrics(prev => ({
        ...prev,
        totalDistributedToday: 0,
        clientsServedToday: 0
      }));
      console.log('Midnight reset: Today\'s metrics reset to zero');
      
      // Force recalculation by updating distributionHistory (trigger useEffect above)
      setDistributionHistory(d => [...d]);
    }, msToMidnight);
    return () => clearTimeout(timer);
  }, [currentUser, distributionHistory]);

  // --- Daily Date Check ---
  useEffect(() => {
    if (!currentUser) return;
    
    // Check if the date has changed since last calculation
    const today = new Date().toISOString().split('T')[0];
    const lastCalculatedDate = localStorage.getItem(nsKey('lastCalculatedDate'));
    
    if (lastCalculatedDate !== today) {
      console.log('Date changed from', lastCalculatedDate, 'to', today, '- recalculating metrics');
      
      // Update the last calculated date
      localStorage.setItem(nsKey('lastCalculatedDate'), today);
      
      // Force recalculation of today's metrics
      setDistributionHistory(d => [...d]);
    }
  }, [currentUser]);

  // Debug: Log current date and reset status
  useEffect(() => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const lastCalculatedDate = localStorage.getItem(nsKey('lastCalculatedDate'));
    console.log(`[DEBUG] Current date: ${today}, Last calculated: ${lastCalculatedDate || 'never'}`);
    console.log(`[DEBUG] Today's metrics: ${outgoingMetrics.totalDistributedToday} lbs, ${outgoingMetrics.clientsServedToday} clients`);
  }, [currentUser, outgoingMetrics.totalDistributedToday, outgoingMetrics.clientsServedToday]);

  // --- Load distributionHistory from Firestore on login or reload ---
  const reloadDistributionHistoryFromFirestore = async () => {
    if (!currentUser) return;
    setIsLoadingDistributions(true);
    try {
      const history = await firestoreService.getUserDistributions(currentUser.uid, 100); // Reduced from 1000 to 100
      if (Array.isArray(history) && history.length > 0) {
        setDistributionHistory(history);
        safeLocalStorageSet(getDistributionHistoryKey(), history);
        console.log('Set distributionHistory in state:', history);
        // Recalculate today's metrics
        const today = new Date().toISOString().split('T')[0];
        const todaysDistributions = history.filter(dist => dist.date === today);
        const totalToday = todaysDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
        const clientsToday = todaysDistributions.reduce((sum, dist) => sum + (dist.clientsServed || 0), 0);
        setOutgoingMetrics(prev => ({
          ...prev,
          totalDistributedToday: totalToday,
          clientsServedToday: clientsToday
        }));
      } else {
        setDistributionHistory([]);
        setOutgoingMetrics(prev => ({
          ...prev,
          totalDistributedToday: 0,
          clientsServedToday: 0
        }));
        console.log('No distributions found in Firestore.');
      }
    } finally {
      setIsLoadingDistributions(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    // Load from localStorage for instant display
    const key = getDistributionHistoryKey();
    const savedDistributions = safeLocalStorageGet(key, []);
    if (Array.isArray(savedDistributions) && savedDistributions.length > 0) {
      setDistributionHistory(savedDistributions);
    }
    // Then update from Firestore
    reloadDistributionHistoryFromFirestore();
  }, [currentUser]);

  /*
  // --- Calculate outgoingMetrics from distributionHistory ---
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const todaysDistributions = distributionHistory.filter(dist => dist.date === today);
    const weekDistributions = distributionHistory.filter(dist => new Date(dist.date) >= weekAgo);
    const totalToday = todaysDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
    const totalWeek = weekDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
    const clientsToday = todaysDistributions.reduce((sum, dist) => sum + (dist.clientsServed || 0), 0);
    const avgSize = distributionHistory.length > 0
      ? distributionHistory.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0) / distributionHistory.length
      : 0;
    setOutgoingMetrics({
      totalDistributedToday: totalToday,
      totalDistributedWeek: totalWeek,
      clientsServedToday: clientsToday,
      avgDistributionSize: avgSize
    });
  }, [distributionHistory]);
*/

  // Unit conversion functions
  const getUnitWeight = (category, unit) => {
    const unitKey = unit.toUpperCase();
    const config = unitConfig[unitKey];
    if (!config) return 1;
    let weight;
    if (config.categorySpecific && config.categorySpecific[category]) {
      weight = config.categorySpecific[category];
    } else {
      weight = config.baseWeight || 1;
    }
    // Debug log
    console.log(`[UnitConversion] Category: ${category}, Unit: ${unitKey}, Weight used: ${weight}`);
    return weight;
  };

  const convertFromPounds = (weightInPounds, category, targetUnit) => {
    // Always use the latest unitConfigurations for conversion
    const unitWeight = getUnitWeight(category, targetUnit);
    return weightInPounds / unitWeight;
  };

  const formatInventoryValue = (weightInPounds, category) => {
    const unitKey = (orderingUnit || 'POUND').toUpperCase();
    let converted = weightInPounds;
    if (unitKey !== 'POUND') {
      converted = UnitConverters.convertFromStandardWeight(weightInPounds, unitKey, category);
    }
    if (unitKey === 'POUND') {
      return `${converted.toLocaleString()} lbs`;
    } else if (unitKey === 'CASE') {
      return `${converted < 1 ? converted.toFixed(3) : converted.toFixed(1)} cases`;
    } else if (unitKey === 'PALLET') {
      return `${converted < 1 ? converted.toFixed(3) : converted.toFixed(2)} pallets`;
    }
    return `${converted.toLocaleString()} ${orderingUnit}`;
  };

  const getUnitAbbreviation = () => {
    switch (orderingUnit) {
      case 'pounds': return 'lbs';
      case 'cases': return 'cases';
      case 'pallets': return 'pallets';
      default: return orderingUnit;
    }
  };

  const showAutoSaveStatus = (message, isError = false) => {
    // Always show error messages
    if (isError) {
      setAutoSaveStatus({ message, isError });
      setTimeout(() => setAutoSaveStatus(''), 3000);
      return;
    }

    // Only show non-error messages for significant events
    const significantEvents = [
      'Failed to connect to cloud',
      'Sync error',
      'Failed to save to cloud',
      'Export failed',
      'Import failed',
      'Data imported',
      'Backup exported',
      'All data has been reset'
    ];

    if (significantEvents.some(event => message.includes(event))) {
      setAutoSaveStatus({ message, isError });
      setTimeout(() => setAutoSaveStatus(''), 2000);
    }
  };

  // Enhanced export with Firebase data
  const exportAllData = async () => {
    try {
      setAutoSaveStatus({ message: 'Preparing export...', isError: false });
      
      let exportData = {
        inventory: currentInventory,
        activity: recentActivity,
        distributions: distributionHistory,
        orderingUnit: orderingUnit,
        detailedInventory: safeLocalStorageGet('detailedInventory', {}),
        setupComplete: safeLocalStorageGet('foodBankSetupComplete', 'false'),
        exportDate: new Date().toISOString(),
        version: '2.0',
        source: 'local'
      };

      // If user is authenticated, try to get cloud data
      if (currentUser && !connectionStatus.connected) {
        try {
          const cloudData = await firestoreService.exportUserData(currentUser.uid);
          if (cloudData.success) {
            exportData = {
              ...exportData,
              ...cloudData.data,
              source: 'cloud',
              cloudExportDate: cloudData.data.exportDate
            };
            setAutoSaveStatus({ message: 'Cloud data included in export', isError: false });
          }
        } catch (error) {
          console.warn('Could not include cloud data in export:', error);
          setAutoSaveStatus({ message: 'Export using local data only', isError: false });
        }
      }

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `food-bank-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      showAutoSaveStatus('Backup exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      showAutoSaveStatus('Export failed: ' + error.message, true);
    }
  };

  // Enhanced import with Firebase integration
  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (window.confirm('This will replace ALL current data. Are you sure you want to continue?')) {
          setAutoSaveStatus({ message: 'Importing data...', isError: false });

          // Import to local storage first
          if (importedData.inventory) setCurrentInventory(importedData.inventory);
          if (importedData.activity) setRecentActivity(importedData.activity);
          if (importedData.distributions) setDistributionHistory(importedData.distributions);
          
          // Restore localStorage data
          if (importedData.detailedInventory) {
            safeLocalStorageSet('detailedInventory', importedData.detailedInventory);
          }
          if (importedData.setupComplete) {
            safeLocalStorageSet('foodBankSetupComplete', importedData.setupComplete);
            setIsFirstTime(importedData.setupComplete !== 'true');
          }

          // Import to cloud if user is authenticated
          if (currentUser && !connectionStatus.connected) {
            try {
              const cloudImport = await firestoreService.importUserData(currentUser.uid, importedData);
              if (cloudImport.success) {
                showAutoSaveStatus('Data imported to cloud successfully');
              } else {
                showAutoSaveStatus('Local import successful, cloud sync pending', false);
                setPendingChanges(true);
              }
            } catch (error) {
              console.error('Cloud import error:', error);
              showAutoSaveStatus('Local import successful, cloud sync failed', false);
              setPendingChanges(true);
            }
          } else {
            showAutoSaveStatus('Data imported locally');
            if (currentUser) setPendingChanges(true);
          }
        }
      } catch (error) {
        console.error('Error importing data:', error);
        showAutoSaveStatus('Import failed - invalid file format', true);
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  // Performance optimization: Memoized calculations
  const memoizedTotalInventory = React.useMemo(() => {
    return Object.values(currentInventory).reduce((sum, val) => sum + val, 0);
  }, [currentInventory]);

  const memoizedMyPlateCompliance = React.useMemo(() => {
    const total = memoizedTotalInventory;
    if (total === 0) return 'No data yet';

    const vegPercentage = (currentInventory.VEG / total) * 100;
    const fruitPercentage = (currentInventory.FRUIT / total) * 100;
    const proteinPercentage = (currentInventory.PROTEIN / total) * 100;
    const dairyPercentage = (currentInventory.DAIRY / total) * 100;
    const grainPercentage = (currentInventory.GRAIN / total) * 100;
    
    const vegOK = vegPercentage >= 13 && vegPercentage <= 17;
    const fruitOK = fruitPercentage >= 13 && fruitPercentage <= 17;
    const proteinOK = proteinPercentage >= 18 && proteinPercentage <= 22;
    const dairyOK = dairyPercentage >= 2 && dairyPercentage <= 4;
    const grainOK = grainPercentage >= 13 && grainPercentage <= 17;
    
    const compliantCategories = [vegOK, fruitOK, proteinOK, dairyOK, grainOK].filter(Boolean).length;
    return `${compliantCategories}/5 Categories Compliant`;
  }, [currentInventory, memoizedTotalInventory]);

  // System health check
  const performSystemHealthCheck = () => {
    const healthReport = {
      timestamp: new Date().toISOString(),
      localStorage: {
        available: typeof(Storage) !== "undefined",
        usage: 0,
        errors: []
      },
      firebase: {
        connected: !connectionStatus.connected,
        syncStatus: syncStatus,
        lastSync: lastSyncTime,
        pendingChanges: pendingChanges
      },
      data: {
        inventoryItems: Object.keys(currentInventory).length,
        totalWeight: memoizedTotalInventory,
        distributionCount: distributionHistory.length,
        activityCount: recentActivity.length
      },
      performance: {
        renderTime: performance.now(),
        memoryUsage: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : 'Not available'
      }
    };

    // Check localStorage usage
    try {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      healthReport.localStorage.usage = Math.round(totalSize / 1024); // KB
    } catch (error) {
      healthReport.localStorage.errors.push(error.message);
    }

    console.log('System Health Report:', healthReport);
    
    // Show summary to user
    const summary = `
System Health Check:
• Storage: ${healthReport.localStorage.available ? 'Available' : 'Unavailable'} (${healthReport.localStorage.usage}KB used)
• Firebase: ${healthReport.firebase.connected ? 'Connected' : 'Disconnected'} (${healthReport.firebase.syncStatus})
• Data: ${healthReport.data.inventoryItems} categories, ${healthReport.data.distributionCount} distributions
• Performance: ${healthReport.performance.memoryUsage !== 'Not available' ? healthReport.performance.memoryUsage.used + 'MB used' : 'Memory info unavailable'}
    `;
    
    alert(summary);
    return healthReport;
  };

  // --- Distribution Data Management ---
  // Robust validation for distributions
  const validateDistributions = (data) => {
    return Array.isArray(data) && data.every(item =>
      item && typeof item === 'object' &&
      typeof item.date === 'string'
    );
  };

  // Helper to get namespaced key
  const getDistributionHistoryKey = () => currentUser ? `distributionHistory_${currentUser.uid}` : 'distributionHistory';

  // Load distributionHistory from localStorage on mount/login
  const [isLoadingDistributions, setIsLoadingDistributions] = useState(true);
  
  /*
  useEffect(() => {
    if (!currentUser) return;
    const key = getDistributionHistoryKey();
    const savedDistributions = safeLocalStorageGet(key, []);
    console.log('[LOAD] distributionHistory from localStorage:', savedDistributions);
    if (validateDistributions(savedDistributions)) {
      setDistributionHistory(savedDistributions);
      console.log('[LOAD] distributionHistory loaded:', savedDistributions.length, 'records');
    } else {
      setDistributionHistory([]);
      console.log('[LOAD] distributionHistory invalid, reset to empty');
    }
    setIsLoadingDistributions(false);
  }, [currentUser]);
*/

  // Save distributionHistory to localStorage whenever it changes
  useEffect(() => {
    if (!currentUser || isLoadingDistributions) return;
    const key = getDistributionHistoryKey();
    safeLocalStorageSet(key, distributionHistory);
    console.log('[SAVE] distributionHistory to localStorage:', distributionHistory.length, 'records');
  }, [distributionHistory, currentUser, isLoadingDistributions]);

  // Note: Distribution loading is handled by the manual load function above
  // Removed duplicate loading to save quota

  // When a distribution is submitted, always update state and Firestore
  const handleSurveySubmit = async (surveyData) => {
    console.log('Survey data received:', surveyData);
    // Update inventory based on survey data
    setCurrentInventory(prev => {
      const updated = { ...prev };
      if (surveyData.type === 'DISTRIBUTION') {
        Object.entries(surveyData.categoryTotals).forEach(([category, weight]) => {
          updated[category] = Math.max(0, (updated[category] || 0) - weight);
        });
        if (currentUser) {
          debouncedSaveInventory(updated);
        }
      } else if (surveyData.type === 'SINGLE' || surveyData.type === 'BULK') {
        Object.entries(surveyData.categoryTotals).forEach(([category, weight]) => {
          updated[category] = (updated[category] || 0) + weight;
        });
        if (currentUser) {
          debouncedSaveInventory(updated);
        }
      }

      const successMsg = surveyData.type === 'DISTRIBUTION' 
      ? 'Distribution recorded successfully!' 
      : 'Inventory updated successfully!';
      setSuccessMessage(successMsg);
      
      // Clear the success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      return updated;
    });

    // Add to activity feed
    const activityMessage = surveyData.type === 'DISTRIBUTION' 
      ? `Distributed ${surveyData.totalDistributed.toFixed(1)} lbs to ${surveyData.clientsServed || '?'} clients (${surveyData.recipient})`
      : `Added ${surveyData.items?.length || 0} items from ${surveyData.source}`;
    const newActivity = {
      type: surveyData.type,
      message: activityMessage,
      time: 'Just now',
      timestamp: new Date().toISOString()
    };
    setRecentActivity(prev => [newActivity, ...prev.slice(0, 19)]); // Keep last 20 activities

    // Handle distribution tracking
    if (surveyData.type === 'DISTRIBUTION') {
      const distributionRecord = {
        date: surveyData.date || new Date().toISOString().split('T')[0], // Use the date from the form if present
        recipient: surveyData.recipient || 'Unknown',
        totalDistributed: surveyData.totalDistributed || 0,
        clientsServed: surveyData.clientsServed || 0,
        ageGroups: surveyData.ageGroups || { elder: 0, adult: 0, kid: 0 },
        categoryTotals: surveyData.categoryTotals || {},
        items: surveyData.items || [],
        notes: surveyData.notes || '',
        timestamp: new Date().toISOString()
      };
      setDistributionHistory(prev => {
        const updated = [distributionRecord, ...prev];
        const key = getDistributionHistoryKey();
        safeLocalStorageSet(key, updated);
        console.log('[SUBMIT] distribution saved:', distributionRecord);
        console.log('[SUBMIT] ageGroups in distribution:', distributionRecord.ageGroups);
        return updated;
      });
      // Save to Firestore
      if (currentUser) {
        try {
          console.log('Attempting to save distribution to Firestore:', distributionRecord);
          await firestoreService.addDistributionRecord(currentUser.uid, distributionRecord);
          console.log('Successfully saved distribution to Firestore');
        } catch (err) {
          console.error('Failed to save distribution to Firestore:', err);
          showAutoSaveStatus('Failed to save distribution to Firestore', true);
        }
      }
      // Update outgoingMetrics
      // setOutgoingMetrics(prev => ({
      //   ...prev,
      //   totalDistributedToday: prev.totalDistributedToday + (surveyData.totalDistributed || 0),
      //   clientsServedToday: prev.clientsServedToday + (surveyData.clientsServed || 0)
      // }));
    } else if (surveyData.type === 'SINGLE' || surveyData.type === 'BULK') {
      // Handle survey tracking
      const surveyRecord = {
        date: surveyData.date || new Date().toISOString().split('T')[0],
        source: surveyData.source || 'Unknown',
        type: surveyData.type,
        categoryTotals: surveyData.categoryTotals || {},
        items: surveyData.items || [],
        notes: surveyData.notes || '',
        timestamp: new Date().toISOString()
      };
      
      setSurveyHistory(prev => [surveyRecord, ...prev]);
    }

    // Mark as no longer first time
    if (isFirstTime) {
      setIsFirstTime(false);
      safeLocalStorageSet('foodBankSetupComplete', 'true');
    }
  };

  const getTotalInventory = () => {
    return memoizedTotalInventory;
  };

  // Add state for targetCapacity
  const [targetCapacity, setTargetCapacityState] = useState(SYSTEM_CONFIG.TARGET_CAPACITY);

  // Load targetCapacity from Firestore on login
  useEffect(() => {
    if (!currentUser) return;
    firestoreService.getTargetCapacity(currentUser.uid)
      .then((capacity) => {
        setTargetCapacity(capacity);
        setTargetCapacityState(capacity);
      })
      .catch((err) => {
        console.error('Failed to load target capacity from Firestore:', err);
      });
  }, [currentUser]);

  // Function to update targetCapacity in Firestore and state
  const handleUpdateTargetCapacity = async (newCapacity) => {
    setTargetCapacity(newCapacity);
    setTargetCapacityState(newCapacity);
    if (currentUser) {
      try {
        await firestoreService.setTargetCapacity(currentUser.uid, newCapacity);
        showAutoSaveStatus('Target capacity updated!', false);
      } catch (err) {
        console.error('Failed to save target capacity to Firestore:', err);
        showAutoSaveStatus('Failed to update target capacity', true);
      }
    } else {
      showAutoSaveStatus('Target capacity updated!', false);
    }
  };

  // Update getCapacityUtilization to use targetCapacity state
  const getCapacityUtilization = () => {
    const total = memoizedTotalInventory;
    return total > 0 ? ((total / targetCapacity) * 100).toFixed(1) : '0.0';
  };

  const getMyPlateCompliance = () => {
    return memoizedMyPlateCompliance;
  };

  const getNutritionalScore = () => {
    const total = memoizedTotalInventory;
    if (total === 0) return 'No data yet';

    // Calculate percentage of "green" (nutritious) foods
    const greenCategories = ['VEG', 'FRUIT', 'PRODUCE', 'PROTEIN'];
    const greenWeight = greenCategories.reduce((sum, cat) => sum + (currentInventory[cat] || 0), 0);
    const percentage = ((greenWeight / total) * 100).toFixed(1);
    return `${percentage}% Nutritious Foods`;
  };

  // Phase 7A: Enhanced confirmation dialogs
  const showConfirmation = (title, message, onConfirm, type = 'danger') => {
    setConfirmationDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  const closeConfirmation = () => {
    setConfirmationDialog({
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null,
      type: 'danger'
    });
  };

  const resetAllData = () => {
    showConfirmation(
      'Reset All Data',
      'This will permanently delete all your inventory data, distribution history, and settings from both local storage and the cloud. This action cannot be undone. Are you sure you want to continue?',
      async () => {
        try {
          showAutoSaveStatus('Resetting data...', false);
          
          // Clear local storage
          localStorage.clear();
          
          // Reset component state
          setCurrentInventory({
            'DAIRY': 0,
            'GRAIN': 0,
            'PROTEIN': 0,
            'FRUIT': 0,
            'VEG': 0,
            'PRODUCE': 0,
            'MISC': 0
          });
          setRecentActivity([]);
          setDistributionHistory([]);
          setOutgoingMetrics({
            totalDistributedToday: 0,
            clientsServedToday: 0
          });
          setIsFirstTime(true);
          
          // Reset Firebase data if user is authenticated
          if (currentUser) {
            showAutoSaveStatus('Clearing cloud data...', false);
            const result = await firestoreService.resetAllUserData(currentUser.uid);
            
            if (result.success) {
              showAutoSaveStatus('All data has been reset (local and cloud)', false);
            } else {
              showAutoSaveStatus('Local data reset, but cloud deletion failed: ' + result.error, true);
            }
          } else {
            showAutoSaveStatus('All local data has been reset', false);
          }
        } catch (error) {
          console.error('Error during reset:', error);
          showAutoSaveStatus('Reset partially completed - some errors occurred', true);
        }
      }
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  // Guided Tour persistence helpers
  const markTourSeen = () => {
    try {
      if (currentUser) {
        localStorage.setItem(`hasSeenTour_${currentUser.uid}`, 'true');
      } else {
        localStorage.setItem('hasSeenTour_guest', 'true');
      }
    } catch (e) {
      console.error('Failed to persist hasSeenTour flag:', e);
    }
  };

  // Guided Tour Functions
  const handleStartTour = () => {
    setIsTourRunning(true);
    // Mark as seen once user starts the tour to avoid future auto-popups
    markTourSeen();
  };

  const handleCloseTour = () => {
    setShowTour(false);
    setIsTourRunning(false);
    // Persist that the user has seen or dismissed the tour
    markTourSeen();
  };

  // Check if user should see tour on first visit (persisted across refreshes)
  useEffect(() => {
    // Determine key for logged-in user or guest
    const key = currentUser ? `hasSeenTour_${currentUser.uid}` : 'hasSeenTour_guest';
    const hasSeenTour = localStorage.getItem(key);
    if (!hasSeenTour) {
      // Show tour after a short delay to let the page load
      setTimeout(() => {
        setShowTour(true);
      }, 1000);
    }
  }, [currentUser]);

  // Firebase connection state monitoring
  useEffect(() => {
    const unsubscribe = firestoreService.onConnectionStateChange((status) => {
      setConnectionStatus(status);
      setSyncStatus(status.connected ? 'connected' : 'disconnected');
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load inventory from Firestore on initial load if online and authenticated
  useEffect(() => {
    if (currentUser && connectionStatus.connected) {
      firestoreService.getInventory(currentUser.uid)
        .then(data => {
          if (data && data.categories) {
            setCurrentInventory(data.categories);
          } else {
            // No inventory in Firestore, start fresh
            setCurrentInventory({
              'DAIRY': 0,
              'GRAIN': 0,
              'PROTEIN': 0,
              'FRUIT': 0,
              'VEG': 0,
              'PRODUCE': 0,
              'MISC': 0
            });
          }
        })
        .catch(error => {
          console.error('Error loading inventory from Firestore:', error);
          showAutoSaveStatus('Error loading cloud inventory', true);
        });
    }
  }, [currentUser, connectionStatus.connected]);

  // Save daily inventory snapshots for trend analysis
  useEffect(() => {
    if (!currentUser || !connectionStatus.connected) return;

    const today = new Date().toISOString().split('T')[0];
    const lastSnapshotKey = `lastSnapshot_${currentUser.uid}`;
    const lastSnapshotDate = localStorage.getItem(lastSnapshotKey);

    // Only save one snapshot per day
    if (lastSnapshotDate !== today && Object.values(currentInventory).some(val => val > 0)) {
      firestoreService.saveInventorySnapshot(currentUser.uid, currentInventory)
        .then(result => {
          if (result.success) {
            localStorage.setItem(lastSnapshotKey, today);
            console.log('Daily inventory snapshot saved for trend analysis');
          }
        })
        .catch(error => {
          console.error('Error saving inventory snapshot:', error);
        });
    }

    // Cleanup old snapshots once a week (keep 180 days)
    const lastCleanupKey = `lastCleanup_${currentUser.uid}`;
    const lastCleanup = localStorage.getItem(lastCleanupKey);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    if (!lastCleanup || new Date(lastCleanup) < oneWeekAgo) {
      firestoreService.cleanupOldSnapshots(currentUser.uid, 180)
        .then(result => {
          if (result.success && result.deletedCount > 0) {
            localStorage.setItem(lastCleanupKey, today);
            console.log(`Cleaned up ${result.deletedCount} old snapshots`);
          }
        })
        .catch(error => {
          console.error('Error cleaning up old snapshots:', error);
        });
    }
  }, [currentUser, currentInventory, connectionStatus.connected]);

  // Add state for detailedInventory
  const [detailedInventory, setDetailedInventory] = useState({});

  // Load detailedInventory from localStorage on mount
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      try {
        setDetailedInventory(JSON.parse(savedDetailedInventory));
      } catch (error) {
        console.error('[Dashboard] Invalid JSON in localStorage, resetting detailed inventory:', error);
        localStorage.removeItem('detailedInventory'); // Clean up corrupted data
        setDetailedInventory({});
      }
    }
  }, []);

  // Use getCombinedAlerts for dashboard alerts
  const combinedAlerts = getCombinedAlerts({
    currentInventory,
    memoizedTotalInventory,
    outgoingMetrics,
    t,
    detailedInventory,
    UnitConverters,
    targetCapacity
  });

  console.log('Rendering distributionHistory:', distributionHistory);

  // In your main return, show a loading message if isLoadingDistributions is true
  if (isLoadingDistributions) {
    return (
      <div style={{padding: 40, textAlign: 'center'}}>
        <h2>Loading recent distributions...</h2>
      </div>
    );
  }

  // Helper to sort distributions by recency
  const sortDistributionsByRecency = (a, b) => {
    // Prefer createdAt (Firestore Timestamp), then timestamp (ISO string), then date (YYYY-MM-DD)
    const getTime = (dist) => {
      if (dist.createdAt && dist.createdAt.toDate) return dist.createdAt.toDate().getTime();
      if (dist.createdAt && typeof dist.createdAt === 'string') return new Date(dist.createdAt).getTime();
      if (dist.timestamp) return new Date(dist.timestamp).getTime();
      if (dist.date) return new Date(dist.date).getTime();
      return 0;
    };
    return getTime(b) - getTime(a);
  };

  // Helper to parse date string as local date (not UTC)
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  };

  return (
    <>
      {/* Removed: Reload Distributions from Firestore button */}
      <div className="dashboard">
        {/* Auto-save status indicator - subtle and temporary */}
        {autoSaveStatus && (
          <div className={`auto-save-status visible ${autoSaveStatus.isError ? 'error' : ''}`}>
            {autoSaveStatus.message}
          </div>
        )}

        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <div className="logo-container">
                <img 
                  src="/1 copy.png" 
                  alt="FullPlate Logo" 
                  className="logo-image"
                />
              </div>
          {isFirstTime && (
            <div className="help-text-prominent">
              <strong>{t('header.welcome')}</strong>
              <br />
              {t('header.welcome-description')}
            </div>
          )}
            </div>
            <div className="header-right">
              {/* Language Selector */}
              <LanguageSelector />
              
              {/* Tour Button */}
              <button 
                onClick={() => setShowTour(true)}
                className="btn btn-light"
                style={{ minHeight: '36px', padding: '8px 16px' }}
                title={t('tooltip.take-tour')}
              >
                 {t('btn.start-tour')}
              </button>

              <div className="user-profile">
                <div className="user-info">
                  <span className="user-name">
                    {userProfile?.name || currentUser?.displayName || currentUser?.email || 'User'}
                  </span>
                  {userProfile?.organization && (
                    <span className="user-organization">
                      {userProfile.organization}
                    </span>
                  )}
                </div>
                <button onClick={handleLogout} className="btn btn-light" style={{ minHeight: '36px', padding: '8px 16px' }}>
                  {t('header.sign-out')}
                </button>
              </div>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat-card">
              <h3>{t('stats.total-inventory')}</h3>
              <p className="stat-value">
                {getTotalInventory().toLocaleString()} {t('units.lbs')}
              </p>
            </div>
            <div className="stat-card">
              <h3>{t('stats.distributed-today')}</h3>
              <p className="stat-value">{outgoingMetrics.totalDistributedToday.toLocaleString()} {t('units.lbs')}</p>
            </div>
            <div className="stat-card">
              <h3>{t('stats.myplate-compliance')}</h3>
              <p className="stat-value">{getMyPlateCompliance()}</p>
            </div>
            <div className="stat-card">
              <h3>{t('stats.clients-served-today')}</h3>
              <p className="stat-value">{outgoingMetrics.clientsServedToday}</p>
            </div>
            <div className="stat-card critical">
              <h3>{t('stats.critical-alerts')}</h3>
              <p className="stat-value">{combinedAlerts.filter(alert => alert.type === 'CRITICAL').length}</p>
            </div>
            <div className="stat-card warning">
              <h3>{t('stats.warnings')}</h3>
              <p className="stat-value">{combinedAlerts.filter(alert => alert.type === 'WARNING').length}</p>
            </div>
          </div>
        </header>

        {/* Phase 7A: Enhanced Navigation with Icons and Breadcrumbs */}
        <nav className="dashboard-nav">
          <div className="nav-with-icons">
            <button 
              className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('overview');
                setCurrentSection('overview');
              }}
            >
              {t('nav.overview')}
            </button>
            <button 
              className={`nav-tab ${activeTab === 'dataentry' ? 'active' : ''}`}
              data-tab="dataentry"
              onClick={() => {
                setActiveTab('dataentry');
                setCurrentSection('dataentry');
              }}
            >
              {t('nav.food-intake')}
            </button>
            <button 
              className={`nav-tab ${activeTab === 'distribution' ? 'active' : ''}`}
              data-tab="distribution"
              onClick={() => {
                setActiveTab('distribution');
                setCurrentSection('distribution');
              }}
            >
              {t('nav.distribution')}
            </button>
            <button 
              className={`nav-tab ${activeTab === 'myplate' ? 'active' : ''}`}
              data-tab="myplate"
              onClick={() => {
                setActiveTab('myplate');
                setCurrentSection('myplate');
              }}
            >
              {t('nav.myplate')}
            </button>
            <button 
              className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
              data-tab="reports"
              onClick={() => {
                setActiveTab('reports');
                setCurrentSection('reports');
              }}
            >
              {t('nav.reports')}
            </button>
          </div>
          
          {/* Phase 7A: Enhanced Utility Controls with Tooltips */}
          <div className="nav-utils">
            <GlobalSearch 
              onSearch={(result) => {
                showInfo('Search Result', `Found: ${result.title}`);
                // In a real implementation, you would navigate to the result
              }}
              placeholder="Search inventory, distributions, reports..."
            />
            <div className="tooltip-wrapper">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  resetTodayMetrics();
                }} 
                className="btn btn-warning" 
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                {t('btn.reset-today')}
              </button>
              <div className="tooltip">{t('tooltip.reset-today')}</div>
            </div>

            <div className="tooltip-wrapper">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  resetAllData();
                }} 
                className="btn btn-danger" 
                style={{ minWidth: 'auto', padding: '8px 12px' }}
              >
                {t('btn.reset')}
              </button>
              <div className="tooltip">{t('tooltip.reset-all')}</div>
            </div>
          </div>
        </nav>

        <main className="dashboard-content">
          {/* Phase 7A: Breadcrumb Navigation */}
          <div className="breadcrumb">
            <div className="breadcrumb-item">
              <span>{t('breadcrumb.food-bank-manager')}</span>
            </div>
            <span className="breadcrumb-separator">›</span>
            <div className="breadcrumb-item breadcrumb-current">
              {activeTab === 'overview' && (
                <>
                  <span>{t('nav.overview')}</span>
                  {activeOverviewSection !== 'dashboard' && (
                    <>
                      <span className="breadcrumb-separator">›</span>
                      <span>
                        {activeOverviewSection === 'inventory' && t('breadcrumb.inventory-management')}
                        {activeOverviewSection === 'units' && t('breadcrumb.unit-configuration')}
                        {activeOverviewSection === 'reports' && t('breadcrumb.analytics')}
                        {activeOverviewSection === 'distributions' && t('breadcrumb.distribution-history')}
                      </span>
                    </>
                  )}
                </>
              )}
              {activeTab === 'dataentry' && (
                <>
                  <span>{t('nav.food-intake')}</span>
                </>
              )}
              {activeTab === 'distribution' && (
                <>
                  <span>{t('nav.distribution')}</span>
                </>
              )}
              {activeTab === 'myplate' && (
                <>
                  <span>{t('nav.myplate')}</span>
                </>
              )}
              {activeTab === 'reports' && (
                <>
                  <span>{t('nav.reports')}</span>
                </>
              )}
              
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="overview-tab">
              {getTotalInventory() === 0 ? (
                <div className="empty-state">
                  <h2>{t('empty.no-inventory')}</h2>
                  <p>{t('empty.no-inventory-desc')}</p>
                  <button 
                    className="btn btn-primary btn-large"
                    onClick={() => setActiveTab('dataentry')}
                  >
                    {t('empty.start-adding')}
                  </button>
                </div>
              ) : (
                <div className="overview-content">
                  {/* Phase 7A: Enhanced Overview Navigation */}
                  <div className="nav-with-icons" style={{ marginBottom: '24px' }}>
                    <button 
                      className={`nav-tab ${activeOverviewSection === 'dashboard' ? 'active' : ''}`}
                      onClick={() => setActiveOverviewSection('dashboard')}
                    >
                      {t('nav.overview')}
                    </button>
                    <button 
                      className={`nav-tab ${activeOverviewSection === 'inventory' ? 'active' : ''}`}
                      onClick={() => setActiveOverviewSection('inventory')}
                    >
                      {t('subtabs.inventory-management')}
                    </button>
                    <button 
                      className={`nav-tab ${activeOverviewSection === 'units' ? 'active' : ''}`}
                      onClick={() => setActiveOverviewSection('units')}
                    >
                      {t('subtabs.unit-configuration')}
                    </button>
                    <button 
                      className={`nav-tab ${activeOverviewSection === 'reports' ? 'active' : ''}`}
                      onClick={() => setActiveOverviewSection('reports')}
                    >
                      {t('subtabs.analytics')}
                    </button>
                    <button 
                      className={`nav-tab ${activeOverviewSection === 'distributions' ? 'active' : ''}`}
                      onClick={() => setActiveOverviewSection('distributions')}
                    >
                      {t('subtabs.distribution-history')}
                    </button>
                  </div>

                  {/* Dashboard Section */}
                  {activeOverviewSection === 'dashboard' && (
                    <>
                      <div className="overview-grid">
                        <div className="overview-section">
                          <div className="section-header">
                            <h2>{t('dashboard.current-inventory')}</h2>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-700">{t('dashboard.show-in')}</span>
                              <div className="flex rounded-md shadow-sm">
                                <button
                                  onClick={() => setOrderingUnit('POUND')}
                                  className={`px-3 py-1 text-sm font-medium rounded-l-md ${
                                    orderingUnit === 'POUND'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {t('dashboard.pounds')}
                                </button>
                                <button
                                  onClick={() => setOrderingUnit('CASE')}
                                  className={`px-3 py-1 text-sm font-medium ${
                                    orderingUnit === 'CASE'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {t('dashboard.cases')}
                                </button>
                                <button
                                  onClick={() => setOrderingUnit('PALLET')}
                                  className={`px-3 py-1 text-sm font-medium rounded-r-md ${
                                    orderingUnit === 'PALLET'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {t('dashboard.pallets')}
                                </button>
                              </div>
                            </div>
                          </div>
                          {/* Pie Chart Section */}
                          <div style={{ width: '100%', height: 320, margin: '32px 0' }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={110}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                >
                                  {pieData.map((entry) => (
                                    <Cell key={`cell-${entry.name}`} fill={CATEGORY_COLORS[entry.name] || '#343a40'} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${value.toLocaleString()} lbs`} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          {/* End Pie Chart Section */}
                          <div className="category-grid">
                            {Object.entries(currentInventory).map(([category, weight]) => {
                              const total = getTotalInventory();
                              const percentage = total > 0 ? ((weight / total) * 100).toFixed(1) : '0.0';
                              const goalPercentage = MYPLATE_GOALS[category]?.percentage || 0;
                              const status = getCategoryStatus(parseFloat(percentage), goalPercentage);
                              const isOverTarget = status === 'OVER';
                              const isUnderTarget = status === 'UNDER';
                              
                              return (
                                <div key={category} className={`category-card ${isOverTarget ? 'over-target' : isUnderTarget ? 'under-target' : ''}`}>
                                  <h4>{category}</h4>
                                  <p className="weight">{formatInventoryValue(weight, category)}</p>
                                  <p className="percentage">{percentage}%</p>
                                  <div className="category-status">
                                    <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                                  </div>
                                  {orderingUnit !== 'pounds' && (
                                    <p className="weight-conversion">
                                      ({weight.toLocaleString()} lbs)
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="overview-section">
                          <h2>{t('dashboard.critical-alerts-warnings')}</h2>
                          <div className="alerts-feed">
                            {combinedAlerts.length === 0 ? (
                              <div className="no-alerts">
                                <p>{t('dashboard.no-alerts')}</p>
                                <p>{t('dashboard.no-alerts-desc')}</p>
                              </div>
                            ) : (
                              combinedAlerts.slice(0, 8).map((alert, index) => (
                                <div key={index} className={`alert-item ${alert.type.toLowerCase()}`}> 
                                  <div className="alert-icon">
                                    {alert.type}
                                  </div>
                                  <div className="alert-content">
                                    <p className="alert-message">{alert.message}</p>
                                    {alert.action && <p className="alert-action">{alert.action}</p>}
                                  </div>
                                  <div className={`alert-priority ${alert.priority}`}>{alert.priority.toUpperCase()}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Second row with Quick Actions and Recent Distributions */}
                      <div className="overview-grid-compact" style={{ marginTop: '15px' }}>
                        <div className="overview-section">
                          <h2>{t('dashboard.quick-actions')}</h2>
                          <div className="quick-actions">
                            <button 
                              className="btn btn-primary"
                              onClick={() => setActiveTab('dataentry')}
                            >
                              {t('dashboard.add-inventory')}
                            </button>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => setActiveTab('myplate')}
                            >
                              {t('dashboard.check-myplate')}
                            </button>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => setActiveOverviewSection('inventory')}
                            >
                              {t('dashboard.manage-inventory')}
                            </button>
                            <button 
                              className="btn btn-danger"
                              onClick={resetAllData}
                            >
                              {t('dashboard.reset-all-data')}
                            </button>
                          </div>
                        </div>

                        <div className="overview-section">
                          <h2>{t('dashboard.recent-distributions')}</h2>
                          <div className="distribution-feed">
                            {distributionHistory.length === 0 ? (
                              <div className="no-distributions">
                                <p>{t('dashboard.no-distributions')}</p>
                                <p>{t('dashboard.no-distributions-desc')}</p>
                              </div>
                            ) : (
                              distributionHistory.slice().sort(sortDistributionsByRecency).slice(0, 5).map((distribution, index) => (
                                <div key={index} className="distribution-item">
                                  <div className="distribution-icon">OUT</div>
                                  <div className="distribution-content">
                                    <p className="distribution-message">
                                      {distribution.totalDistributed?.toFixed(1)} {t('units.lbs')} to {distribution.recipient}
                                    </p>
                                    <p className="distribution-details">
                                      {distribution.clientsServed} {t('distribution.clients')} • {parseLocalDate(distribution.date).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="distribution-weight">
                                    {distribution.totalDistributed?.toFixed(0)} {t('units.lbs')}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          {distributionHistory.length > 5 && (
                            <button 
                              className="btn btn-secondary"
                              onClick={() => setActiveOverviewSection('distributions')}
                              style={{ marginTop: '16px' }}
                            >
                              {t('dashboard.view-all-distributions')}
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                {/* Inventory Management Section */}
                {activeOverviewSection === 'inventory' && (
          <InventoryManager 
            currentInventory={currentInventory} 
            onNavigate={setActiveTab}
            outgoingMetrics={outgoingMetrics}
            unitConfig={unitConfig}
            distributionHistory={distributionHistory}
          />
        )}

                {/* Unit Configuration Section */}
                {activeOverviewSection === 'units' && (
                  <UnitConfiguration 
                    onConfigurationChange={(configs) => {
                      setUnitConfig(configs);
                    }}
                    currentUser={currentUser}
                    unitConfig={unitConfig}
                  />
                )}

                {/* Analytics Section */}
                {activeOverviewSection === 'reports' && (
                  <div className="analytics-section">
                    <h2>Analytics & Insights</h2>
                    
                    <div className="analytics-grid">
                      <div className="analytics-card">
                        <h3>Capacity Analysis</h3>
                        <div className="capacity-visual">
                          <div className="capacity-bar">
                            <div 
                              className="capacity-fill" 
                              style={{width: `${getCapacityUtilization()}%`}}
                            ></div>
                          </div>
                          <p className="capacity-percentage">{getCapacityUtilization()}%</p>
                        </div>
                        <p>{getTotalInventory().toLocaleString()} / {targetCapacity.toLocaleString()} lbs</p>
                      </div>
                      
                      <div className="analytics-card">
                        <div className="tooltip-wrapper">
                          <h3>Nutritional Quality</h3>
                          <div className="nutrition-score">
                            <div className="score-circle">
                              <span className="score-value">{getNutritionalScore()}</span>
                            </div>
                          </div>
                          <div className="tooltip">
                            <strong>Nutritional Quality</strong><br/>
                            This measures the percentage of nutritious foods (Vegetables, Fruits, Produce, and Protein) in your total inventory.<br/><br/>
                            <strong>Calculation:</strong> (Nutritious Foods Weight / Total Inventory Weight) × 100<br/><br/>
                            <strong>Ideal Range:</strong> 60-80%<br/>
                            • 60%+ = Good nutritional balance<br/>
                            • 70%+ = Excellent nutritional quality<br/>
                            • Below 50% = Consider increasing nutritious food donations
                          </div>
                        </div>
                      </div>
                      
                      <div className="analytics-card">
                        <h3>MyPlate Compliance</h3>
                        <div className="compliance-indicator">
                          <span className="compliance-value">{getMyPlateCompliance()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Distribution History Section */}
                {activeOverviewSection === 'distributions' && (
                  <div className="distribution-history-section">
                    <h2>Distribution History & Analytics</h2>
                    
                    <div className="distribution-metrics">
                      <div className="metric-card">
                        <h3>Today</h3>
                        <p className="metric-value">{outgoingMetrics.totalDistributedToday.toLocaleString()}</p>
                        <p className="metric-label">lbs distributed</p>
                      </div>
                      <div className="metric-card">
                        <h3>This Week</h3>
                        <p className="metric-value">{outgoingMetrics.totalDistributedWeek.toLocaleString()}</p>
                        <p className="metric-label">lbs distributed</p>
                      </div>
                      <div className="metric-card">
                        <h3>Clients Today</h3>
                        <p className="metric-value">{outgoingMetrics.clientsServedToday}</p>
                        <p className="metric-label">people served</p>
                      </div>
                      <div className="metric-card">
                        <h3>Avg Distribution</h3>
                        <p className="metric-value">{outgoingMetrics.avgDistributionSize.toFixed(0)}</p>
                        <p className="metric-label">lbs per event</p>
                      </div>
                    </div>

                    <div className="distribution-list">
                      <h3>Recent Distributions</h3>
                      {distributionHistory.length === 0 ? (
                        <div className="empty-state">
                          <p>No distributions recorded yet. Start tracking outgoing food distributions.</p>
                                                      <button 
                            className="btn btn-primary"
                            onClick={() => setActiveTab('dataentry')}
                          >
                            Record First Distribution
                          </button>
                        </div>
                      ) : (
                        <div className="distribution-table">
                          {distributionHistory.slice().sort(sortDistributionsByRecency).slice(0, 20).map((distribution, index) => (
                            <div key={index} className="distribution-row">
                              <div className="distribution-date">
                                {parseLocalDate(distribution.date).toLocaleDateString()}
                              </div>
                              <div className="distribution-recipient">
                                {distribution.recipient}
                              </div>
                              <div className="distribution-amount">
                                {distribution.totalDistributed?.toFixed(1)} lbs
                              </div>
                              <div className="distribution-clients">
                                {distribution.clientsServed} clients
                                {distribution.ageGroups && (
                                  <div className="age-group-summary">
                                    {distribution.ageGroups.kid > 0 && <span>👶 {distribution.ageGroups.kid}</span>}
                                    {distribution.ageGroups.adult > 0 && <span>👤 {distribution.ageGroups.adult}</span>}
                                    {distribution.ageGroups.elder > 0 && <span>👴 {distribution.ageGroups.elder}</span>}
                                  </div>
                                )}
                              </div>
                              <div className="distribution-categories">
                                {Object.keys(distribution.categoryTotals || {}).length} categories
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dataentry' && (
          <div className="data-entry-tab">
            <SurveyInterface onDataSubmit={handleSurveySubmit} unitConfig={unitConfig} successMessage={successMessage} surveyHistory={surveyHistory} />
            {/* Removed: Distribution log from Food Intake tab */}
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="distribution-tab">
            <DistributionInterface onDataSubmit={handleSurveySubmit} unitConfig={unitConfig} successMessage={successMessage} distributionHistory={distributionHistory}/>
          </div>
        )}

        {activeTab === 'myplate' && (
          <MyPlateCalculator 
            currentInventory={currentInventory} 
            targetCapacity={targetCapacity}
            onUpdateTargetCapacity={handleUpdateTargetCapacity}
            unitConfig={unitConfig}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsInterface 
            distributionHistory={distributionHistory}
            currentInventory={currentInventory}
          />
        )}
      </main>

      {/* Storage Status Indicator */}
      {storageStatus !== 'healthy' && (
        <div className={`storage-status ${storageStatus}`}>
          <div>
            {storageStatus === 'error' ? 'Storage Error' : 'Storage Warning'}
          </div>
          {lastBackupTime && (
            <div className={`backup-indicator ${Date.now() - lastBackupTime.getTime() < 600000 ? 'recent' : ''}`}>
              Last backup: {lastBackupTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Phase 7A: Enhanced Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationDialog.onConfirm}
        title={confirmationDialog.title}
        message={confirmationDialog.message}
        type={confirmationDialog.type}
      />

      {/* Guided Tour */}
      <GuidedTour
        isOpen={showTour || isTourRunning}
        onClose={handleCloseTour}
        onStartTour={handleStartTour}
        onNavigate={setActiveTab}
      />
    </div>
    </>
  );
};

export default Dashboard;