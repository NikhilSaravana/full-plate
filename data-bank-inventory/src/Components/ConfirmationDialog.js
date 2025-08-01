import React from 'react';

const ConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Yes, Continue", 
  cancelText = "Cancel",
  type = "danger" // danger, warning, info
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '!';
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      default:
        return '?';
    }
  };

  return (
    <div className="confirmation-overlay" onClick={handleOverlayClick}>
      <div className="confirmation-dialog">
        <div className="confirmation-title">
          <span className="btn-icon" style={{ marginRight: '8px' }}>
            {getIcon()}
          </span>
          {title}
        </div>
        <div className="confirmation-message">
          {message}
        </div>
        <div className="confirmation-actions">
          <button 
            type="button"
            className="btn btn-light"
            onClick={onClose}
            style={{ minWidth: '100px' }}
          >
            {cancelText}
          </button>
          <button 
            type="button"
            className={`btn ${type === 'danger' ? 'btn-danger' : type === 'warning' ? 'btn-warning' : 'btn-primary'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ minWidth: '100px' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog; 