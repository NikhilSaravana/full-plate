import React, { useState } from 'react';
import { getMyPlateCategory } from '../../backend/utils/FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import * as XLSX from 'xlsx';

// High-level categories for simplified selection
export const MAIN_FOOD_CATEGORIES = ['VEG', 'FRUIT', 'DAIRY', 'GRAIN', 'PROTEIN', 'PRODUCE', 'MISC'];

const SurveyInterface = ({ onDataSubmit, unitConfig, successMessage }) => {
  const { t } = useLanguage();
  const [surveyMode, setSurveyMode] = useState('SINGLE'); // SINGLE, BULK, DISTRIBUTION
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format in local timezone
    source: 'Direct Donation',
    notes: ''
  });
  const [items, setItems] = useState([
    { foodType: '', product: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }
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

  
  const normalizeUnitKey = (raw) => {
    if (!raw) return 'POUND';
    const value = String(raw).trim();
    const upper = value.toUpperCase();
    const available = unitConverters.getAvailableUnits();
    const byKey = available.find(u => u.key === upper);
    if (byKey) return byKey.key;
    const byAbbrev = available.find(u => (u.abbreviation || '').toUpperCase() === upper);
    if (byAbbrev) return byAbbrev.key;
    const byName = available.find(u => (u.name || '').toUpperCase() === upper);
    if (byName) return byName.key;
    return 'POUND';
  };

  // Normalize a category into one of MAIN_FOOD_CATEGORIES, else empty string
  const normalizeCategory = (raw) => {
    const value = String(raw || '').trim().toUpperCase();
    if (MAIN_FOOD_CATEGORIES.includes(value)) return value;
    return '';
  };

  const addItem = () => {
    setItems([{ foodType: '', product: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }, ...items]);
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
    if (unit === 'POUND' || unit === 'POUNDS') return numQuantity;
    return unitConverters.convertToStandardWeight(numQuantity, unit, category);
  };

  const handleBulkDataParse = () => {
    try {
      // Parse CSV-like data: "Category, Product, Quantity, Unit, Expiration"
      const lines = bulkData.split('\n').filter(line => line.trim());
      const parsedItems = lines
        .map(line => {
          const parts = line.split(',').map(part => part.trim());
          return {
            foodType: normalizeCategory(parts[0] || ''), 
            product: parts[1] || '', 
            quantity: parts[2] || '',
            unit: normalizeUnitKey(parts[3] || 'POUND'),
            expirationDate: parts[4] || '',
            notes: parts[5] || ''
          };
        })
        .filter(item => item.foodType && item.quantity);
      setItems(parsedItems);
      setBulkData('');
      setSurveyMode('SINGLE');
    } catch (error) {
      setConfirmationConfig({
        type: 'error',
        title: t('survey.parsing-error'),
        message: t('survey.parsing-error-message'),
        confirmText: t('ui.ok'),
        onConfirm: () => setShowConfirmation(false)
      });
      setShowConfirmation(true);
    }
  };

  
  const handleBulkFileUpload = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result || '';
      setBulkData(typeof text === 'string' ? text : '');
    };
    reader.readAsText(file);
  };

  // Import from Excel file
  const handleExcelUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
      const parsedItems = rows
        .filter(r => Array.isArray(r) && r.some(cell => String(cell || '').trim().length))
        .map(parts => ({
          foodType: normalizeCategory(parts[0]),
          product: (parts[1] || '').toString().trim(),
          quantity: (parts[2] || '').toString().trim(),
          unit: normalizeUnitKey(parts[3]),
          expirationDate: (parts[4] || '').toString().trim(),
          notes: (parts[5] || '').toString().trim()
        }))
        .filter(item => item.foodType && item.quantity);

      if (parsedItems.length > 0) {
        setItems(parsedItems);
        setBulkData('');
        setSurveyMode('SINGLE');
        setConfirmationConfig({
          type: 'success',
          title: t('survey.import-success'),
          message: t('survey.import-success-message'),
          confirmText: t('ui.ok'),
          onConfirm: () => setShowConfirmation(false)
        });
        setShowConfirmation(true);
      } else {
        setConfirmationConfig({
          type: 'error',
          title: t('survey.parsing-error'),
          message: t('survey.parsing-error-message'),
          confirmText: t('ui.ok'),
          onConfirm: () => setShowConfirmation(false)
        });
        setShowConfirmation(true);
      }
    } catch (err) {
      setConfirmationConfig({
        type: 'error',
        title: t('survey.parsing-error'),
        message: t('survey.parsing-error-message'),
        confirmText: t('ui.ok'),
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
        title: t('survey.missing-info'),
        message: t('survey.missing-info-message'),
        confirmText: t('ui.ok'),
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
          const category = item.foodType;
          const weightInPounds = getWeightInPounds(item.quantity, item.unit, category);
          categoryTotals[category] = (categoryTotals[category] || 0) + weightInPounds;
        }
      });
      surveyData.categoryTotals = categoryTotals;
      
      // Add converted weights for reference
      surveyData.itemsWithConvertedWeights = items.map(item => ({
        ...item,
        weightInPounds: item.quantity ? getWeightInPounds(item.quantity, item.unit, item.foodType) : 0
      }));
    }

    if (onDataSubmit) {
      try {
        onDataSubmit(surveyData);
      } catch (error) {
        console.error('Error submitting survey data:', error);
        setConfirmationConfig({
          type: 'error',
          title: 'Submission Failed',
          message: 'Failed to save survey data. Please try again.',
          confirmText: 'OK',
          onConfirm: () => setShowConfirmation(false)
        });
        setShowConfirmation(true);
        return; // Don't reset form on error
      }
    }

    // Reset form
    setItems([{ foodType: '', product: '', quantity: '', unit: 'POUND', expirationDate: '', notes: '' }]);
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

  const calculateTotalWeight = () => {
    return items.reduce((total, item) => {
      if (item.quantity && item.foodType) {
        const category = item.foodType;
        return total + getWeightInPounds(item.quantity, item.unit, category);
      }
      return total;
    }, 0);
  };

  const getUnitDisplayWeight = (quantity, unit, category) => {
    if (!quantity || !unit) return '';
    const weightInPounds = getWeightInPounds(quantity, unit, category);
    if (unit === 'POUND' || unit === 'POUNDS') {
      return `${quantity} lbs`;
    }
    return `${quantity} ${unitConverters.getAvailableUnits().find(u => u.key === unit)?.abbreviation} (${weightInPounds.toFixed(1)} lbs)`;
  };

  return (
    <div className="survey-interface">
      <div className="survey-header">
        <h2>{t('survey.title')}</h2>
        <div className="nav-with-icons" style={{ marginBottom: '24px' }}>
          <button
            className={`nav-tab ${surveyMode === 'SINGLE' ? 'active' : ''}`}
            onClick={() => setSurveyMode('SINGLE')}
          >
            {t('subtabs.single-entry')}
          </button>
          <button
            className={`nav-tab ${surveyMode === 'BULK' ? 'active' : ''}`}
            onClick={() => setSurveyMode('BULK')}
          >
            {t('subtabs.bulk-import')}
          </button>
        </div>
      </div>

      <div className="survey-form">
        {/* Common Form Fields */}
        <div className="form-section">
          <h3>{t('survey.general-information')}</h3>
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
              <label className="form-label-enhanced">{t('inventory.source')}:</label>
              <select
                className="form-control-enhanced"
                value={formData.source}
                onChange={(e) => setFormData({...formData, source: e.target.value})}
              >
                <option value="Direct Donation">{t('source.direct-donation')}</option>
                <option value="NTFB AE">{t('source.ntfb-ae')}</option>
                <option value="Local Farm">{t('source.local-farm')}</option>
                <option value="Food Drive">{t('source.food-drive')}</option>
                <option value="Purchase">{t('source.purchase')}</option>
                <option value="Government">{t('source.government')}</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label-enhanced">{t('inventory.notes')}:</label>
            <textarea
              className="form-control-enhanced"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder={t('survey.additional-notes')}
              rows="3"
            />
          </div>
        </div>

        {/* Single Entry Mode */}
        {surveyMode === 'SINGLE' && (
          <div className="form-section">
            <h3>{t('survey.inventory-items')}</h3>
            <div className="quick-add-section">
              <div className="quick-add-header">
                <span className="quick-add-label">{t('survey.quick-add-common')}</span>
              </div>
              <div className="quick-add-buttons">
                {getQuickAddButtons().map(item => (
                  <button
                    key={`${item.category}-${item.product}`}
                    className="btn btn-light quick-add-item"
                    onClick={() => {
                      // Find first empty item (no foodType and no quantity)
                      const emptyIndex = items.findIndex(i => !i.foodType && !i.quantity);
                      const newItem = { 
                        foodType: item.category, 
                        product: item.product, 
                        quantity: '', 
                        unit: 'POUND', 
                        expirationDate: '', 
                        notes: '' 
                      };
                      if (emptyIndex !== -1) {
                        // Replace the empty item
                        const updated = [...items];
                        updated[emptyIndex] = newItem;
                        setItems(updated);
                      } else {
                        // Add a new item at the top
                        setItems([newItem, ...items]);
                      }
                    }}
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
                        {getFoodTypeOptions().map(option => (
                          <option key={option} value={option}>{option}</option>
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
                        placeholder={t('survey.quantity-placeholder')}
                        className="form-control-enhanced"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
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
                      <label className="form-label-enhanced">{t('form.expiration')}</label>
                      <input
                        type="date"
                        placeholder={t('form.expiration')}
                        className="form-control-enhanced"
                        value={item.expirationDate}
                        onChange={(e) => updateItem(index, 'expirationDate', e.target.value)}
                      />
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

            <button onClick={addItem} className="btn btn-primary" style={{ marginTop: '16px' }}>
              + {t('survey.add-item')}
            </button>

            {items.length > 0 && (
              <div className="entry-summary">
                <p><strong>{t('survey.total-weight')}:</strong> {calculateTotalWeight().toFixed(1)} {t('units.lbs')}</p>
                <p><strong>{t('inventory.total-items')}:</strong> {items.filter(item => item.foodType && item.quantity).length}</p>
              </div>
            )}
          </div>
        )}

        {/* Bulk Import Mode */}
        {surveyMode === 'BULK' && (
          <div className="form-section">
            <h3>{t('survey.bulk-import')}</h3>
            <p className="help-text">
              {t('survey.bulk-instructions')}
              <br />
              {t('survey.bulk-format')}
              <br />
              {t('survey.categories')}: {MAIN_FOOD_CATEGORIES.join(', ')}
              <br />
              {t('survey.available-units')}: {unitConverters.getAvailableUnits().map(u => u.abbreviation).join(', ')}
            </p>
            <div className="bulk-upload-controls">
              <div className="file-input-group">
                <label className="form-label-enhanced">{t('survey.upload-csv-txt')}</label>
                <input className="file-input" type="file" accept=".csv,.txt" onChange={handleBulkFileUpload} />
              </div>
              <div className="file-input-group">
                <label className="form-label-enhanced">{t('survey.upload-xlsx')}</label>
                <input className="file-input" type="file" accept=".xlsx" onChange={handleExcelUpload} />
              </div>
            </div>
            <div className="help-text" style={{ marginBottom: '8px' }}>
              <div><strong>Example:</strong></div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f9', padding: '8px', borderRadius: '4px' }}>GRAIN, Bread, 5, PALLET, 2024-02-15, From food drive
DAIRY, Milk, 20, CASE, 2024-02-10
GRAIN, Rice, 1000, POUND, 2025-01-01</pre>
              <div>Excel columns: Category | Product | Quantity | Unit | Expiration (YYYY-MM-DD) | Notes</div>
            </div>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder="GRAIN, Bread, 5, PALLET, 2024-02-15, From food drive&#10;DAIRY, Milk, 20, CASE, 2024-02-10&#10;GRAIN, Rice, 1000, POUND, 2025-01-01"
              rows="10"
              className="form-control-enhanced"
            />
            <button onClick={handleBulkDataParse} className="btn btn-primary" style={{ marginTop: '16px' }}>
              {t('survey.bulk-parse')}
            </button>
          </div>
        )}

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
          <button onClick={submitSurvey} className="btn btn-primary btn-large">
            {t('survey.submit')}
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