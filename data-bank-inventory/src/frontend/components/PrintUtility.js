import React from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const PrintUtility = ({ onPrint }) => {
  const { t } = useLanguage();

  const handlePrint = () => {
    // Add print header
    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.innerHTML = `
      <h1>Food Bank Inventory Report</h1>
      <div class="print-date">Generated on ${new Date().toLocaleDateString()}</div>
    `;
    
    // Insert print header at the beginning of the content
    const content = document.querySelector('.dashboard-content');
    if (content) {
      content.insertBefore(printHeader, content.firstChild);
    }

    // Trigger print
    window.print();

    // Clean up print header after printing
    setTimeout(() => {
      if (printHeader.parentNode) {
        printHeader.parentNode.removeChild(printHeader);
      }
    }, 1000);

    if (onPrint) {
      onPrint();
    }
  };

  return (
    <button 
      onClick={handlePrint}
      className="btn btn-light"
      title="Print current view"
    >
      🖨️ Print
    </button>
  );
};

export default PrintUtility;