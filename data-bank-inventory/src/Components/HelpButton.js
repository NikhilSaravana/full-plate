import React, { useState } from 'react';
import './HelpButton.css';

const HelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleHelp = () => {
    setIsOpen(!isOpen);
  };

  const closeHelp = () => {
    setIsOpen(false);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText('fullplateusa@gmail.com');
  };

  return (
    <>
      {/* Help Button */}
      <button 
        className="help-button" 
        onClick={toggleHelp}
        title="Get Help"
        aria-label="Open help menu"
      >
        <span className="help-icon">?</span>
      </button>

      {/* Help Modal */}
      {isOpen && (
        <div className="help-overlay" onClick={closeHelp}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-header">
              <h3>Need Help?</h3>
              <button className="help-close" onClick={closeHelp} aria-label="Close help">
                ×
              </button>
            </div>
            <div className="help-content">
              <p>If you need assistance or have any questions, please contact our team:</p>
              <div className="contact-info">
                <div className="email-section">
                  <label>Email:</label>
                  <div className="email-container">
                    <span className="email-address">fullplateusa@gmail.com</span>
                    <button 
                      className="copy-btn" 
                      onClick={copyEmail}
                      title="Copy email to clipboard"
                    >
                      Copy Email
                    </button>
                  </div>
                </div>
            
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpButton;
