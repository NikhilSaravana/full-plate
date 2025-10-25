import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const KeyboardShortcuts = () => {
  const { t } = useLanguage();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts = [
    { key: 'Ctrl + /', description: 'Show/hide keyboard shortcuts', action: 'toggle-help' },
    { key: 'Ctrl + K', description: 'Open global search', action: 'open-search' },
    { key: 'Ctrl + D', description: 'Toggle dark mode', action: 'toggle-theme' },
    { key: 'Ctrl + N', description: 'Add new item', action: 'add-item' },
    { key: 'Ctrl + S', description: 'Save current form', action: 'save-form' },
    { key: 'Ctrl + E', description: 'Export data', action: 'export-data' },
    { key: 'Ctrl + P', description: 'Print current view', action: 'print-view' },
    { key: 'Escape', description: 'Close modals/dropdowns', action: 'close-modal' },
    { key: 'Tab', description: 'Navigate between fields', action: 'navigate' },
    { key: 'Enter', description: 'Submit forms', action: 'submit' }
  ];

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl + / to toggle help
      if (event.ctrlKey && event.key === '/') {
        event.preventDefault();
        setShowHelp(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!showHelp) return null;

  return (
    <div className="keyboard-shortcuts-overlay">
      <div className="keyboard-shortcuts-modal">
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button 
            className="close-shortcuts"
            onClick={() => setShowHelp(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="shortcuts-content">
          <div className="shortcuts-grid">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="shortcut-item">
                <div className="shortcut-key">
                  <kbd>{shortcut.key}</kbd>
                </div>
                <div className="shortcut-description">
                  {shortcut.description}
                </div>
              </div>
            ))}
          </div>
          
          <div className="shortcuts-footer">
            <p>Press <kbd>Ctrl + /</kbd> to toggle this help</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
