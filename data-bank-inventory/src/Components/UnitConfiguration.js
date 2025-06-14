import React, { useState, useEffect } from 'react';

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

const UnitConfiguration = ({ onConfigurationChange }) => {
  const [configurations, setConfigurations] = useState({
    PALLET: {
      baseWeight: 2000,
      categorySpecific: {
        'Canned Goods': 2200,
        'Dry Goods': 1800,
        'Fresh Produce': 1500,
        'Dairy': 1600,
        'Meat': 1700,
        'Bakery': 1400
      }
    },
    CASE: {
      baseWeight: 50,
      categorySpecific: {
        'Canned Goods': 60,
        'Dry Goods': 45,
        'Fresh Produce': 40,
        'Dairy': 35,
        'Meat': 55,
        'Bakery': 30
      }
    },
    POUNDS: {
      baseWeight: 1,
      categorySpecific: {}
    }
  });

  const [selectedUnit, setSelectedUnit] = useState('PALLET');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Load configurations from localStorage on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem('unitConfigurations');
      if (saved) {
        const parsedConfigs = JSON.parse(saved);
        setConfigurations(parsedConfigs);
      }
    } catch (error) {
      console.error('Error loading unit configurations:', error);
    }
  }, []);

  // Save configurations and notify parent when they change
  useEffect(() => {
    try {
      localStorage.setItem('unitConfigurations', JSON.stringify(configurations));
      if (onConfigurationChange) {
        onConfigurationChange(configurations);
      }
    } catch (error) {
      console.error('Error saving unit configurations:', error);
    }
  }, [configurations, onConfigurationChange]);

  const saveConfigurations = () => {
    localStorage.setItem('unitConfigurations', JSON.stringify(configurations));
    setIsEditing(false);
    setEditingCategory(null);
  };

  const updateUnitWeight = (unitType, category, newWeight) => {
    setConfigurations(prev => ({
      ...prev,
      [unitType]: {
        ...prev[unitType],
        [category ? 'categorySpecific' : 'baseWeight']: category 
          ? { ...prev[unitType].categorySpecific, [category]: parseFloat(newWeight) }
          : parseFloat(newWeight)
      }
    }));
  };

  const resetToDefaults = () => {
    setConfigurations(DEFAULT_UNIT_CONFIGS);
    localStorage.removeItem('unitConfigurations');
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
        {Object.keys(configurations).map(unitType => (
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
          <h3>{configurations[selectedUnit].name} Configuration</h3>
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
            {Object.entries(configurations[selectedUnit].categorySpecific).map(([category, weight]) => (
              <div key={category} className="category-weight-item">
                <label>{category}:</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => updateUnitWeight(selectedUnit, category, e.target.value)}
                    className="weight-input"
                  />
                ) : (
                  <span className="weight-display">{weight} lbs</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="conversion-examples">
          <h4>Conversion Examples</h4>
          <div className="examples-grid">
            {Object.keys(configurations[selectedUnit].categorySpecific).map(category => {
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
            {Object.keys(configurations[selectedUnit].categorySpecific).map(category => (
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
    const config = configs[unitType];
    if (!config) return quantity;
    
    const weight = category && config.categorySpecific[category] 
      ? config.categorySpecific[category] 
      : config.baseWeight;
    return quantity * weight;
  },
  
  convertFromStandardWeight: (weightInPounds, unitType, category = null) => {
    const configs = UnitConverters.getUnitConfigs();
    const config = configs[unitType];
    if (!config) return weightInPounds;
    
    const weight = category && config.categorySpecific[category] 
      ? config.categorySpecific[category] 
      : config.baseWeight;
    return weightInPounds / weight;
  },
  
  getAvailableUnits: () => {
    const configs = UnitConverters.getUnitConfigs();
    return Object.entries(configs).map(([key, config]) => ({
      key,
      name: config.name,
      abbreviation: config.abbreviation
    }));
  }
};

export default UnitConfiguration; 