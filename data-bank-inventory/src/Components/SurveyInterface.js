import React, { useState } from 'react';
import { FOOD_CATEGORY_MAPPING, getMyPlateCategory } from './FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';
import ConfirmationDialog from './ConfirmationDialog';

const SurveyInterface = ({ onDataSubmit, unitConfig }) => {
  const [surveyMode, setSurveyMode] = useState('SINGLE'); // SINGLE, BULK, DISTRIBUTION
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
    source: 'Direct Donation',
    notes: ''
  });
  const [items, setItems] = useState([
    { foodType: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }
  ]);
  const [bulkData, setBulkData] = useState('');
  const [distributionData, setDistributionData] = useState({
    totalDistributed: '',
    unit: 'POUND',
    clientsServed: '',
    categories: {}
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState({});
  const [emptyItemIndices, setEmptyItemIndices] = useState([]);

  const unitConverters = getUnitConverters(unitConfig);

  const addItem = () => {
    setItems([...items, { foodType: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }]);
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
    if (unit === 'POUND') return parseFloat(quantity);
    return unitConverters.convertToStandardWeight(parseFloat(quantity), unit, category);
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
      setConfirmationConfig({
        type: 'error',
        title: 'Parsing Error',
        message: 'Error parsing bulk data. Please check the format and try again. Make sure each line follows: Food Type, Quantity, Unit, Expiration Date, Notes',
        confirmText: 'OK',
        onConfirm: () => setShowConfirmation(false)
      });
      setShowConfirmation(true);
    }
  };

  const submitSurvey = () => {
    const emptyIndices = items
      .map((item, idx) => (!item.foodType || !item.quantity) ? idx : null)
      .filter(idx => idx !== null);
    setEmptyItemIndices(emptyIndices);
    if (surveyMode === 'SINGLE' && emptyIndices.length > 0) {
      setConfirmationConfig({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all required fields (Food Type and Quantity) or remove unused line items before submitting the survey. Empty lines are highlighted.',
        confirmText: 'OK',
        onConfirm: () => setShowConfirmation(false)
      });
      setShowConfirmation(true);
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
    setItems([{ foodType: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }]);
    setFormData({
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
      source: 'Direct Donation',
      notes: ''
    });
    setDistributionData({
      totalDistributed: '',
      unit: 'POUND',
      clientsServed: '',
      categories: {}
    });

    const totalWeight = surveyMode === 'SINGLE' ? calculateTotalWeight() : parseFloat(distributionData.totalDistributed) || 0;
    const itemCount = surveyMode === 'SINGLE' ? items.filter(item => item.foodType && item.quantity).length : 1;
    
    setConfirmationConfig({
      type: 'success',
      title: 'Survey Submitted',
      message: `Successfully recorded ${surveyMode.toLowerCase()} entry with ${totalWeight.toFixed(1)} lbs across ${itemCount} item${itemCount !== 1 ? 's' : ''}.`,
      confirmText: 'OK',
      onConfirm: () => setShowConfirmation(false)
    });
    setShowConfirmation(true);
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
    if (unit === 'POUND') {
      return `${quantity} lbs`;
    }
    return `${quantity} ${unitConverters.getAvailableUnits().find(u => u.key === unit)?.abbreviation} (${weightInPounds.toFixed(1)} lbs)`;
  };

  return (
    <div className="survey-interface">
      <div className="survey-header">
        <h2>Data Entry Survey</h2>
        <div className="nav-with-icons" style={{ marginBottom: '24px' }}>
          <button
            className={`nav-tab ${surveyMode === 'SINGLE' ? 'active' : ''}`}
            onClick={() => setSurveyMode('SINGLE')}
          >
            Single Entry
          </button>
          <button
            className={`nav-tab ${surveyMode === 'BULK' ? 'active' : ''}`}
            onClick={() => setSurveyMode('BULK')}
          >
            Bulk Import
          </button>
        </div>
      </div>

      <div className="survey-form">
        {/* Common Form Fields */}
        <div className="form-section">
          <h3>General Information</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label-enhanced">Date:</label>
              <input
                type="date"
                className="form-control-enhanced"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">Source:</label>
              <select
                className="form-control-enhanced"
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
            <label className="form-label-enhanced">Notes:</label>
            <textarea
              className="form-control-enhanced"
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
            <h3>Inventory Items</h3>
            <div className="quick-add-section">
              <div className="quick-add-header">
                <span className="quick-add-label">Quick Add Common Items:</span>
              </div>
              <div className="quick-add-buttons">
                {getQuickAddButtons().map(item => (
                  <button
                    key={item}
                    className="btn btn-light quick-add-item"
                    onClick={() => {
                      // Find first empty item (no foodType and no quantity)
                      const emptyIndex = items.findIndex(i => !i.foodType && !i.quantity);
                      const newItem = { foodType: item, quantity: '', unit: 'POUND', expirationDate: '', notes: '' };
                      if (emptyIndex !== -1) {
                        // Replace the empty item
                        const updated = [...items];
                        updated[emptyIndex] = newItem;
                        setItems(updated);
                      } else {
                        // Add a new item
                        setItems([...items, newItem]);
                      }
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {items.map((item, index) => (
              <div key={index} className={`item-row${emptyItemIndices.includes(index) ? ' item-row-empty' : ''}`}>
                <div className="item-main-row">
                  <div className="item-inputs">
                    <div className="input-group">
                      <label className="form-label-enhanced">Food Type</label>
                      <select
                        value={item.foodType}
                        onChange={(e) => updateItem(index, 'foodType', e.target.value)}
                        className="form-control-enhanced"
                      >
                        <option value="">Select Food Type</option>
                        {getFoodTypeOptions().map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="form-label-enhanced">Quantity</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Quantity"
                        className="form-control-enhanced"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="form-label-enhanced">Unit</label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="form-control-enhanced"
                      >
                        {unitConverters.getAvailableUnits()
                          .filter(unit => unit.key !== 'BOX' && unit.key !== 'BAG')
                          .map(unit => (
                            <option key={unit.key} value={unit.key}>
                              {unit.name} ({unit.abbreviation})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="form-label-enhanced">Expiration</label>
                      <input
                        type="date"
                        placeholder="Expiration"
                        className="form-control-enhanced"
                        value={item.expirationDate}
                        onChange={(e) => updateItem(index, 'expirationDate', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="form-label-enhanced">Category</label>
                      <div className="category-display">
                        {item.foodType ? getMyPlateCategory(item.foodType) : 'Select food first'}
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="form-label-enhanced">Weight</label>
                      <div className="weight-display">
                        {item.quantity && item.foodType ? 
                          getUnitDisplayWeight(item.quantity, item.unit, getMyPlateCategory(item.foodType)) : 
                          'Enter quantity'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="remove-button-container">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="btn btn-danger remove-btn"
                        title="Remove this item"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="item-notes-row">
                  <div className="input-group notes-input-group">
                    <label className="form-label-enhanced">Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="Additional notes about this item..."
                      className="form-control-enhanced"
                      value={item.notes}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addItem} className="btn btn-primary" style={{ marginTop: '16px' }}>
              Add Another Item
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
              Available units: {unitConverters.getAvailableUnits().map(u => u.abbreviation).join(', ')}
            </p>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="BREAD, 5, PALLET, 2024-02-15, From food drive&#10;MILK, 20, CASE, 2024-02-10&#10;RICE, 1000, POUNDS, 2025-01-01"
              rows="10"
              className="form-control-enhanced"
            />
            <button onClick={handleBulkDataParse} className="btn btn-primary" style={{ marginTop: '16px' }}>
              Parse Data
            </button>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '32px', textAlign: 'center' }}>
          <button onClick={submitSurvey} className="btn btn-primary btn-large">
            Submit Survey
          </button>
        </div>
      </div>
      
      {showConfirmation && (
        <ConfirmationDialog
          type={confirmationConfig.type}
          title={confirmationConfig.title}
          message={confirmationConfig.message}
          confirmText={confirmationConfig.confirmText}
          cancelText={confirmationConfig.cancelText}
          onConfirm={confirmationConfig.onConfirm}
          onCancel={confirmationConfig.onCancel}
        />
      )}
    </div>
  );
};

export default SurveyInterface;
