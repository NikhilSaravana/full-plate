import React, { useState } from 'react';
import { MYPLATE_GOALS, SYSTEM_CONFIG } from './FoodCategoryMapper';

const ReportView = ({ currentInventory }) => {
  const [reportType, setReportType] = useState('nutritional');
  const [dateRange, setDateRange] = useState('month');

  // Nutritional Quality Scoring (inspired by Nourish system)
  const getNutritionalScoring = () => {
    const scoring = {
      green: { // Choose Often - High nutritional value
        categories: ['VEG', 'FRUIT', 'PRODUCE'],
        weight: 0,
        percentage: 0
      },
      yellow: { // Choose Sometimes - Moderate nutritional value
        categories: ['PROTEIN', 'DAIRY', 'GRAIN'],
        weight: 0,
        percentage: 0
      },
      red: { // Choose Rarely - Lower nutritional value
        categories: ['MISC'],
        weight: 0,
        percentage: 0
      }
    };

    const totalWeight = Object.values(currentInventory).reduce((sum, val) => sum + val, 0);

    Object.entries(scoring).forEach(([level, data]) => {
      data.weight = data.categories.reduce((sum, cat) => sum + (currentInventory[cat] || 0), 0);
      data.percentage = totalWeight > 0 ? ((data.weight / totalWeight) * 100).toFixed(1) : 0;
    });

    return scoring;
  };

  const getCapacityAnalysis = () => {
    const totalWeight = Object.values(currentInventory).reduce((sum, val) => sum + val, 0);
    const utilization = (totalWeight / SYSTEM_CONFIG.TARGET_CAPACITY) * 100;
    const remainingCapacity = SYSTEM_CONFIG.TARGET_CAPACITY - totalWeight;
    const totalPallets = totalWeight / SYSTEM_CONFIG.AVG_PALLET_WEIGHT;

    return {
      currentWeight: totalWeight,
      targetCapacity: SYSTEM_CONFIG.TARGET_CAPACITY,
      utilization: utilization.toFixed(1),
      remainingCapacity,
      currentPallets: totalPallets.toFixed(1),
      targetPallets: (SYSTEM_CONFIG.TARGET_CAPACITY / SYSTEM_CONFIG.AVG_PALLET_WEIGHT).toFixed(1)
    };
  };

  const exportReport = () => {
    const reportData = {
      generatedDate: new Date().toISOString(),
      reportType,
      dateRange,
      nutritionalScoring: getNutritionalScoring(),
      capacityAnalysis: getCapacityAnalysis(),
      currentInventory
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `food-bank-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const nutritionalScoring = getNutritionalScoring();
  const capacityAnalysis = getCapacityAnalysis();

  return (
    <div className="report-view">
      <div className="report-header">
        <h2>Analytics & Reports</h2>
        <div className="report-controls">
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            className="report-selector"
          >
            <option value="nutritional">Nutritional Quality Report</option>
            <option value="capacity">Capacity Analysis</option>
          </select>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="date-selector"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button onClick={exportReport} className="export-btn">
            📊 Export Report
          </button>
        </div>
      </div>

      {reportType === 'nutritional' && (
        <div className="nutritional-report">
          <h3>Nutritional Quality Analysis</h3>
          <p className="report-description">
            Based on evidence-based guidelines similar to the Nourish system, tracking green (choose often), 
            yellow (choose sometimes), and red (choose rarely) food categories.
          </p>
          
          <div className="nutritional-overview">
            <div className="nutrition-summary">
              <div className="nutrition-card green">
                <h4>🟢 Choose Often (Green)</h4>
                <p className="big-number">{nutritionalScoring.green.percentage}%</p>
                <p>{nutritionalScoring.green.weight.toLocaleString()} lbs</p>
                <p className="categories">Vegetables, Fruits, Fresh Produce</p>
              </div>
              <div className="nutrition-card yellow">
                <h4>🟡 Choose Sometimes (Yellow)</h4>
                <p className="big-number">{nutritionalScoring.yellow.percentage}%</p>
                <p>{nutritionalScoring.yellow.weight.toLocaleString()} lbs</p>
                <p className="categories">Proteins, Dairy, Grains</p>
              </div>
              <div className="nutrition-card red">
                <h4>🔴 Choose Rarely (Red)</h4>
                <p className="big-number">{nutritionalScoring.red.percentage}%</p>
                <p>{nutritionalScoring.red.weight.toLocaleString()} lbs</p>
                <p className="categories">Processed/Misc Items</p>
              </div>
            </div>
          </div>

          <div className="nutritional-recommendations">
            <h4>Recommendations</h4>
            <ul>
              {parseFloat(nutritionalScoring.green.percentage) < 40 && 
                <li className="recommendation warning">
                  ⚠️ Increase fresh produce and vegetables to improve nutritional quality
                </li>
              }
              {parseFloat(nutritionalScoring.red.percentage) > 20 && 
                <li className="recommendation warning">
                  ⚠️ Reduce processed/miscellaneous foods
                </li>
              }
              {parseFloat(nutritionalScoring.green.percentage) >= 40 && 
                <li className="recommendation success">
                  ✅ Good nutritional quality
                </li>
              }
            </ul>
          </div>
        </div>
      )}

      {reportType === 'capacity' && (
        <div className="capacity-report">
          <h3>Warehouse Capacity Analysis</h3>
          <div className="capacity-grid">
            <div className="capacity-card">
              <h4>Current Utilization</h4>
              <div className="capacity-visual">
                <div className="capacity-bar">
                  <div 
                    className="capacity-fill" 
                    style={{width: `${capacityAnalysis.utilization}%`}}
                  ></div>
                </div>
                <p className="capacity-percentage">{capacityAnalysis.utilization}%</p>
              </div>
              <p>{capacityAnalysis.currentWeight.toLocaleString()} / {capacityAnalysis.targetCapacity.toLocaleString()} lbs</p>
            </div>
            
            <div className="capacity-card">
              <h4>Remaining Capacity</h4>
              <p className="big-number">{capacityAnalysis.remainingCapacity.toLocaleString()}</p>
              <p>pounds available</p>
            </div>
            
            <div className="capacity-card">
              <h4>Pallet Usage</h4>
              <p className="big-number">{capacityAnalysis.currentPallets}</p>
              <p>of {capacityAnalysis.targetPallets} total pallets</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportView;
