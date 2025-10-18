import React, { useState } from 'react';
import { getMyPlateCategory } from './FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';

import ConfirmationDialog from './ConfirmationDialog';

// High-level categories shown in the dropdown instead of the full 30+ list
export const MAIN_FOOD_CATEGORIES = ['VEG', 'FRUIT', 'DAIRY', 'GRAIN', 'PROTEIN', 'PRODUCE', 'MISC'];

const DistributionInterface = ({ onDataSubmit, unitConfig, successMessage }) => {
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
    recipient: '',
    notes: ''
  });
  const [items, setItems] = useState([
    { foodType: '', product: '', quantity: '', unit: 'POUND', notes: '' }
  ]);
  const [clientInfo, setClientInfo] = useState({
    clientsServed: '',
    ageGroups: {
      elder: 0,    // 65+ years
      adult: 0,    // 18-64 years  
      kid: 0       // 0-17 years
    }
  });

  // Calculate total clients from age groups
  const calculateTotalClients = (ageGroups) => {
    return (ageGroups.elder || 0) + (ageGroups.adult || 0) + (ageGroups.kid || 0);
  };
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState({});
  const [emptyItemIndices, setEmptyItemIndices] = useState([]);

  const unitConverters = getUnitConverters(unitConfig);

  const addItem = () => {
    setItems([...items, { foodType: '', product: '', quantity: '', unit: 'POUND', notes: '' }]);
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
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity < 0) return 0;
    if (unit === 'POUNDS' || unit === 'POUND') return numQuantity;
    return unitConverters.convertToStandardWeight(numQuantity, unit, category);
  };

  const calculateTotalWeight = () => {
    return items.reduce((total, item) => {
      if (item.quantity && item.foodType) {
        const category = item.foodType; // Already category selection
        return total + getWeightInPounds(item.quantity, item.unit, category);
      }
      return total;
    }, 0);
  };

  const getUnitDisplayWeight = (quantity, unit, category) => {
    if (!quantity || !unit) return '';
    const weightInPounds = getWeightInPounds(quantity, unit, category);
    if (unit === 'POUNDS' || unit === 'POUND') {
      return `${quantity} lbs`;
    }
    return `${quantity} ${unitConverters.getAvailableUnits().find(u => u.key === unit)?.abbreviation} (${weightInPounds.toFixed(1)} lbs)`;
  };

  const submitDistribution = () => {
    const emptyIndices = items
      .map((item, idx) => (!item.foodType || !item.quantity) ? idx : null)
      .filter(idx => idx !== null);
    setEmptyItemIndices(emptyIndices);
    if (emptyIndices.length > 0) {
      setConfirmationConfig({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all required fields (Food Type and Quantity) or remove unused line items before recording the distribution. Empty lines are highlighted.',
        confirmText: 'OK',
        onConfirm: () => setShowConfirmation(false)
      });
      setShowConfirmation(true);
      return;
    }

    // Validate that age groups match total clients
    const calculatedTotal = calculateTotalClients(clientInfo.ageGroups);
    const enteredTotal = parseInt(clientInfo.clientsServed) || 0;
    if (calculatedTotal !== enteredTotal) {
      setConfirmationConfig({
        type: 'error',
        title: 'Data Mismatch',
        message: `Age group totals (${calculatedTotal}) don't match total clients served (${enteredTotal}). Please check your entries.`,
        confirmText: 'OK',
        onConfirm: () => setShowConfirmation(false)
      });
      setShowConfirmation(true);
      return;
    }

    // Calculate totals by MyPlate category (converting all to pounds)
    const categoryTotals = {};
    items.forEach(item => {
      if (item.foodType && item.quantity) {
        const category = item.foodType; // Already category selection
        const weightInPounds = getWeightInPounds(item.quantity, item.unit, category);
        categoryTotals[category] = (categoryTotals[category] || 0) + weightInPounds;
      }
    });

    const distributionData = {
      type: 'DISTRIBUTION',
      date: formData.date,
      recipient: formData.recipient,
      notes: formData.notes,
      clientsServed: parseInt(clientInfo.clientsServed) || 0,
      ageGroups: {
        elder: clientInfo.ageGroups.elder,
        adult: clientInfo.ageGroups.adult,
        kid: clientInfo.ageGroups.kid
      },
      items: items.map(item => ({
        ...item,
        weightInPounds: getWeightInPounds(item.quantity, item.unit, item.foodType)
      })),
      categoryTotals,
      totalDistributed: calculateTotalWeight(),
      timestamp: new Date().toISOString()
    };

    console.log('[DISTRIBUTION] Age groups being submitted:', distributionData.ageGroups);
    console.log('[DISTRIBUTION] Client info state:', clientInfo);

    if (onDataSubmit) {
      try {
        onDataSubmit(distributionData);
      } catch (error) {
        console.error('Error submitting distribution data:', error);
        setConfirmationConfig({
          type: 'error',
          title: 'Submission Failed',
          message: 'Failed to save distribution data. Please try again.',
          confirmText: 'OK',
          onConfirm: () => setShowConfirmation(false)
        });
        setShowConfirmation(true);
        return; // Don't reset form on error
      }
    }

    // Reset form
    setItems([{ foodType: '', product: '', quantity: '', unit: 'POUND', notes: '' }]);
    setFormData({
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
      recipient: '',
      notes: ''
    });
    setClientInfo({
      clientsServed: '',
      ageGroups: {
        elder: 0,
        adult: 0,
        kid: 0
      }
    });

    setConfirmationConfig({
      type: 'success',
      title: 'Distribution Recorded',
      message: `Successfully recorded distribution of ${calculateTotalWeight().toFixed(1)} lbs to ${formData.recipient || 'recipient'}.`,
      confirmText: 'OK',
      onConfirm: () => setShowConfirmation(false)
    });
    setShowConfirmation(true);
  };

  const getFoodTypeOptions = () => {
    return MAIN_FOOD_CATEGORIES;
  };

  const getQuickAddButtons = () => {
    // Map common food items to their categories and product names
    const commonItems = [
      { category: 'GRAIN', product: 'Bread' },
      { category: 'DAIRY', product: 'Milk' },
      { category: 'GRAIN', product: 'Rice' },
      { category: 'GRAIN', product: 'Pasta' },
      { category: 'PROTEIN', product: 'Chicken' },
      { category: 'PROTEIN', product: 'Beans' },
      { category: 'VEG', product: 'Corn' },
      { category: 'FRUIT', product: 'Mixed Fruit' },
      { category: 'VEG', product: 'Mixed Vegetables' },
      { category: 'GRAIN', product: 'Cereal' },
      { category: 'DAIRY', product: 'Cheese' },
      { category: 'PROTEIN', product: 'Eggs' }
    ];
    return commonItems;
  };

  return (
    <div className="survey-interface">
      <div className="form-container">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Distribution Details</h3>
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
              <label className="form-label-enhanced">Recipient Organization/Program:</label>
              <input
                type="text"
                className="form-control-enhanced"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="e.g., Local Food Pantry"
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">Total Clients Served:</label>
              <input
                type="number"
                className="form-control-enhanced"
                value={clientInfo.clientsServed}
                onChange={(e) => {
                  const total = parseInt(e.target.value) || 0;
                  setClientInfo({...clientInfo, clientsServed: e.target.value});
                }}
                placeholder="Total number of clients"
                readOnly
                style={{backgroundColor: '#f8f9fa', cursor: 'not-allowed'}}
              />
              <small className="form-text text-muted">
                This field is automatically calculated from age demographics above
              </small>
            </div>
          </div>
          
          {/* Age Group Breakdown */}
          <div className="form-section">
            <h3>Client Age Demographics</h3>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label-enhanced">Children (0-17 years):</label>
                <input
                  type="number"
                  className="form-control-enhanced"
                  value={clientInfo.ageGroups.kid}
                  onChange={(e) => {
                    const kidCount = parseInt(e.target.value) || 0;
                    const newAgeGroups = {...clientInfo.ageGroups, kid: kidCount};
                    const totalClients = calculateTotalClients(newAgeGroups);
                    setClientInfo({
                      ...clientInfo, 
                      ageGroups: newAgeGroups,
                      clientsServed: totalClients.toString()
                    });
                  }}
                  placeholder="Number of children"
                  min="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label-enhanced">Adults (18-64 years):</label>
                <input
                  type="number"
                  className="form-control-enhanced"
                  value={clientInfo.ageGroups.adult}
                  onChange={(e) => {
                    const adultCount = parseInt(e.target.value) || 0;
                    const newAgeGroups = {...clientInfo.ageGroups, adult: adultCount};
                    const totalClients = calculateTotalClients(newAgeGroups);
                    setClientInfo({
                      ...clientInfo, 
                      ageGroups: newAgeGroups,
                      clientsServed: totalClients.toString()
                    });
                  }}
                  placeholder="Number of adults"
                  min="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label-enhanced">Elders (65+ years):</label>
                <input
                  type="number"
                  className="form-control-enhanced"
                  value={clientInfo.ageGroups.elder}
                  onChange={(e) => {
                    const elderCount = parseInt(e.target.value) || 0;
                    const newAgeGroups = {...clientInfo.ageGroups, elder: elderCount};
                    const totalClients = calculateTotalClients(newAgeGroups);
                    setClientInfo({
                      ...clientInfo, 
                      ageGroups: newAgeGroups,
                      clientsServed: totalClients.toString()
                    });
                  }}
                  placeholder="Number of elders"
                  min="0"
                />
              </div>
            </div>
            {clientInfo.clientsServed && (
              <div className="age-group-summary">
                <p><strong>Total Clients:</strong> {clientInfo.ageGroups.kid + clientInfo.ageGroups.adult + clientInfo.ageGroups.elder} clients</p>
                <p className="text-muted">
                  <small>Children: {clientInfo.ageGroups.kid} • Adults: {clientInfo.ageGroups.adult} • Elders: {clientInfo.ageGroups.elder}</small>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Items Section */}
        <div className="form-section">
          <h3>Distributed Items</h3>
          <div className="quick-add-section">
            <div className="quick-add-header">
              <span className="quick-add-label">Quick Add Common Items:</span>
            </div>
            <div className="quick-add-buttons">
              {getQuickAddButtons().map(item => (
                <button
                  key={`${item.category}-${item.product}`}
                  onClick={() => {
                    // Find first empty item (no foodType and no quantity)
                    const emptyIndex = items.findIndex(i => !i.foodType && !i.quantity);
                    const newItem = { 
                      foodType: item.category, 
                      product: item.product, 
                      quantity: '', 
                      unit: 'POUND', 
                      notes: '' 
                    };
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
                  className="btn btn-light quick-add-item"
                >
                  {item.product}
                </button>
              ))}
            </div>
          </div>

          {items.map((item, index) => (
            <div key={index} className={`item-row${emptyItemIndices.includes(index) ? ' item-row-empty' : ''}`}>
              <div className="item-main-row">
                <div className="item-inputs">
                  <div className="input-group">
                    <label className="form-label-enhanced">Category</label>
                    <select
                      value={item.foodType}
                      onChange={(e) => updateItem(index, 'foodType', e.target.value)}
                      className="form-control-enhanced"
                    >
                      <option value="">Select Category</option>
                      {getFoodTypeOptions().map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">Product</label>
                    <input
                      type="text"
                      placeholder="e.g., White Bread, Low-fat Milk"
                      className="form-control-enhanced"
                      value={item.product}
                      onChange={(e) => updateItem(index, 'product', e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">Quantity</label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      placeholder="Quantity"
                      className="form-control-enhanced"
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
                    <label className="form-label-enhanced">Category</label>
                    <div className="category-display">
                      {item.foodType || 'Select category first'}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">Weight</label>
                    <div className="weight-display">
                      {item.quantity && item.foodType ? 
                        getUnitDisplayWeight(item.quantity, item.unit, item.foodType) : 
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

          <button onClick={addItem} className="btn btn-secondary">
            Add Another Item
          </button>

          {items.length > 0 && (
            <div className="distribution-summary">
              <p><strong>Total Weight:</strong> {calculateTotalWeight().toFixed(1)} lbs</p>
              <p><strong>Total Items:</strong> {items.filter(item => item.foodType && item.quantity).length}</p>
              {clientInfo.clientsServed && (
                <>
                  <p><strong>Total Clients:</strong> {clientInfo.clientsServed}</p>
                  <p><strong>Average per Client:</strong> {(calculateTotalWeight() / parseFloat(clientInfo.clientsServed)).toFixed(1)} lbs</p>
                  {(clientInfo.ageGroups.kid > 0 || clientInfo.ageGroups.adult > 0 || clientInfo.ageGroups.elder > 0) && (
                    <div className="age-group-breakdown">
                      <p><strong>Age Demographics:</strong></p>
                      <ul>
                        {clientInfo.ageGroups.kid > 0 && <li>Children (0-17): {clientInfo.ageGroups.kid}</li>}
                        {clientInfo.ageGroups.adult > 0 && <li>Adults (18-64): {clientInfo.ageGroups.adult}</li>}
                        {clientInfo.ageGroups.elder > 0 && <li>Elders (65+): {clientInfo.ageGroups.elder}</li>}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-field">
            <label className="form-label-enhanced">Additional Notes:</label>
            <textarea
              className="form-control-enhanced"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional notes about this distribution"
              rows="3"
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          {successMessage && (
            <span style={{ 
              color: '#28a745', 
              fontWeight: 'bold',
              fontSize: '16px',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              ✓ {successMessage}
            </span>
          )}
          <button onClick={submitDistribution} className="btn btn-primary btn-large">
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

export default DistributionInterface; 