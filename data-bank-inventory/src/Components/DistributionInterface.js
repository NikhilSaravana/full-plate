import React, { useState } from 'react';
import { FOOD_CATEGORY_MAPPING, getMyPlateCategory } from './FoodCategoryMapper';
import { UnitConverters } from './UnitConfiguration';

const DistributionInterface = ({ onDataSubmit }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    recipient: '',
    notes: ''
  });
  const [items, setItems] = useState([
    { foodType: '', quantity: '', unit: 'POUNDS', notes: '' }
  ]);
  const [clientInfo, setClientInfo] = useState({
    clientsServed: '',
    avgFamilySize: '3'
  });

  const availableUnits = UnitConverters.getAvailableUnits();

  const addItem = () => {
    setItems([...items, { foodType: '', quantity: '', unit: 'POUNDS', notes: '' }]);
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

  const submitDistribution = () => {
    if (items.some(item => !item.foodType || !item.quantity)) {
      alert('Please fill in all required fields');
      return;
    }

    // Calculate totals by MyPlate category (converting all to pounds)
    const categoryTotals = {};
    items.forEach(item => {
      if (item.foodType && item.quantity) {
        const category = getMyPlateCategory(item.foodType);
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
      avgFamilySize: parseFloat(clientInfo.avgFamilySize) || 3,
      items: items.map(item => ({
        ...item,
        weightInPounds: getWeightInPounds(item.quantity, item.unit, getMyPlateCategory(item.foodType))
      })),
      categoryTotals,
      totalDistributed: calculateTotalWeight(),
      timestamp: new Date().toISOString()
    };

    if (onDataSubmit) {
      onDataSubmit(distributionData);
    }

    // Reset form
    setItems([{ foodType: '', quantity: '', unit: 'POUNDS', notes: '' }]);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      recipient: '',
      notes: ''
    });
    setClientInfo({
      clientsServed: '',
      avgFamilySize: '3'
    });

    alert('Distribution recorded successfully!');
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

  return (
    <div className="distribution-interface">
      <h2>Record Distribution</h2>
      <div className="form-container">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Distribution Details</h3>
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
              <label>Recipient Organization/Program:</label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="e.g., Local Food Pantry"
              />
            </div>
            <div className="form-field">
              <label>Clients Served:</label>
              <input
                type="number"
                value={clientInfo.clientsServed}
                onChange={(e) => setClientInfo({...clientInfo, clientsServed: e.target.value})}
                placeholder="Number of clients"
              />
            </div>
            <div className="form-field">
              <label>Average Family Size:</label>
              <input
                type="number"
                step="0.1"
                value={clientInfo.avgFamilySize}
                onChange={(e) => setClientInfo({...clientInfo, avgFamilySize: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="form-section">
          <h3>Distributed Items</h3>
          <div className="quick-add">
            <p>Quick Add:</p>
            <div className="quick-add-buttons">
              {getQuickAddButtons().map(item => (
                <button
                  key={item}
                  onClick={() => {
                    const emptyIndex = items.findIndex(i => !i.foodType);
                    if (emptyIndex >= 0) {
                      updateItem(emptyIndex, 'foodType', item);
                    } else {
                      setItems([...items, { foodType: item, quantity: '', unit: 'POUNDS', notes: '' }]);
                    }
                  }}
                  className="quick-add-btn"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {items.map((item, index) => (
            <div key={index} className="item-row">
              <div className="item-fields">
                <select
                  value={item.foodType}
                  onChange={(e) => updateItem(index, 'foodType', e.target.value)}
                  className="food-type-select"
                >
                  <option value="">Select Food Type</option>
                  {getFoodTypeOptions().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  placeholder="Quantity"
                  className="quantity-input"
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
                  type="text"
                  value={item.notes}
                  onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  placeholder="Notes (optional)"
                  className="notes-input"
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
            <div className="distribution-summary">
              <p><strong>Total Weight:</strong> {calculateTotalWeight().toFixed(1)} lbs</p>
              <p><strong>Total Items:</strong> {items.filter(item => item.foodType && item.quantity).length}</p>
              {clientInfo.clientsServed && (
                <>
                  <p><strong>Estimated People Served:</strong> {(parseFloat(clientInfo.clientsServed) * parseFloat(clientInfo.avgFamilySize)).toFixed(0)}</p>
                  <p><strong>Average per Client:</strong> {(calculateTotalWeight() / parseFloat(clientInfo.clientsServed)).toFixed(1)} lbs</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-field">
            <label>Additional Notes:</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional notes about this distribution"
              rows="3"
            />
          </div>
        </div>

        <div className="form-actions">
          <button onClick={submitDistribution} className="submit-btn">
            Record Distribution
          </button>
        </div>
      </div>
    </div>
  );
};

export default DistributionInterface; 