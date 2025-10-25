import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';

const BulkOperations = ({ onBulkAction, selectedItems = [], onClearSelection }) => {
  const { t } = useLanguage();
  const { showSuccess, showError } = useNotifications();
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');

  const handleBulkAction = (action) => {
    if (selectedItems.length === 0) {
      showError('No Selection', 'Please select items to perform bulk operations');
      return;
    }

    setBulkAction(action);
    setBulkValue('');
    setShowBulkMenu(true);
  };

  const executeBulkAction = () => {
    if (!bulkAction || selectedItems.length === 0) return;

    try {
      const actionData = {
        action: bulkAction,
        value: bulkValue,
        items: selectedItems
      };

      if (onBulkAction) {
        onBulkAction(actionData);
      }

      showSuccess(
        'Bulk Action Completed', 
        `${bulkAction} applied to ${selectedItems.length} items`
      );

      setShowBulkMenu(false);
      setBulkAction('');
      setBulkValue('');
      
      if (onClearSelection) {
        onClearSelection();
      }
    } catch (error) {
      showError('Bulk Action Failed', error.message);
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'update_category': return 'Update Category';
      case 'update_quantity': return 'Update Quantity';
      case 'add_notes': return 'Add Notes';
      case 'delete': return 'Delete Items';
      case 'export': return 'Export Selected';
      default: return action;
    }
  };

  const getActionInput = () => {
    switch (bulkAction) {
      case 'update_category':
        return (
          <select 
            value={bulkValue} 
            onChange={(e) => setBulkValue(e.target.value)}
            className="form-control-enhanced"
          >
            <option value="">Select Category</option>
            <option value="DAIRY">Dairy</option>
            <option value="GRAIN">Grain</option>
            <option value="PROTEIN">Protein</option>
            <option value="FRUIT">Fruit</option>
            <option value="VEG">Vegetables</option>
            <option value="PRODUCE">Produce</option>
            <option value="MISC">Miscellaneous</option>
          </select>
        );
      case 'update_quantity':
        return (
          <input
            type="number"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="Enter quantity"
            className="form-control-enhanced"
          />
        );
      case 'add_notes':
        return (
          <textarea
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="Enter notes to add to all items"
            className="form-control-enhanced"
            rows="3"
          />
        );
      default:
        return null;
    }
  };

  if (selectedItems.length === 0) {
    return null;
  }

  return (
    <div className="bulk-operations">
      <div className="bulk-selection-info">
        <span className="selection-count">
          {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
        </span>
        <button 
          className="btn btn-light btn-sm"
          onClick={onClearSelection}
        >
          Clear Selection
        </button>
      </div>

      <div className="bulk-actions">
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => handleBulkAction('update_category')}
        >
          Update Category
        </button>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => handleBulkAction('update_quantity')}
        >
          Update Quantity
        </button>
        <button 
          className="btn btn-warning btn-sm"
          onClick={() => handleBulkAction('add_notes')}
        >
          Add Notes
        </button>
        <button 
          className="btn btn-light btn-sm"
          onClick={() => handleBulkAction('export')}
        >
          Export Selected
        </button>
        <button 
          className="btn btn-danger btn-sm"
          onClick={() => handleBulkAction('delete')}
        >
          Delete Selected
        </button>
      </div>

      {showBulkMenu && (
        <div className="bulk-action-modal">
          <div className="bulk-action-content">
            <h3>{getActionLabel(bulkAction)}</h3>
            <p>This will apply to {selectedItems.length} selected items.</p>
            
            {getActionInput()}
            
            <div className="bulk-action-buttons">
              <button 
                className="btn btn-primary"
                onClick={executeBulkAction}
                disabled={!bulkValue && bulkAction !== 'delete' && bulkAction !== 'export'}
              >
                Apply to {selectedItems.length} Items
              </button>
              <button 
                className="btn btn-light"
                onClick={() => setShowBulkMenu(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkOperations;