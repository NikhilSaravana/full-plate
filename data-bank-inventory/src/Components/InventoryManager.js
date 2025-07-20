import React, { useState, useEffect } from 'react';
import { getMyPlateCategory } from './FoodCategoryMapper';
import { UnitConverters } from './UnitConfiguration';
import { getCombinedAlerts } from './alertUtils';

const InventoryManager = ({ currentInventory, onNavigate, outgoingMetrics = {} }) => {
  const [detailedInventory, setDetailedInventory] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newItem, setNewItem] = useState({
    foodType: '',
    quantity: '',
    unit: 'POUNDS',
    expirationDate: '',
    source: 'Direct Donation',
    notes: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const availableUnits = UnitConverters.getAvailableUnits();

  // Load detailed inventory from localStorage
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      setDetailedInventory(JSON.parse(savedDetailedInventory));
    }
  }, []);

  // Save detailed inventory to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(detailedInventory).length > 0) {
      localStorage.setItem('detailedInventory', JSON.stringify(detailedInventory));
    }
  }, [detailedInventory]);

  const getTotalDetailedInventory = () => {
    return Object.values(detailedInventory).reduce((sum, category) => {
      return sum + (category?.total || 0);
    }, 0);
  };

  const totalFromSummary = Object.values(currentInventory || {}).reduce((sum, val) => sum + val, 0);

  // Generate combined alerts with proper outgoingMetrics
  const combinedAlerts = getCombinedAlerts({
    currentInventory,
    memoizedTotalInventory: totalFromSummary, // Use summary total for consistency
    outgoingMetrics,
    detailedInventory,
    UnitConverters
  });

  const handleAddItem = () => {
    if (!newItem.foodType || !newItem.quantity) {
      alert('Please fill in required fields');
      return;
    }

    const category = getMyPlateCategory(newItem.foodType);
    const weightInPounds = UnitConverters.convertToStandardWeight(
      parseFloat(newItem.quantity), 
      newItem.unit, 
      category
    );

    const itemData = {
      id: Date.now(),
      name: newItem.foodType,
      weight: weightInPounds,
      originalQuantity: parseFloat(newItem.quantity),
      originalUnit: newItem.unit,
      expiration: newItem.expirationDate || 'N/A',
      source: newItem.source,
      notes: newItem.notes || ''
    };

    setDetailedInventory(prev => ({
      ...prev,
      [category]: {
        items: [...(prev[category]?.items || []), itemData],
        total: (prev[category]?.total || 0) + weightInPounds
      }
    }));

    setNewItem({
      foodType: '',
      quantity: '',
      unit: 'POUNDS',
      expirationDate: '',
      source: 'Direct Donation',
      notes: ''
    });
    setShowAddForm(false);
  };

  const handleRemoveItem = (category, itemId) => {
    setDetailedInventory(prev => {
      const categoryData = prev[category];
      if (!categoryData) return prev;

      const itemToRemove = categoryData.items.find(item => item.id === itemId);
      if (!itemToRemove) return prev;

      return {
        ...prev,
        [category]: {
          ...categoryData,
          items: categoryData.items.filter(item => item.id !== itemId),
          total: categoryData.total - itemToRemove.weight
        }
      };
    });
  };

  const filteredInventory = () => {
    let filtered = { ...detailedInventory };
    
    if (selectedCategory !== 'ALL') {
      filtered = { [selectedCategory]: detailedInventory[selectedCategory] || { items: [], total: 0 } };
    }
    
    if (searchTerm) {
      Object.keys(filtered).forEach(category => {
        if (filtered[category] && filtered[category].items) {
          filtered[category] = {
            ...filtered[category],
            items: filtered[category].items.filter(item =>
              item.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
          };
        }
      });
    }
    
    return filtered;
  };

  // Update getCriticalAlerts and getWarningAlerts to use 'type' for all alerts
  const getCriticalAlerts = () => combinedAlerts.filter(alert => alert.type === 'CRITICAL');
  const getWarningAlerts = () => combinedAlerts.filter(alert => alert.type === 'WARNING');
  const getInfoAlerts = () => combinedAlerts.filter(alert => alert.type === 'INFO');

  const getDisplayUnits = (item, category) => {
    const unitConfig = availableUnits.find(u => u.key === item.originalUnit);
    if (!unitConfig) return `${item.weight.toLocaleString()} lbs`;
    
    return `${item.originalQuantity} ${unitConfig.abbreviation} (${item.weight.toLocaleString()} lbs)`;
  };

  const getPalletEquivalent = (weight, category) => {
    return UnitConverters.convertFromStandardWeight(weight, 'PALLET', category).toFixed(1);
  };

  const hasDetailedData = Object.values(detailedInventory).some(category => 
    category && category.items && category.items.length > 0
  );

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <div className="inventory-stats">
          <div className="stat-card">
            <h4>Total Inventory</h4>
            <p>{totalFromSummary.toLocaleString()} lbs</p>
          </div>
          <div className="stat-card critical">
            <h4>Critical Alerts</h4>
            <p>{getCriticalAlerts().length}</p>
          </div>
          <div className="stat-card warning">
            <h4>Warnings</h4>
            <p>{getWarningAlerts().length}</p>
          </div>
        </div>
      </div>

      {totalFromSummary === 0 ? (
        <div className="empty-state">
                          <h3>No Inventory Data</h3>
          <p>Start by adding your first inventory items using the "Data Entry" tab, or add individual items below.</p>
          <button
            onClick={() => onNavigate('survey')}
            className="get-started-btn"
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <>
          {/* Summary Section */}
          <div className="inventory-summary">
            <h3>Inventory Summary (by Category)</h3>
            <div className="summary-grid">
              {Object.entries(currentInventory || {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, weight]) => (
                <div key={category} className="summary-card">
                  <h4>{category}</h4>
                  <p className="summary-weight">{weight.toLocaleString()} lbs</p>
                  <p className="summary-percentage">
                    {totalFromSummary > 0 ? ((weight / totalFromSummary) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Section */}
          {combinedAlerts.length > 0 && (
            <div className="alerts-section">
              <h3>Inventory Alerts</h3>
              <div className="alerts-list">
                {combinedAlerts.map((alert, index) => (
                  <div key={index} className={`alert alert-${alert.type.toLowerCase()}`}> 
                    <span className="alert-icon">{alert.type}</span>
                    <span className="alert-message">{alert.message}</span>
                    {alert.action && <span className="alert-action">{alert.action}</span>}
                    {alert.item && <span className="alert-weight">{alert.item.weight} lbs</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Items Section */}
          {!hasDetailedData && (
            <div className="no-detailed-items">
              <h3>🔍 Detailed Item Tracking</h3>
              <p>For more detailed inventory management, add individual items with expiration dates and specific details.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="add-detailed-btn"
              >
                Start Detailed Tracking
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="inventory-controls">
            <div className="search-filter">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-filter"
              >
                <option value="ALL">All Categories</option>
                <option value="DAIRY">Dairy</option>
                <option value="GRAIN">Grain</option>
                <option value="PROTEIN">Protein</option>
                <option value="VEG">Vegetables</option>
                <option value="FRUIT">Fruit</option>
                <option value="PRODUCE">Produce</option>
                <option value="MISC">Miscellaneous</option>
              </select>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="add-item-btn"
            >
              + Add Individual Item
            </button>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="add-item-form">
              <h3>Add Individual Inventory Item</h3>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Food Type (e.g., BREAD, MILK)"
                  value={newItem.foodType}
                  onChange={(e) => setNewItem({...newItem, foodType: e.target.value})}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Quantity"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                />
                <select
                  value={newItem.unit}
                  onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                >
                  {availableUnits.map(unit => (
                    <option key={unit.key} value={unit.key}>
                      {unit.name} ({unit.abbreviation})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  placeholder="Expiration Date"
                  value={newItem.expirationDate}
                  onChange={(e) => setNewItem({...newItem, expirationDate: e.target.value})}
                />
                <select
                  value={newItem.source}
                  onChange={(e) => setNewItem({...newItem, source: e.target.value})}
                >
                  <option value="Direct Donation">Direct Donation</option>
                  <option value="NTFB AE">NTFB AE</option>
                  <option value="Local Farm">Local Farm</option>
                  <option value="Food Drive">Food Drive</option>
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                />
              </div>
              
              {newItem.quantity && newItem.unit && newItem.foodType && (
                <div className="preview-conversion">
                  <p><strong>Preview:</strong> {newItem.quantity} {availableUnits.find(u => u.key === newItem.unit)?.abbreviation} = {
                    UnitConverters.convertToStandardWeight(
                      parseFloat(newItem.quantity), 
                      newItem.unit, 
                      getMyPlateCategory(newItem.foodType)
                    ).toFixed(1)
                  } lbs</p>
                </div>
              )}
              
              <div className="form-actions">
                <button onClick={handleAddItem} className="add-btn">Add Item</button>
                <button onClick={() => setShowAddForm(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          )}

          {/* Detailed Inventory Display */}
          {hasDetailedData && (
            <div className="inventory-display">
              <h3>Detailed Item Tracking</h3>
              {Object.entries(filteredInventory()).map(([category, data]) => {
                if (!data || !data.items || data.items.length === 0) return null;
                
                return (
                  <div key={category} className="category-section">
                    <div className="category-header">
                      <h4>{category}</h4>
                      <span className="category-total">{data.total.toLocaleString()} lbs</span>
                    </div>
                    <div className="items-grid">
                      {data.items.map(item => (
                        <div key={item.id} className="item-card">
                          <div className="item-info">
                            <h5>{item.name}</h5>
                            <p className="item-weight">{getDisplayUnits(item, category)}</p>
                            <p className="item-pallets">{getPalletEquivalent(item.weight, category)} pallets equiv.</p>
                            <p className="item-expiration">Exp: {item.expiration}</p>
                            <p className="item-source">Source: {item.source}</p>
                            {item.notes && <p className="item-notes">Notes: {item.notes}</p>}
                          </div>
                          <button
                            onClick={() => handleRemoveItem(category, item.id)}
                            className="remove-btn"
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventoryManager;
