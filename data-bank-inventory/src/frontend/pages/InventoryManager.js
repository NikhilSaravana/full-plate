import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import { getMyPlateCategory } from '../../backend/utils/FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';
import { getCombinedAlerts } from '../../backend/utils/alertUtils';

// High-level categories for consistency
const MAIN_FOOD_CATEGORIES = ['VEG', 'FRUIT', 'DAIRY', 'GRAIN', 'PROTEIN', 'PRODUCE', 'MISC'];

const InventoryManager = ({ currentInventory, onNavigate, outgoingMetrics = {}, unitConfig }) => {
  const { t } = useLanguage();
  const [detailedInventory, setDetailedInventory] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newItem, setNewItem] = useState({
    foodType: '',
    product: '',
    quantity: '',
    unit: 'POUNDS',
    expirationDate: '',
    source: 'Direct Donation',
    notes: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const unitConverters = getUnitConverters(unitConfig);

  // Load detailed inventory from localStorage
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      try {
        setDetailedInventory(JSON.parse(savedDetailedInventory));
      } catch (error) {
        console.error('[InventoryManager] Invalid JSON in localStorage, resetting inventory:', error);
        localStorage.removeItem('detailedInventory'); // Clean up corrupted data
        setDetailedInventory({});
      }
    }
  }, []);

  // Save detailed inventory to localStorage whenever it changes with quota handling
  useEffect(() => {
    if (Object.keys(detailedInventory).length > 0) {
      try {
        localStorage.setItem('detailedInventory', JSON.stringify(detailedInventory));
      } catch (error) {
        console.error('[InventoryManager] Failed to save to localStorage:', error);
        if (error.name === 'QuotaExceededError') {
          // Try to free up space by removing old data
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('old_') || key.includes('backup_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // Try again after cleanup
          try {
            localStorage.setItem('detailedInventory', JSON.stringify(detailedInventory));
          } catch (retryError) {
            console.error('[InventoryManager] Storage quota exceeded even after cleanup');
            alert('Storage space is full. Some data may not be saved locally.');
          }
        }
      }
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
    UnitConverters: unitConverters
  });

  const handleAddItem = () => {
    if (!newItem.foodType || !newItem.quantity) {
      alert('Please fill in required fields');
      return;
    }

    const numQuantity = parseFloat(newItem.quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      alert('Please enter a valid positive quantity');
      return;
    }

    const category = newItem.foodType; // Already a category
    const weightInPounds = unitConverters.convertToStandardWeight(
      numQuantity, 
      newItem.unit, 
      category
    );

    const itemData = {
      id: Date.now(),
              name: newItem.product || newItem.foodType,
      weight: weightInPounds,
      originalQuantity: numQuantity,
      originalUnit: newItem.unit,
      expiration: newItem.expirationDate || 'N/A',
      source: newItem.source,
      notes: newItem.notes || ''
    };

    setDetailedInventory(prev => ({
      ...prev,
      [category]: {
        items: [itemData, ...(prev[category]?.items || [])],
        total: (prev[category]?.total || 0) + weightInPounds
      }
    }));

    setNewItem({
      foodType: '',
      product: '',
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
    const unitConfig = unitConverters.getAvailableUnits().find(u => u.key === item.originalUnit);
    if (!unitConfig) return `${item.weight.toLocaleString()} lbs`;
    
    return `${item.originalQuantity} ${unitConfig.abbreviation} (${item.weight.toLocaleString()} lbs)`;
  };

  const getPalletEquivalent = (weight, category) => {
    return unitConverters.convertFromStandardWeight(weight, 'PALLET', category).toFixed(1);
  };

  const hasDetailedData = Object.values(detailedInventory).some(category => 
    category && category.items && category.items.length > 0
  );

  return (
    <div className="inventory-manager">
      <div className="inventory-header">
        <h2>{t('inventory.title')}</h2>
        <div className="inventory-stats">
          <div className="stat-card">
            <h4>{t('inventory.total-weight')}</h4>
            <p>{totalFromSummary.toLocaleString()} lbs</p>
          </div>
          <div className="stat-card critical">
            <h4>{t('stats.critical-alerts')}</h4>
            <p>{getCriticalAlerts().length}</p>
          </div>
          <div className="stat-card warning">
            <h4>{t('stats.warnings')}</h4>
            <p>{getWarningAlerts().length}</p>
          </div>
        </div>
      </div>

      {totalFromSummary === 0 ? (
        <div className="empty-state">
                          <h3>{t('empty.no-inventory')}</h3>
          <p>{t('empty.no-inventory-desc')}</p>
          <button
            onClick={() => onNavigate('survey')}
            className="get-started-btn"
          >
{t('empty.start-adding')}
          </button>
        </div>
      ) : (
        <>
          {/* Summary Section */}
          <div className="inventory-summary">
            <h3>{t('inventory.detailed-items')}</h3>
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
              <h3>{t('dashboard.critical-alerts-warnings')}</h3>
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
              <h3>Detailed Item Tracking</h3>
              <p>{t('inventory.detailed-management-note')}</p>
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
                <option value="ALL">{t('inventory.all-categories')}</option>
                <option value="DAIRY">{t('category.dairy')}</option>
                <option value="GRAIN">{t('category.grain')}</option>
                <option value="PROTEIN">{t('category.protein')}</option>
                <option value="VEG">{t('category.vegetables')}</option>
                <option value="FRUIT">{t('category.fruit')}</option>
                <option value="PRODUCE">{t('category.produce')}</option>
                <option value="MISC">{t('category.misc')}</option>
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
                <select
                  value={newItem.foodType}
                  onChange={(e) => setNewItem({...newItem, foodType: e.target.value})}
                >
                  <option value="">Select Category</option>
                  {MAIN_FOOD_CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Product name (e.g., White Bread, 2% Milk)"
                  value={newItem.product}
                  onChange={(e) => setNewItem({...newItem, product: e.target.value})}
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
                  {unitConverters.getAvailableUnits().map(unit => (
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
                  <p><strong>Preview:</strong> {newItem.quantity} {unitConverters.getAvailableUnits().find(u => u.key === newItem.unit)?.abbreviation} = {
                    (() => {
                      const numQuantity = parseFloat(newItem.quantity);
                      if (isNaN(numQuantity) || numQuantity <= 0) return '0.0';
                      return unitConverters.convertToStandardWeight(
                        numQuantity, 
                        newItem.unit, 
                        newItem.foodType
                      ).toFixed(1);
                    })()
                  } lbs</p>
                </div>
              )}
              
              <div className="form-actions">
                <button onClick={handleAddItem} className="add-btn">{t('inventory.add-new-item')}</button>
                <button onClick={() => setShowAddForm(false)} className="cancel-btn">{t('ui.cancel')}</button>
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
