import React, { useState } from 'react';
import { getMyPlateCategory } from '../../backend/utils/FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useLanguage } from '../../backend/contexts/LanguageContext';

// High-level categories shown in the dropdown instead of the full 30+ list
export const MAIN_FOOD_CATEGORIES = ['VEG', 'FRUIT', 'DAIRY', 'GRAIN', 'PROTEIN', 'PRODUCE', 'MISC'];

const DistributionInterface = ({ onDataSubmit, unitConfig, successMessage, distributionHistory = [] }) => {
  const { t } = useLanguage();
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
        title: t('distribution.missing-info'),
        message: t('distribution.missing-info-message'),
        confirmText: t('ui.ok'),
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
        title: t('distribution.age-group-mismatch'),
        message: `${t('distribution.age-group-mismatch-message')} (${calculatedTotal} vs ${enteredTotal})`,
        confirmText: t('ui.ok'),
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
          <h3>{t('distribution.title')}</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label-enhanced">{t('form.date')}:</label>
              <input
                type="date"
                className="form-control-enhanced"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">{t('distribution.recipient')}:</label>
              <input
                type="text"
                className="form-control-enhanced"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder={t('distribution.recipient-placeholder')}
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">{t('distribution.clients-served')}:</label>
              <input
                type="number"
                className="form-control-enhanced"
                value={clientInfo.clientsServed}
                onChange={(e) => {
                  const total = parseInt(e.target.value) || 0;
                  setClientInfo({...clientInfo, clientsServed: e.target.value});
                }}
                placeholder={t('distribution.clients-served')}
                readOnly
                style={{backgroundColor: '#f8f9fa', cursor: 'not-allowed'}}
              />
              <small className="form-text text-muted">
                {t('distribution.auto-calculated')}
              </small>
            </div>
          </div>
          
          {/* Age Group Breakdown */}
          <div className="form-section">
            <h3>{t('distribution.age-groups')}</h3>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label-enhanced">{t('distribution.children')}:</label>
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
                  placeholder={t('distribution.children')}
                  min="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label-enhanced">{t('distribution.adults')}:</label>
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
                  placeholder={t('distribution.adults')}
                  min="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label-enhanced">{t('distribution.elderly')}:</label>
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
                  placeholder={t('distribution.elderly')}
                  min="0"
                />
              </div>
            </div>
            {clientInfo.clientsServed && (
              <div className="age-group-summary">
                <p><strong>{t('distribution.total-clients')}:</strong> {clientInfo.ageGroups.kid + clientInfo.ageGroups.adult + clientInfo.ageGroups.elder} {t('distribution.clients')}</p>
                <p className="text-muted">
                  <small>{t('distribution.children')}: {clientInfo.ageGroups.kid} • {t('distribution.adults')}: {clientInfo.ageGroups.adult} • {t('distribution.elderly')}: {clientInfo.ageGroups.elder}</small>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Items Section */}
        <div className="form-section">
          <h3>{t('distribution.distribution-items')}</h3>
          <div className="quick-add-section">
            <div className="quick-add-header">
              <span className="quick-add-label">{t('survey.quick-add-common')}</span>
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
                    <label className="form-label-enhanced">{t('form.category')}</label>
                    <select
                      value={item.foodType}
                      onChange={(e) => updateItem(index, 'foodType', e.target.value)}
                      className="form-control-enhanced"
                    >
                      <option value="">{t('survey.select-category')}</option>
                      {getFoodTypeOptions().map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">{t('form.product')}</label>
                    <input
                      type="text"
                      placeholder={t('survey.product-placeholder')}
                      className="form-control-enhanced"
                      value={item.product}
                      onChange={(e) => updateItem(index, 'product', e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">{t('form.quantity')}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      placeholder={t('survey.quantity-placeholder')}
                      className="form-control-enhanced"
                    />
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">{t('form.unit')}</label>
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
                    <label className="form-label-enhanced">{t('form.category')}</label>
                    <div className="category-display">
                      {item.foodType || t('survey.select-category-first')}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="form-label-enhanced">{t('form.weight')}</label>
                    <div className="weight-display">
                      {item.quantity && item.foodType ? 
                        getUnitDisplayWeight(item.quantity, item.unit, item.foodType) : 
                        t('survey.enter-quantity')
                      }
                    </div>
                  </div>
                </div>
                <div className="remove-button-container">
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="btn btn-danger remove-btn"
                      title={t('survey.remove-item')}
                    >
                      {t('survey.remove-item')}
                    </button>
                  )}
                </div>
              </div>
              <div className="item-notes-row">
                <div className="input-group notes-input-group">
                  <label className="form-label-enhanced">{t('inventory.notes')} ({t('ui.optional')})</label>
                  <input
                    type="text"
                    placeholder={t('survey.additional-notes')}
                    className="form-control-enhanced"
                    value={item.notes}
                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button onClick={addItem} className="btn btn-secondary">
            + {t('survey.add-item')}
          </button>

          {items.length > 0 && (
            <div className="distribution-summary">
              <p><strong>{t('survey.total-weight')}:</strong> {calculateTotalWeight().toFixed(1)} {t('units.lbs')}</p>
              <p><strong>{t('inventory.total-items')}:</strong> {items.filter(item => item.foodType && item.quantity).length}</p>
              {clientInfo.clientsServed && (
                <>
                  <p><strong>{t('distribution.total-clients')}:</strong> {clientInfo.clientsServed}</p>
                  <p><strong>{t('distribution.avg-per-client')}:</strong> {(calculateTotalWeight() / parseFloat(clientInfo.clientsServed)).toFixed(1)} {t('units.lbs')}</p>
                  {(clientInfo.ageGroups.kid > 0 || clientInfo.ageGroups.adult > 0 || clientInfo.ageGroups.elder > 0) && (
                    <div className="age-group-breakdown">
                      <p><strong>{t('distribution.age-demographics')}:</strong></p>
                      <ul>
                        {clientInfo.ageGroups.kid > 0 && <li>{t('distribution.children')}: {clientInfo.ageGroups.kid}</li>}
                        {clientInfo.ageGroups.adult > 0 && <li>{t('distribution.adults')}: {clientInfo.ageGroups.adult}</li>}
                        {clientInfo.ageGroups.elder > 0 && <li>{t('distribution.elderly')}: {clientInfo.ageGroups.elder}</li>}
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
            <label className="form-label-enhanced">{t('inventory.notes')}:</label>
            <textarea
              className="form-control-enhanced"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder={t('distribution.additional-notes')}
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
              {successMessage}
            </span>
          )}
          <button onClick={submitDistribution} className="btn btn-primary btn-large">
            {t('distribution.submit-distribution')}
          </button>
        </div>

        {/* Historical Distribution Items */}
        {distributionHistory.length > 0 && (
          <div className="historical-distribution-items" style={{ marginTop: '32px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#293c47', fontSize: '1.1em', fontWeight: '600' }}>
              Previously Distributed Items ({distributionHistory.length} distributions)
            </h4>
            <div className="distributions-list" style={{ display: 'grid', gap: '16px' }}>
              {distributionHistory.slice(0, 10).map((distribution, distributionIndex) => (
                <div key={distributionIndex} className="distribution-card" style={{ 
                  padding: '16px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px', 
                  border: '1px solid #dee2e6',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div className="distribution-header" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e9ecef'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600', color: '#293c47' }}>
                        {distribution.recipient || 'Unknown Recipient'}
                      </span>
                      <span style={{ color: '#6c757d', marginLeft: '8px' }}>
                        {distribution.totalDistributed?.toFixed(1)} lbs
                      </span>
                      <span style={{ color: '#6c757d', marginLeft: '8px' }}>
                        {distribution.clientsServed} clients
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
                      {new Date(distribution.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="distribution-items" style={{ display: 'grid', gap: '8px' }}>
                    {distribution.items && distribution.items.length > 0 ? (
                      distribution.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="historical-item" style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#f8f9fa', 
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div className="item-info">
                            <span style={{ fontWeight: '500', color: '#293c47' }}>
                              {item.product || 'Unnamed Item'}
                            </span>
                            <span style={{ color: '#6c757d', marginLeft: '8px' }}>
                              {item.quantity} {item.unit}
                            </span>
                            {item.foodType && (
                              <span style={{ 
                                color: '#c4a464', 
                                marginLeft: '8px', 
                                fontSize: '0.8em',
                                backgroundColor: 'rgba(196, 164, 100, 0.1)',
                                padding: '2px 6px',
                                borderRadius: '3px'
                              }}>
                                {item.foodType}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        No items recorded
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {distributionHistory.length > 10 && (
              <div style={{ marginTop: '12px', textAlign: 'center', color: '#6c757d', fontSize: '0.9em' }}>
                Showing 10 of {distributionHistory.length} distributions
              </div>
            )}
          </div>
        )}

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