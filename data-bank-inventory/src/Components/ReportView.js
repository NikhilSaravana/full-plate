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

  const getMyPlateCompliance = () => {
    const totalWeight = Object.values(currentInventory).reduce((sum, val) => sum + val, 0);
    const compliance = {};

    Object.entries(MYPLATE_GOALS).forEach(([category, goals]) => {
      const currentWeight = currentInventory[category] || 0;
      const currentPercentage = totalWeight > 0 ? (currentWeight / totalWeight) * 100 : 0;
      const goalPercentage = goals.percentage;
      const variance = currentPercentage - goalPercentage;
      
      compliance[category] = {
        current: currentPercentage.toFixed(1),
        goal: goalPercentage,
        variance: variance.toFixed(1),
        status: Math.abs(variance) <= 2 ? 'COMPLIANT' : variance > 2 ? 'OVER' : 'UNDER',
        weight: currentWeight
      };
    });

    return compliance;
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

  const generateHealthcareReport = () => {
    const nutritional = getNutritionalScoring();
    const compliance = getMyPlateCompliance();
    
    // Healthcare partnership ready metrics
    return {
      nutritionalQuality: parseFloat(nutritional.green.percentage) + parseFloat(nutritional.yellow.percentage),
      myPlateCompliance: Object.values(compliance).filter(cat => cat.status === 'COMPLIANT').length,
      totalCategories: Object.keys(compliance).length,
      greenFoodPercentage: nutritional.green.percentage,
      recommendationReady: parseFloat(nutritional.green.percentage) >= 60 // 60% green foods threshold
    };
  };

  const exportReport = () => {
    const reportData = {
      generatedDate: new Date().toISOString(),
      reportType,
      dateRange,
      nutritionalScoring: getNutritionalScoring(),
      myPlateCompliance: getMyPlateCompliance(),
      capacityAnalysis: getCapacityAnalysis(),
      healthcareMetrics: generateHealthcareReport(),
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
  const myPlateCompliance = getMyPlateCompliance();
  const capacityAnalysis = getCapacityAnalysis();
  const healthcareReport = generateHealthcareReport();

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
            <option value="myplate">MyPlate Compliance Report</option>
            <option value="capacity">Capacity Analysis</option>
            <option value="healthcare">Healthcare Partnership Report</option>
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
                  ⚠️ Reduce processed/miscellaneous foods to meet healthcare standards
                </li>
              }
              {parseFloat(nutritionalScoring.green.percentage) >= 40 && 
                <li className="recommendation success">
                  ✅ Good nutritional quality - suitable for healthcare partnerships
                </li>
              }
            </ul>
          </div>
        </div>
      )}

      {reportType === 'myplate' && (
        <div className="myplate-report">
          <h3>MyPlate Compliance Analysis</h3>
          <div className="compliance-table">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Current %</th>
                  <th>Goal %</th>
                  <th>Variance</th>
                  <th>Status</th>
                  <th>Weight (lbs)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(myPlateCompliance).map(([category, data]) => (
                  <tr key={category} className={`status-${data.status.toLowerCase()}`}>
                    <td className="category-name">{category}</td>
                    <td>{data.current}%</td>
                    <td>{data.goal}%</td>
                    <td className={parseFloat(data.variance) > 0 ? 'positive' : 'negative'}>
                      {data.variance > 0 ? '+' : ''}{data.variance}%
                    </td>
                    <td>
                      <span className={`status-badge ${data.status.toLowerCase()}`}>
                        {data.status}
                      </span>
                    </td>
                    <td>{data.weight.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {reportType === 'healthcare' && (
        <div className="healthcare-report">
          <h3>Healthcare Partnership Readiness Report</h3>
          <p className="report-description">
            Assessment of food quality standards for healthcare provider partnerships and potential Medicaid reimbursement programs.
          </p>
          
          <div className="healthcare-metrics">
            <div className="metric-card">
              <h4>Nutritional Quality Score</h4>
              <p className="big-number">{healthcareReport.nutritionalQuality.toFixed(1)}%</p>
              <p>Green + Yellow foods</p>
              <div className={`status-indicator ${healthcareReport.nutritionalQuality >= 80 ? 'good' : 'needs-improvement'}`}>
                {healthcareReport.nutritionalQuality >= 80 ? '✅ Healthcare Ready' : '⚠️ Needs Improvement'}
              </div>
            </div>
            
            <div className="metric-card">
              <h4>MyPlate Compliance</h4>
              <p className="big-number">{healthcareReport.myPlateCompliance}/{healthcareReport.totalCategories}</p>
              <p>categories compliant</p>
              <div className={`status-indicator ${healthcareReport.myPlateCompliance >= 5 ? 'good' : 'needs-improvement'}`}>
                {healthcareReport.myPlateCompliance >= 5 ? '✅ Standards Met' : '⚠️ Standards Not Met'}
              </div>
            </div>
            
            <div className="metric-card">
              <h4>Green Food Percentage</h4>
              <p className="big-number">{healthcareReport.greenFoodPercentage}%</p>
              <p>highly nutritious foods</p>
              <div className={`status-indicator ${healthcareReport.recommendationReady ? 'good' : 'needs-improvement'}`}>
                {healthcareReport.recommendationReady ? '✅ Referral Ready' : '⚠️ Not Referral Ready'}
              </div>
            </div>
          </div>

          <div className="healthcare-recommendations">
            <h4>Healthcare Partnership Recommendations</h4>
            <div className="recommendations-list">
              {healthcareReport.recommendationReady ? (
                <div className="recommendation success">
                  <strong>✅ Ready for Healthcare Partnerships</strong>
                  <p>Your food inventory meets quality standards for healthcare provider referrals and potential Medicaid reimbursement programs.</p>
                </div>
              ) : (
                <div className="recommendation warning">
                  <strong>⚠️ Improvement Needed for Healthcare Partnerships</strong>
                  <p>Increase fresh produce and reduce processed foods to meet healthcare standards.</p>
                </div>
              )}
              
              <div className="action-items">
                <h5>Next Steps:</h5>
                <ul>
                  <li>Maintain detailed nutritional tracking records</li>
                  <li>Document food sourcing and safety protocols</li>
                  <li>Establish relationships with local healthcare providers</li>
                  <li>Consider implementing digital ordering system for clients</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportView;
