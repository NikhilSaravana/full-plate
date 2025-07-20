import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MyPlateCalculator from './MyPlateCalculator';
import InventoryManager from './InventoryManager';
import SurveyInterface from './SurveyInterface';
import DistributionInterface from './DistributionInterface';
import UnitConfiguration from './UnitConfiguration';
import ConfirmationDialog from './ConfirmationDialog';
import firestoreService from '../services/firestoreService';
import { UnitConverters } from './UnitConfiguration';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getCombinedAlerts } from './alertUtils';
import { SYSTEM_CONFIG } from './FoodCategoryMapper';

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
  const { currentUser, logout } = useAuth();

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

  const [activeTab, setActiveTab] = useState('overview');
  const [activeOverviewSection, setActiveOverviewSection] = useState('dashboard');
  const [recentActivity, setRecentActivity] = useState([]);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');

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

  // Remove distributedToday localStorage logic
  // Enhanced Distribution Tracking
  const [distributionHistory, setDistributionHistory] = useState([]);
  const [outgoingMetrics, setOutgoingMetrics] = useState({
    totalDistributedToday: 0,
    totalDistributedWeek: 0,
    clientsServedToday: 0,
    avgDistributionSize: 0
  });

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

  // Firebase Integration State
  const [syncStatus, setSyncStatus] = useState('disconnected'); // 'connected', 'syncing', 'error', 'disconnected'
  const [connectionStatus, setConnectionStatus] = useState({ connected: false });
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(false);

  // Pie chart colors
  const CATEGORY_COLORS = {
    'DAIRY': '#2c5aa0', // Blue
    'GRAIN': '#28a745', // Green
    'PROTEIN': '#ffc107', // Yellow
    'FRUIT': '#dc3545', // Red
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

  // --- Midnight Reset Timer ---
  useEffect(() => {
    if (!currentUser) return;
    // Calculate ms until next midnight
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msToMidnight = nextMidnight - now;
    const timer = setTimeout(() => {
      // setDistributedToday({ value: 0, date: getTodayString() }); // Removed
      // saveDistributedToday(0, getTodayString()); // Removed
      // updateOutgoingMetrics(); // Removed
    }, msToMidnight);
    return () => clearTimeout(timer);
  }, [currentUser]);

  // --- Load distributionHistory from Firestore on login --- REMOVED: This is now handled by the new system above

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

  // Unit conversion functions
  const getUnitWeight = (category, unit) => {
    const unitKey = unit.toUpperCase();
    const config = DEFAULT_UNIT_CONFIGS[unitKey];
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
      typeof item.date === 'string' &&
      typeof item.totalDistributed === 'number'
    );
  };

  // Helper to get namespaced key
  const getDistributionHistoryKey = () => currentUser ? `distributionHistory_${currentUser.uid}` : 'distributionHistory';

  // Load distributionHistory from localStorage on mount/login
  const [isLoadingDistributions, setIsLoadingDistributions] = useState(true);
  
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

  // Save distributionHistory to localStorage whenever it changes
  useEffect(() => {
    if (!currentUser || isLoadingDistributions) return;
    const key = getDistributionHistoryKey();
    safeLocalStorageSet(key, distributionHistory);
    console.log('[SAVE] distributionHistory to localStorage:', distributionHistory.length, 'records');
  }, [distributionHistory, currentUser, isLoadingDistributions]);

  // On login, load from Firestore, but only overwrite if Firestore has data
  useEffect(() => {
    if (currentUser && connectionStatus.connected) {
      firestoreService.getUserDistributions(currentUser.uid, 1000)
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setDistributionHistory(data);
            const key = getDistributionHistoryKey();
            safeLocalStorageSet(key, data);
            console.log('[FIRESTORE] Loaded and saved to localStorage:', data.length, 'records');
          } else if (Array.isArray(data?.data) && data.data.length > 0) {
            setDistributionHistory(data.data);
            const key = getDistributionHistoryKey();
            safeLocalStorageSet(key, data.data);
            console.log('[FIRESTORE] Loaded and saved to localStorage:', data.data.length, 'records');
          } else {
            // Do not overwrite local data if Firestore is empty
            console.log('[FIRESTORE] No distribution data in Firestore, keeping local data');
          }
        })
        .catch(error => {
          console.error('Error loading distribution history from Firestore:', error);
          // Do not clear local data on error
        });
    }
  }, [currentUser, connectionStatus.connected]);

  // When a distribution is submitted, always update state and localStorage
  const handleSurveySubmit = async (surveyData) => {
    console.log('Survey data received:', surveyData);
    
    // Update inventory based on survey data
    setCurrentInventory(prev => {
      const updated = { ...prev };
      
      if (surveyData.type === 'DISTRIBUTION') {
        Object.entries(surveyData.categoryTotals).forEach(([category, weight]) => {
          updated[category] = Math.max(0, (updated[category] || 0) - weight);
        });
        // Explicitly save to Firestore after processing a distribution
        if (currentUser) {
          firestoreService.saveInventory(currentUser.uid, updated);
        }
      } else if (surveyData.type === 'SINGLE' || surveyData.type === 'BULK') {
        Object.entries(surveyData.categoryTotals).forEach(([category, weight]) => {
          updated[category] = (updated[category] || 0) + weight;
        });
        // Explicitly save to Firestore after adding inventory
        if (currentUser) {
          firestoreService.saveInventory(currentUser.uid, updated);
        }
      }
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
        date: new Date().toISOString().split('T')[0],
        recipient: surveyData.recipient || 'Unknown',
        totalDistributed: surveyData.totalDistributed || 0,
        clientsServed: surveyData.clientsServed || 0,
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
        return updated;
      });

      // Save to cloud if connected
      if (currentUser && connectionStatus.connected) {
        try {
          const cloudId = await firestoreService.saveDistribution(currentUser.uid, distributionRecord);
          if (cloudId) {
            // Update local record with cloud ID
            setDistributionHistory(prev => 
              prev.map((dist, index) => 
                index === 0 ? { ...dist, id: cloudId } : dist
              )
            );
          }
        } catch (error) {
          console.error('Failed to save distribution to cloud:', error);
          setPendingChanges(true);
        }
      } else if (currentUser) {
        setPendingChanges(true);
      }
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

  const getCapacityUtilization = () => {
    const total = memoizedTotalInventory;
    const targetCapacity = SYSTEM_CONFIG.TARGET_CAPACITY;
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
      'This will permanently delete all your inventory data, distribution history, and settings. This action cannot be undone. Are you sure you want to continue?',
      () => {
      localStorage.clear();
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
      setIsFirstTime(true);
        showAutoSaveStatus('All data has been reset', false);
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

  // Critical Alerts System with performance optimization
  const getCriticalAlerts = React.useMemo(() => {
    const alerts = [];
    const total = memoizedTotalInventory;
    const targetCapacity = SYSTEM_CONFIG.TARGET_CAPACITY;

    // Low inventory alerts
    Object.entries(currentInventory).forEach(([category, weight]) => {
      const percentage = total > 0 ? (weight / total) * 100 : 0;
      if (percentage < 5 && total > 0) {
        alerts.push({
          type: 'CRITICAL',
          category: 'LOW_INVENTORY',
          message: `${category} inventory critically low (${percentage.toFixed(1)}%)`,
          action: 'Consider immediate restocking',
          priority: 'high'
        });
      } else if (percentage < 10 && total > 0) {
        alerts.push({
          type: 'WARNING',
          category: 'LOW_INVENTORY',
          message: `${category} inventory low (${percentage.toFixed(1)}%)`,
          action: 'Plan for restocking soon',
          priority: 'medium'
        });
      }
    });

    // MyPlate compliance alerts
    const myplateCompliance = { compliantCategories: 0 };
    if (total > 0) {
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
      
      myplateCompliance.compliantCategories = [vegOK, fruitOK, proteinOK, dairyOK, grainOK].filter(Boolean).length;
    }
    if (myplateCompliance.compliantCategories < 3) {
      alerts.push({
        type: 'WARNING',
        category: 'MYPLATE_IMBALANCE',
        message: `Only ${myplateCompliance.compliantCategories}/5 MyPlate categories are balanced`,
        action: 'Review distribution targets',
        priority: 'medium'
      });
    }

    // Capacity alerts
    const utilization = parseFloat(getCapacityUtilization());
    if (utilization > 90) {
      alerts.push({
        type: 'CRITICAL',
        category: 'CAPACITY_WARNING',
        message: `Warehouse at ${utilization}% capacity`,
        action: 'Increase distributions immediately',
        priority: 'high'
      });
    } else if (utilization > 75) {
      alerts.push({
        type: 'WARNING',
        category: 'CAPACITY_WARNING',
        message: `Warehouse at ${utilization}% capacity`,
        action: 'Plan for increased distributions',
        priority: 'medium'
      });
    }

    // Distribution efficiency alerts
    if (outgoingMetrics.totalDistributedToday === 0 && total > 0) {
      alerts.push({
        type: 'WARNING',
        category: 'NO_DISTRIBUTIONS',
        message: 'No distributions recorded today',
        action: 'Consider scheduling distributions to serve community',
        priority: 'medium'
      });
    }

    // Stagnant inventory alerts
    const weeklyDistributionRate = total > 0 ? (outgoingMetrics.totalDistributedWeek / total) * 100 : 0;
    if (weeklyDistributionRate < 5 && total > 10000) {
      alerts.push({
        type: 'WARNING',
        category: 'STAGNANT_INVENTORY',
        message: `Low distribution rate (${weeklyDistributionRate.toFixed(1)}% of inventory distributed this week)`,
        action: 'Increase outreach and distribution activities',
        priority: 'medium'
      });
    }

    // High inventory distribution opportunity
    Object.entries(currentInventory).forEach(([category, weight]) => {
      const percentage = total > 0 ? (weight / total) * 100 : 0;
      if (percentage > 25) {
        alerts.push({
          type: 'INFO',
          category: 'DISTRIBUTION_OPPORTUNITY',
          message: `${category} has high inventory (${percentage.toFixed(1)}%)`,
          action: 'Good opportunity for targeted distribution',
          priority: 'low'
        });
      }
    });

    // Distribution efficiency opportunities
    if (outgoingMetrics.avgDistributionSize > 0 && outgoingMetrics.avgDistributionSize < 100) {
      alerts.push({
        type: 'INFO',
        category: 'DISTRIBUTION_EFFICIENCY',
        message: `Average distribution size is ${outgoingMetrics.avgDistributionSize.toFixed(1)} lbs`,
        action: 'Consider larger bulk distributions for efficiency',
        priority: 'low'
      });
    }

    return alerts.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [currentInventory, memoizedTotalInventory, outgoingMetrics]);

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

  // Add state for detailedInventory
  const [detailedInventory, setDetailedInventory] = useState({});

  // Load detailedInventory from localStorage on mount
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      setDetailedInventory(JSON.parse(savedDetailedInventory));
    }
  }, []);

  // Use getCombinedAlerts for dashboard alerts
  const combinedAlerts = getCombinedAlerts({
    currentInventory,
    memoizedTotalInventory,
    outgoingMetrics,
    detailedInventory,
    UnitConverters
  });

  return (
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
        <h1>Food Bank Inventory Manager</h1>
        {isFirstTime && (
          <div className="help-text-prominent">
            <strong>Welcome to your Food Bank Inventory Manager!</strong>
            <br />
            Get started by clicking the "Food Intake" tab above to record your current food inventory. 
            This system will help you track food donations, manage distributions, and ensure nutritional balance.
          </div>
        )}
          </div>
          <div className="header-right">
            {/* Phase 7A: Enhanced Status Indicator */}
            <div className="sync-status">
              <div className={`status-indicator ${
                syncStatus === 'connected' ? 'status-good' : 
                syncStatus === 'syncing' ? 'status-warning' : 
                syncStatus === 'error' ? 'status-danger' : 'status-info'
              }`}>

                <span>
                  {syncStatus === 'connected' && 'Data Saved'}
                  {syncStatus === 'syncing' && 'Saving...'}
                  {syncStatus === 'disconnected' && 'Working Offline'}
                  {syncStatus === 'error' && 'Save Error'}
                </span>
                {pendingChanges && (
                  <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                    (Changes Pending)
                  </span>
                )}
              </div>
            </div>
            <div className="user-profile">
              <span className="user-name">
                {currentUser?.displayName || currentUser?.email || 'User'}
              </span>
              <button onClick={handleLogout} className="btn btn-light" style={{ minHeight: '36px', padding: '8px 16px' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <h3>Total Inventory</h3>
            <p className="stat-value">
              {getTotalInventory().toLocaleString()} lbs
            </p>
          </div>
          <div className="stat-card">
            <h3>Distributed Today</h3>
            <p className="stat-value">{outgoingMetrics.totalDistributedToday.toLocaleString()} lbs</p>
          </div>
          <div className="stat-card">
            <h3>MyPlate Compliance</h3>
            <p className="stat-value">{getMyPlateCompliance()}</p>
          </div>
          <div className="stat-card">
            <h3>Clients Served Today</h3>
            <p className="stat-value">{outgoingMetrics.clientsServedToday}</p>
          </div>
          <div className="stat-card critical">
            <h3>Critical Alerts</h3>
            <p className="stat-value">{combinedAlerts.filter(alert => alert.type === 'CRITICAL').length}</p>
          </div>
          <div className="stat-card warning">
            <h3>Warnings</h3>
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
            Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'dataentry' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dataentry');
              setCurrentSection('dataentry');
            }}
          >
            Food Intake
          </button>
          <button 
            className={`nav-tab ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('distribution');
              setCurrentSection('distribution');
            }}
          >
            Distribution
          </button>
          <button 
            className={`nav-tab ${activeTab === 'myplate' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('myplate');
              setCurrentSection('myplate');
            }}
          >
            MyPlate Analysis
          </button>
        </div>
        
        {/* Phase 7A: Enhanced Utility Controls with Tooltips */}
        <div className="nav-utils">
          <div className="tooltip-wrapper">
            <button onClick={performSystemHealthCheck} className="btn btn-light" style={{ minWidth: 'auto', padding: '8px 12px' }}>
              Check
          </button>
            <div className="tooltip">System Health Check</div>
          </div>
          <div className="tooltip-wrapper">
            <button onClick={resetAllData} className="btn btn-danger" style={{ minWidth: 'auto', padding: '8px 12px' }}>
              Reset
            </button>
            <div className="tooltip">Reset All Data</div>
          </div>
        </div>
      </nav>

      <main className="dashboard-content">
        {/* Phase 7A: Breadcrumb Navigation */}
        <div className="breadcrumb">
          <div className="breadcrumb-item">
            <span>Food Bank Manager</span>
          </div>
          <span className="breadcrumb-separator">›</span>
          <div className="breadcrumb-item breadcrumb-current">
            {activeTab === 'overview' && (
              <>
                <span>Overview</span>
                {activeOverviewSection !== 'dashboard' && (
                  <>
                    <span className="breadcrumb-separator">›</span>
                    <span>
                      {activeOverviewSection === 'inventory' && 'Inventory Management'}
                      {activeOverviewSection === 'units' && 'Unit Configuration'}
                      {activeOverviewSection === 'reports' && 'Analytics'}
                      {activeOverviewSection === 'distributions' && 'Distribution History'}
                    </span>
                  </>
                )}
              </>
            )}
            {activeTab === 'dataentry' && (
              <>
                <span>Food Intake</span>
              </>
            )}
            {activeTab === 'distribution' && (
              <>
                <span>Distribution</span>
              </>
            )}
            {activeTab === 'myplate' && (
              <>
                <span>MyPlate Analysis</span>
              </>
            )}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="overview-tab">
            {getTotalInventory() === 0 ? (
              <div className="empty-state">
                <h2>No Inventory Data Yet</h2>
                <p>Get started by adding your current inventory using the "Data Entry" tab.</p>
                <button 
                  className="btn btn-primary btn-large"
                  onClick={() => setActiveTab('dataentry')}
                >
                  Start Adding Inventory
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
                    Dashboard
                  </button>
                  <button 
                    className={`nav-tab ${activeOverviewSection === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveOverviewSection('inventory')}
                  >
                    Inventory
                  </button>
                  <button 
                    className={`nav-tab ${activeOverviewSection === 'units' ? 'active' : ''}`}
                    onClick={() => setActiveOverviewSection('units')}
                  >
                    Units
                  </button>
                  <button 
                    className={`nav-tab ${activeOverviewSection === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveOverviewSection('reports')}
                  >
                    Analytics
                  </button>
                  <button 
                    className={`nav-tab ${activeOverviewSection === 'distributions' ? 'active' : ''}`}
                    onClick={() => setActiveOverviewSection('distributions')}
                  >
                    Distributions
                  </button>
                </div>

                {/* Dashboard Section */}
                {activeOverviewSection === 'dashboard' && (
              <div className="overview-grid">
                <div className="overview-section">
                      <div className="section-header">
                  <h2>Current Inventory Distribution</h2>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-700">Show in:</span>
                          <div className="flex rounded-md shadow-sm">
                            <button
                              onClick={() => setOrderingUnit('POUND')}
                              className={`px-3 py-1 text-sm font-medium rounded-l-md ${
                                orderingUnit === 'POUND'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              Pounds
                            </button>
                            <button
                              onClick={() => setOrderingUnit('CASE')}
                              className={`px-3 py-1 text-sm font-medium ${
                                orderingUnit === 'CASE'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              Cases
                            </button>
                            <button
                              onClick={() => setOrderingUnit('PALLET')}
                              className={`px-3 py-1 text-sm font-medium rounded-r-md ${
                                orderingUnit === 'PALLET'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              Pallets
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
                      const isOverTarget = parseFloat(percentage) > 20;
                      const isUnderTarget = parseFloat(percentage) < 5 && total > 0;
                      
                      return (
                        <div key={category} className={`category-card ${isOverTarget ? 'over-target' : isUnderTarget ? 'under-target' : ''}`}>
                          <h4>{category}</h4>
                              <p className="weight">{formatInventoryValue(weight, category)}</p>
                          <p className="percentage">{percentage}%</p>
                          <div className="category-status">
                            {isOverTarget && <span className="status-badge over">OVER</span>}
                            {isUnderTarget && <span className="status-badge under">UNDER</span>}
                            {!isOverTarget && !isUnderTarget && <span className="status-badge okay">OKAY</span>}
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
                      <h2>Critical Alerts & Warnings</h2>
                      <div className="alerts-feed">
                        {combinedAlerts.length === 0 ? (
                          <div className="no-alerts">
                            <p>No critical alerts at this time</p>
                            <p>All systems are operating within normal parameters.</p>
                          </div>
                        ) : (
                          combinedAlerts.slice(0, 8).map((alert, index) => (
                            <div key={index} className={`alert-item ${alert.type ? alert.type.toLowerCase() : alert.severity}`}> 
                              <div className="alert-icon">
                                {alert.type || alert.severity}
                              </div>
                              <div className="alert-content">
                                <p className="alert-message">{alert.message}</p>
                                {alert.action && <p className="alert-action">{alert.action}</p>}
                              </div>
                              <div className={`alert-priority ${alert.priority || alert.severity}`}>{(alert.priority || alert.severity)?.toUpperCase()}</div>
                            </div>
                          ))
                        )}
                      </div>
                </div>

                <div className="overview-section">
                  <h2>Quick Actions</h2>
                  <div className="quick-actions">
                    <button 
                      className="btn btn-primary"
                          onClick={() => setActiveTab('dataentry')}
                    >
                      Add Inventory
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setActiveTab('myplate')}
                    >
                      Check MyPlate
                    </button>
                    <button 
                      className="btn btn-secondary"
                          onClick={() => setActiveOverviewSection('inventory')}
                    >
                          Manage Inventory
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={resetAllData}
                    >
                      Reset All Data
                    </button>
                  </div>
                </div>

                    <div className="overview-section">
                      <h2>Recent Distributions</h2>
                      <div className="distribution-feed">
                        {distributionHistory.length === 0 ? (
                          <div className="no-distributions">
                            <p>No distributions recorded yet</p>
                            <p>Start recording distributions to track outgoing food.</p>
              </div>
                        ) : (
                          distributionHistory.slice(0, 5).map((distribution, index) => (
                            <div key={index} className="distribution-item">
                              <div className="distribution-icon">OUT</div>
                              <div className="distribution-content">
                                <p className="distribution-message">
                                  {distribution.totalDistributed?.toFixed(1)} lbs to {distribution.recipient}
                                </p>
                                <p className="distribution-details">
                                  {distribution.clientsServed} clients • {new Date(distribution.date).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="distribution-weight">
                                {distribution.totalDistributed?.toFixed(0)} lbs
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
                          View All Distributions
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Inventory Management Section */}
                {activeOverviewSection === 'inventory' && (
          <InventoryManager 
            currentInventory={currentInventory} 
            onNavigate={setActiveTab}
          />
        )}

                {/* Unit Configuration Section */}
                {activeOverviewSection === 'units' && (
                  <UnitConfiguration 
                    onConfigurationChange={(configs) => {
                      setOrderingUnit(configs.orderingUnit);
                    }}
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
                        <p>{getTotalInventory().toLocaleString()} / {SYSTEM_CONFIG.TARGET_CAPACITY.toLocaleString()} lbs</p>
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
                          {distributionHistory.slice(0, 20).map((distribution, index) => (
                            <div key={index} className="distribution-row">
                              <div className="distribution-date">
                                {new Date(distribution.date).toLocaleDateString()}
                              </div>
                              <div className="distribution-recipient">
                                {distribution.recipient}
                              </div>
                              <div className="distribution-amount">
                                {distribution.totalDistributed?.toFixed(1)} lbs
                              </div>
                              <div className="distribution-clients">
                                {distribution.clientsServed} clients
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
            <SurveyInterface onDataSubmit={handleSurveySubmit} />
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="distribution-tab">
            <DistributionInterface onDataSubmit={handleSurveySubmit} />
          </div>
        )}

        {activeTab === 'myplate' && (
          <MyPlateCalculator currentInventory={currentInventory} />
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
    </div>
  );
};

export default Dashboard;
