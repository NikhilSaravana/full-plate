import React, { useState } from 'react';
import { getMyPlateCategory } from './FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';

import ConfirmationDialog from './ConfirmationDialog';

// High-level categories shown in the dropdown instead of the full 30+ list
export const MAIN_FOOD_CATEGORIES = ['VEG', 'FRUIT', 'DAIRY', 'GRAIN', 'PROTEIN', 'PRODUCE', 'MISC'];

const DistributionInterface = ({ onDataSubmit, unitConfig }) => {
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
  });
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
    if (unit === 'POUNDS' || unit === 'POUND') return parseFloat(quantity);
    return unitConverters.convertToStandardWeight(parseFloat(quantity), unit, category);
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
      items: items.map(item => ({
        ...item,
        weightInPounds: getWeightInPounds(item.quantity, item.unit, item.foodType)
      })),
      categoryTotals,
      totalDistributed: calculateTotalWeight(),
      timestamp: new Date().toISOString()
    };

    if (onDataSubmit) {
      onDataSubmit(distributionData);
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
    const commonItems = [
      'BREAD', 'MILK', 'RICE', 'PASTA', 'CHICKEN', 'BEANS', 
      'CORN', 'FRUIT', 'VEGETABLES', 'CEREAL', 'CHEESE', 'EGGS'
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
              <label className="form-label-enhanced">Clients Served:</label>
              <input
                type="number"
                className="form-control-enhanced"
                value={clientInfo.clientsServed}
                onChange={(e) => setClientInfo({...clientInfo, clientsServed: e.target.value})}
                placeholder="Number of clients"
              />
            </div>
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
                  key={item}
                  onClick={() => {
                    // Find first empty item (no foodType and no quantity)
                    const emptyIndex = items.findIndex(i => !i.foodType && !i.quantity);
                    const newItem = { foodType: item, product: '', quantity: '', unit: 'POUND', notes: '' };
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
                      {item.foodType || (item.product ? getMyPlateCategory(item.product) : 'Select category')}
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
                  <p><strong>Average per Client:</strong> {(calculateTotalWeight() / parseFloat(clientInfo.clientsServed)).toFixed(1)} lbs</p>
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

        <div className="form-actions">
          <button onClick={submitDistribution} className="btn btn-primary">
            Record Distribution
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