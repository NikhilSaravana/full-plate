import React, { useState, useEffect } from 'react';

// Default unit configurations based on industry standards
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
  BOX: {
    name: 'Box',
    abbreviation: 'BX',
    baseWeight: 15,
    categorySpecific: {
      'DAIRY': 18,
      'GRAIN': 12,
      'PROTEIN': 20,
      'FRUIT': 15,
      'VEG': 16,
      'PRODUCE': 14,
      'MISC': 15
    }
  },
  BAG: {
    name: 'Bag',
    abbreviation: 'BG',
    baseWeight: 5,
    categorySpecific: {
      'DAIRY': 8,
      'GRAIN': 3,
      'PROTEIN': 6,
      'FRUIT': 4,
      'VEG': 5,
      'PRODUCE': 3,
      'MISC': 5
    }
  },
  POUNDS: {
    name: 'Pounds',
    abbreviation: 'LB',
    baseWeight: 1,
    categorySpecific: {}
  }
};

const UnitConfiguration = ({ onConfigUpdate }) => {
  const [unitConfigs, setUnitConfigs] = useState(DEFAULT_UNIT_CONFIGS);
  const [selectedUnit, setSelectedUnit] = useState('PALLET');
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    // Load saved configurations from localStorage
    const savedConfigs = localStorage.getItem('unitConfigurations');
    if (savedConfigs) {
      setUnitConfigs(JSON.parse(savedConfigs));
    }
  }, []);

  useEffect(() => {
    // Notify parent component of configuration updates
    if (onConfigUpdate) {
      onConfigUpdate(unitConfigs);
    }
  }, [unitConfigs, onConfigUpdate]);

  const saveConfigurations = () => {
    localStorage.setItem('unitConfigurations', JSON.stringify(unitConfigs));
    setIsEditing(false);
    setEditingCategory(null);
  };

  const updateUnitWeight = (unitType, category, newWeight) => {
    setUnitConfigs(prev => ({
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
    setUnitConfigs(DEFAULT_UNIT_CONFIGS);
    localStorage.removeItem('unitConfigurations');
  };

  const getEffectiveWeight = (unitType, category = null) => {
    const config = unitConfigs[unitType];
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
        {Object.keys(unitConfigs).map(unitType => (
          <button
            key={unitType}
            className={`unit-tab ${selectedUnit === unitType ? 'active' : ''}`}
            onClick={() => setSelectedUnit(unitType)}
          >
            {unitConfigs[unitType].name} ({unitConfigs[unitType].abbreviation})
          </button>
        ))}
      </div>

      <div className="unit-details">
        <div className="unit-overview">
          <h3>{unitConfigs[selectedUnit].name} Configuration</h3>
          <div className="base-weight-config">
            <label>Base Weight (Default):</label>
            {isEditing ? (
              <input
                type="number"
                step="0.1"
                value={unitConfigs[selectedUnit].baseWeight}
                onChange={(e) => updateUnitWeight(selectedUnit, null, e.target.value)}
                className="weight-input"
              />
            ) : (
              <span className="weight-display">
                {unitConfigs[selectedUnit].baseWeight} lbs
              </span>
            )}
          </div>
        </div>

        <div className="category-specific-weights">
          <h4>Category-Specific Weights</h4>
          <div className="category-weights-grid">
            {Object.entries(unitConfigs[selectedUnit].categorySpecific).map(([category, weight]) => (
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
            {Object.keys(unitConfigs[selectedUnit].categorySpecific).map(category => {
              const weight = getEffectiveWeight(selectedUnit, category);
              return (
                <div key={category} className="example-item">
                  <span className="category-name">{category}:</span>
                  <span className="conversion">
                    1 {unitConfigs[selectedUnit].abbreviation} = {weight} lbs
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
            {Object.entries(unitConfigs).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name} ({config.abbreviation})
              </option>
            ))}
          </select>
          <select className="category-select" id="converter-category">
            <option value="">Default Weight</option>
            {Object.keys(unitConfigs[selectedUnit].categorySpecific).map(category => (
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
                alert(`${quantity} ${unitConfigs[selectedUnit].abbreviation} = ${result} lbs`);
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