import React, { useState, useEffect } from 'react';
import firestoreService from '../services/firestoreService';

// Simplified unit configurations - only Pallet, Case, and Pounds
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

const EDITABLE_CATEGORIES = [
  'GRAIN', 'PROTEIN', 'DAIRY', 'FRUIT', 'VEG', 'PRODUCE', 'MISC'
];

const UnitConfiguration = ({ onConfigurationChange, currentUser, unitConfig }) => {
  // Helper for namespaced key
  const getUnitConfigKey = () => currentUser ? `unitConfigurations_${currentUser.uid}` : 'unitConfigurations';

  const [configurations, setConfigurations] = useState(DEFAULT_UNIT_CONFIGS);
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('PALLET');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [hasLoadedFromFirestore, setHasLoadedFromFirestore] = useState(false);
  const [lastSavedConfig, setLastSavedConfig] = useState(null);

  // Always fetch from Firestore on user change
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentUser) return;
      setLoading(true);
      const key = getUnitConfigKey();
      let loaded = null;
      try {
        const prefs = await firestoreService.getUserPreferences(currentUser.uid);
        console.log('[UnitConfig] Firestore getUserPreferences:', prefs);
        if (prefs.success && prefs.data && prefs.data.unitConfigurations) {
          loaded = prefs.data.unitConfigurations;
          localStorage.setItem(key, JSON.stringify(loaded));
        } else {
          // Fallback to localStorage if Firestore is empty
          const saved = localStorage.getItem(key);
          if (saved) {
            loaded = JSON.parse(saved);
          }
        }
        if (loaded) {
          setConfigurations(loaded);
          setLastSavedConfig(JSON.stringify(loaded));
        }
        setHasLoadedFromFirestore(true);
      } catch (error) {
        console.error('[UnitConfig] Error loading unit configurations:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
    // eslint-disable-next-line
  }, [currentUser]);

  // Save config to localStorage and Firestore only if changed and not on initial load
  useEffect(() => {
    if (!currentUser || !hasLoadedFromFirestore) return;
    const key = getUnitConfigKey();
    const configString = JSON.stringify(configurations);
    if (configString === lastSavedConfig) return; // No change
    try {
      localStorage.setItem(key, configString);
      firestoreService.saveUserPreferences(currentUser.uid, { unitConfigurations: configurations });
      setLastSavedConfig(configString);
      console.log('[UnitConfig] Saved to Firestore and localStorage:', configurations);
      if (onConfigurationChange) {
        onConfigurationChange(configurations);
      }
    } catch (error) {
      console.error('[UnitConfig] Error saving unit configurations:', error);
    }
  }, [configurations, currentUser, hasLoadedFromFirestore, onConfigurationChange, lastSavedConfig]);

  useEffect(() => {
    if (unitConfig) {
      setConfigurations(unitConfig);
    }
  }, [unitConfig]);

  const saveConfigurations = () => {
    if (!currentUser) return;
    const key = getUnitConfigKey();
    localStorage.setItem(key, JSON.stringify(configurations));
    firestoreService.saveUserPreferences(currentUser.uid, { unitConfigurations: configurations });
    setLastSavedConfig(JSON.stringify(configurations));
    setIsEditing(false);
    setEditingCategory(null);
    console.log('[UnitConfig] saveConfigurations called');
  };

  const updateUnitWeight = (unitType, category, newWeight) => {
    setConfigurations(prev => {
      const updated = { ...prev };
      updated[unitType] = {
        ...updated[unitType],
        categorySpecific: {
          ...updated[unitType].categorySpecific,
          [category]: newWeight
        }
      };
      return updated;
    });
  };

  const resetToDefaults = () => {
    if (!currentUser) return;
    const key = getUnitConfigKey();
    localStorage.removeItem(key);
    setConfigurations(DEFAULT_UNIT_CONFIGS);
    firestoreService.saveUserPreferences(currentUser.uid, { unitConfigurations: DEFAULT_UNIT_CONFIGS });
    setLastSavedConfig(JSON.stringify(DEFAULT_UNIT_CONFIGS));
    console.log('[UnitConfig] resetToDefaults called');
  };

  const getEffectiveWeight = (unitType, category = null) => {
    const config = configurations[unitType];
    if (!config) return 1;
    
    if (category && config.categorySpecific[category]) {
      return config.categorySpecific[category];
    }
    return config.baseWeight;
  };

  const convertToStandardWeight = (quantity, unitType, category = null) => {
    return quantity * getEffectiveWeight(unitType, category);
  };

  const convertFromStandardWeight = (weightInPounds, unitType, category = null) => {
    const unitWeight = getEffectiveWeight(unitType, category);
    return weightInPounds / unitWeight;
  };

  if (loading) {
    return <div style={{padding: 40, textAlign: 'center'}}><h2>Loading unit configuration...</h2></div>;
  }

  return (
    <div className="unit-configuration">
      <div className="config-header">
        <h2>Unit Configuration Manager</h2>
        <div className="config-actions">
          <button 
            className={`edit-btn ${isEditing ? 'active' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'View Mode' : 'Edit Mode'}
          </button>
          <button className="reset-btn" onClick={resetToDefaults}>
            Reset to Defaults
          </button>
          {isEditing && (
            <button className="save-btn" onClick={saveConfigurations}>
              Save Changes
            </button>
          )}
        </div>
      </div>

      <div className="unit-tabs">
        {["PALLET", "CASE"].map(unitType => (
          <button
            key={unitType}
            className={`unit-tab ${selectedUnit === unitType ? 'active' : ''}`}
            onClick={() => setSelectedUnit(unitType)}
          >
            {configurations[unitType].name} ({configurations[unitType].abbreviation})
          </button>
        ))}
      </div>

      <div className="unit-details">
        <div className="unit-overview">
          <h3>{selectedUnit === 'PALLET' ? 'Pallet Configuration' : 'Case Configuration'}</h3>
          <div className="base-weight-config">
            <label>Base Weight (Default):</label>
            {isEditing ? (
              <input
                type="number"
                step="0.1"
                value={configurations[selectedUnit].baseWeight}
                onChange={(e) => updateUnitWeight(selectedUnit, null, e.target.value)}
                className="weight-input"
              />
            ) : (
              <span className="weight-display">
                {configurations[selectedUnit].baseWeight} lbs
              </span>
            )}
          </div>
        </div>

        <div className="category-specific-weights">
          <h4>Category-Specific Weights</h4>
          <div className="category-weights-grid">
            {EDITABLE_CATEGORIES.map(category => (
              <div key={category} className="category-weight-item">
                <label>{category}:</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.1"
                    value={configurations[selectedUnit].categorySpecific[category]}
                    onChange={(e) => updateUnitWeight(selectedUnit, category, e.target.value)}
                    className="weight-input"
                  />
                ) : (
                  <span className="weight-display">{configurations[selectedUnit].categorySpecific[category]} lbs</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="conversion-examples">
          <h4>Conversion Examples</h4>
          <div className="examples-grid">
            {EDITABLE_CATEGORIES.map(category => {
              const weight = getEffectiveWeight(selectedUnit, category);
              return (
                <div key={category} className="example-item">
                  <span className="category-name">{category}:</span>
                  <span className="conversion">
                    1 {configurations[selectedUnit].abbreviation} = {weight} lbs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="quick-converter">
        <h4>Quick Converter</h4>
        <div className="converter-inputs">
          <input 
            type="number" 
            placeholder="Quantity"
            className="quantity-input"
            id="converter-quantity"
          />
          <select 
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="unit-select"
          >
            {Object.entries(configurations).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name} ({config.abbreviation})
              </option>
            ))}
          </select>
          <select className="category-select" id="converter-category">
            <option value="">Default Weight</option>
            {EDITABLE_CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button 
            className="convert-btn"
            onClick={() => {
              const quantity = document.getElementById('converter-quantity').value;
              const category = document.getElementById('converter-category').value;
              if (quantity) {
                const result = convertToStandardWeight(parseFloat(quantity), selectedUnit, category || null);
                alert(`${quantity} ${configurations[selectedUnit].abbreviation} = ${result} lbs`);
              }
            }}
          >
            Convert to Pounds
          </button>
        </div>
      </div>
    </div>
  );
};

// Export utility functions for use in other components
export const UnitConverters = {
  getUnitConfigs: () => {
    const saved = localStorage.getItem('unitConfigurations');
    return saved ? JSON.parse(saved) : DEFAULT_UNIT_CONFIGS;
  },
  
  convertToStandardWeight: (quantity, unitType, category = null) => {
    const configs = UnitConverters.getUnitConfigs();
    const unitKey = unitType.toUpperCase();
    const config = configs[unitKey];
    if (!config) return quantity;
    
    const weight = category && config.categorySpecific[category] 
      ? config.categorySpecific[category] 
      : config.baseWeight;
    return quantity * weight;
  },
  
  convertFromStandardWeight: (weightInPounds, unitType, category = null) => {
    const configs = UnitConverters.getUnitConfigs();
    const unitKey = unitType.toUpperCase();
    const config = configs[unitKey];
    if (!config) return weightInPounds;
    
    const weight = category && config.categorySpecific[category] 
      ? config.categorySpecific[category] 
      : config.baseWeight;
    return weightInPounds / weight;
  },
  
  getAvailableUnits: () => {
    const configs = UnitConverters.getUnitConfigs();
    return Object.entries(configs).map(([key, config]) => ({
      key: key.toUpperCase(),
      name: config.name,
      abbreviation: config.abbreviation
    }));
  }
};

// Add getUnitConverters as a named export for dynamic config usage
export const getUnitConverters = (unitConfig) => ({
  convertToStandardWeight: (quantity, unitType, category = null) => {
    const configs = unitConfig;
    const unitKey = unitType.toUpperCase();
    const config = configs[unitKey];
    if (!config) return quantity;
    const weight = category && config.categorySpecific && config.categorySpecific[category]
      ? config.categorySpecific[category]
      : config.baseWeight;
    return quantity * weight;
  },
  convertFromStandardWeight: (weightInPounds, unitType, category = null) => {
    const configs = unitConfig;
    const unitKey = unitType.toUpperCase();
    const config = configs[unitKey];
    if (!config) return weightInPounds;
    const weight = category && config.categorySpecific && config.categorySpecific[category]
      ? config.categorySpecific[category]
      : config.baseWeight;
    return weightInPounds / weight;
  },
  getAvailableUnits: () => {
    const configs = unitConfig;
    return Object.entries(configs).map(([key, config]) => ({
      key: key.toUpperCase(),
      name: config.name,
      abbreviation: config.abbreviation
    }));
  },
  getUnitConfigs: () => unitConfig
});

export default UnitConfiguration; 