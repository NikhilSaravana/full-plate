import React, { useState } from 'react';
import { FOOD_CATEGORY_MAPPING, getMyPlateCategory } from './FoodCategoryMapper';
import { UnitConverters } from './UnitConfiguration';

const SurveyInterface = ({ onDataSubmit }) => {
  const [surveyMode, setSurveyMode] = useState('SINGLE'); // SINGLE, BULK, DISTRIBUTION
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    source: 'Direct Donation',
    notes: ''
  });
  const [items, setItems] = useState([
    { foodType: '', quantity: '', unit: 'POUNDS', expirationDate: '', notes: '' }
  ]);
  const [bulkData, setBulkData] = useState('');
  const [distributionData, setDistributionData] = useState({
    totalDistributed: '',
    unit: 'POUNDS',
    clientsServed: '',
    avgFamilySize: '3',
    categories: {}
  });

  const availableUnits = UnitConverters.getAvailableUnits();

  const addItem = () => {
    setItems([...items, { foodType: '', quantity: '', unit: 'POUNDS', expirationDate: '', notes: '' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const getWeightInPounds = (quantity, unit, category = null) => {
    if (!quantity || !unit) return 0;
    if (unit === 'POUNDS') return parseFloat(quantity);
    return UnitConverters.convertToStandardWeight(parseFloat(quantity), unit, category);
  };

  const handleBulkDataParse = () => {
    try {
      // Parse CSV-like data: "Food Type, Quantity, Unit, Expiration"
      const lines = bulkData.split('\n').filter(line => line.trim());
      const parsedItems = lines.map(line => {
        const parts = line.split(',').map(part => part.trim());
        return {
          foodType: parts[0] || '',
          quantity: parts[1] || '',
          unit: parts[2] || 'POUNDS',
          expirationDate: parts[3] || '',
          notes: parts[4] || ''
        };
      });
      setItems(parsedItems);
      setBulkData('');
      setSurveyMode('SINGLE');
    } catch (error) {
      alert('Error parsing bulk data. Please check format.');
    }
  };

  const submitSurvey = () => {
    if (surveyMode === 'SINGLE' && items.some(item => !item.foodType || !item.quantity)) {
      alert('Please fill in all required fields');
      return;
    }

    const surveyData = {
      type: surveyMode,
      date: formData.date,
      source: formData.source,
      notes: formData.notes,
      items: surveyMode === 'DISTRIBUTION' ? null : items,
      distribution: surveyMode === 'DISTRIBUTION' ? distributionData : null,
      timestamp: new Date().toISOString()
    };

    // Calculate totals by MyPlate category (converting all to pounds)
    if (surveyMode !== 'DISTRIBUTION') {
      const categoryTotals = {};
      items.forEach(item => {
        if (item.foodType && item.quantity) {
          const category = getMyPlateCategory(item.foodType);
          const weightInPounds = getWeightInPounds(item.quantity, item.unit, category);
          categoryTotals[category] = (categoryTotals[category] || 0) + weightInPounds;
        }
      });
      surveyData.categoryTotals = categoryTotals;
      
      // Add converted weights for reference
      surveyData.itemsWithConvertedWeights = items.map(item => ({
        ...item,
        weightInPounds: item.quantity ? getWeightInPounds(item.quantity, item.unit, getMyPlateCategory(item.foodType)) : 0
      }));
    }

    if (onDataSubmit) {
      onDataSubmit(surveyData);
    }

    // Reset form
    setItems([{ foodType: '', quantity: '', unit: 'POUNDS', expirationDate: '', notes: '' }]);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      source: 'Direct Donation',
      notes: ''
    });
    setDistributionData({
      totalDistributed: '',
      unit: 'POUNDS',
      clientsServed: '',
      avgFamilySize: '3',
      categories: {}
    });

    alert('Survey data submitted successfully!');
  };

  const getFoodTypeOptions = () => {
    return Object.keys(FOOD_CATEGORY_MAPPING).sort();
  };

  const getQuickAddButtons = () => {
    const commonItems = [
      'BREAD', 'MILK', 'RICE', 'PASTA', 'CHICKEN', 'BEANS', 
      'CORN', 'FRUIT', 'VEGETABLES', 'CEREAL', 'CHEESE', 'EGGS'
    ];
    return commonItems;
  };

  const calculateTotalWeight = () => {
    return items.reduce((total, item) => {
      if (item.quantity && item.foodType) {
        const category = getMyPlateCategory(item.foodType);
        return total + getWeightInPounds(item.quantity, item.unit, category);
      }
      return total;
    }, 0);
  };

  const getUnitDisplayWeight = (quantity, unit, category) => {
    if (!quantity || !unit) return '';
    const weightInPounds = getWeightInPounds(quantity, unit, category);
    if (unit === 'POUNDS') {
      return `${quantity} lbs`;
    }
    return `${quantity} ${availableUnits.find(u => u.key === unit)?.abbreviation} (${weightInPounds.toFixed(1)} lbs)`;
  };

  return (
    <div className="survey-interface">
      <div className="survey-header">
        <h2>Data Entry Survey</h2>
        <div className="mode-selector">
          <button
            className={surveyMode === 'SINGLE' ? 'active' : ''}
            onClick={() => setSurveyMode('SINGLE')}
          >
            Single Entry
          </button>
          <button
            className={surveyMode === 'BULK' ? 'active' : ''}
            onClick={() => setSurveyMode('BULK')}
          >
            Bulk Import
          </button>
          <button
            className={surveyMode === 'DISTRIBUTION' ? 'active' : ''}
            onClick={() => setSurveyMode('DISTRIBUTION')}
          >
            Distribution Log
          </button>
        </div>
      </div>

      <div className="survey-form">
        {/* Common Form Fields */}
        <div className="form-section">
          <h3>General Information</h3>
          <div className="form-grid">
            <div className="form-field">
              <label>Date:</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label>Source:</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
              >
                <option value="Direct Donation">Direct Donation</option>
                <option value="NTFB AE">NTFB AE</option>
                <option value="Local Farm">Local Farm</option>
                <option value="Food Drive">Food Drive</option>
                <option value="Purchase">Purchase</option>
                <option value="Government">Government Program</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Notes:</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional notes or comments..."
              rows="3"
            />
          </div>
        </div>

        {/* Single Entry Mode */}
        {surveyMode === 'SINGLE' && (
          <div className="form-section">
            <div className="section-header">
              <h3>Inventory Items</h3>
              <div className="quick-add">
                <span>Quick Add:</span>
                {getQuickAddButtons().map(item => (
                  <button
                    key={item}
                    className="quick-add-btn"
                    onClick={() => {
                      const newItem = { foodType: item, quantity: '', unit: 'POUNDS', expirationDate: '', notes: '' };
                      setItems([...items, newItem]);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="item-inputs">
                  <select
                    value={item.foodType}
                    onChange={(e) => updateItem(index, 'foodType', e.target.value)}
                    className="food-type-select"
                  >
                    <option value="">Select Food Type</option>
                    {getFoodTypeOptions().map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className="unit-select"
                  >
                    {availableUnits.map(unit => (
                      <option key={unit.key} value={unit.key}>
                        {unit.name} ({unit.abbreviation})
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    placeholder="Expiration"
                    value={item.expirationDate}
                    onChange={(e) => updateItem(index, 'expirationDate', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={item.notes}
                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  />
                  <div className="item-preview">
                    <span className="category-preview">
                      {item.foodType ? getMyPlateCategory(item.foodType) : ''}
                    </span>
                    <span className="weight-preview">
                      {item.quantity && item.foodType ? 
                        getUnitDisplayWeight(item.quantity, item.unit, getMyPlateCategory(item.foodType)) : 
                        ''
                      }
                    </span>
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="remove-item-btn"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button onClick={addItem} className="add-item-btn">
              + Add Another Item
            </button>

            {items.length > 0 && (
              <div className="entry-summary">
                <p><strong>Total Weight:</strong> {calculateTotalWeight().toFixed(1)} lbs</p>
                <p><strong>Total Items:</strong> {items.filter(item => item.foodType && item.quantity).length}</p>
              </div>
            )}
          </div>
        )}

        {/* Bulk Import Mode */}
        {surveyMode === 'BULK' && (
          <div className="form-section">
            <h3>Bulk Import</h3>
            <p className="help-text">
              Enter data in CSV format: Food Type, Quantity, Unit, Expiration Date, Notes (optional)
              <br />
              Example: BREAD, 5, PALLET, 2024-02-15, From food drive
              <br />
              Available units: {availableUnits.map(u => u.abbreviation).join(', ')}
            </p>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="BREAD, 5, PALLET, 2024-02-15, From food drive&#10;MILK, 20, CASE, 2024-02-10&#10;RICE, 1000, POUNDS, 2025-01-01"
              rows="10"
              className="bulk-textarea"
            />
            <button onClick={handleBulkDataParse} className="parse-btn">
              Parse Data
            </button>
          </div>
        )}

        {/* Distribution Mode */}
        {surveyMode === 'DISTRIBUTION' && (
          <div className="form-section">
            <h3>Distribution Log</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Total Distributed:</label>
                <input
                  type="number"
                  step="0.1"
                  value={distributionData.totalDistributed}
                  onChange={(e) => setDistributionData({
                    ...distributionData,
                    totalDistributed: e.target.value
                  })}
                />
              </div>
              <div className="form-field">
                <label>Unit:</label>
                <select
                  value={distributionData.unit}
                  onChange={(e) => setDistributionData({
                    ...distributionData,
                    unit: e.target.value
                  })}
                >
                  {availableUnits.map(unit => (
                    <option key={unit.key} value={unit.key}>
                      {unit.name} ({unit.abbreviation})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Clients Served:</label>
                <input
                  type="number"
                  value={distributionData.clientsServed}
                  onChange={(e) => setDistributionData({
                    ...distributionData,
                    clientsServed: e.target.value
                  })}
                />
              </div>
              <div className="form-field">
                <label>Avg Family Size:</label>
                <input
                  type="number"
                  step="0.1"
                  value={distributionData.avgFamilySize}
                  onChange={(e) => setDistributionData({
                    ...distributionData,
                    avgFamilySize: e.target.value
                  })}
                />
              </div>
            </div>
            <div className="calculated-stats">
              <p>Estimated People Served: {
                (distributionData.clientsServed * distributionData.avgFamilySize).toFixed(0)
              }</p>
              <p>Avg per Client: {
                distributionData.totalDistributed && distributionData.clientsServed ? 
                (distributionData.totalDistributed / distributionData.clientsServed).toFixed(1) + 
                ` ${availableUnits.find(u => u.key === distributionData.unit)?.abbreviation}` : 
                'N/A'
              }</p>
              {distributionData.unit !== 'POUNDS' && distributionData.totalDistributed && (
                <p>Total in Pounds: {
                  UnitConverters.convertToStandardWeight(
                    parseFloat(distributionData.totalDistributed), 
                    distributionData.unit
                  ).toFixed(1)
                } lbs</p>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button onClick={submitSurvey} className="submit-btn">
            Submit Survey
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyInterface;
