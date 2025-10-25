import React, { useState } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const RestockingRecommender = ({ recommendations, onSettingsChange }) => {
  const { t } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [leadTime, setLeadTime] = useState(7);
  const [safetyStock, setSafetyStock] = useState(7);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="restocking-recommender">
        <h3>Smart Restocking Recommendations</h3>
        <div className="no-recommendations">
          <p>No urgent restocking needed at this time</p>
          <p className="subtitle">All categories are adequately stocked based on current usage patterns</p>
        </div>
      </div>
    );
  }

  const handleSettingsUpdate = () => {
    if (onSettingsChange) {
      onSettingsChange({ leadTimeDays: leadTime, safetyStockDays: safetyStock });
    }
    setShowSettings(false);
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      default: return 'priority-low';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'critical': return 'CRITICAL';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      default: return 'LOW';
    }
  };

  const exportToCsv = () => {
    let csv = 'Category,Current Stock (lbs),Target Stock (lbs),Recommended Order (lbs),Priority,Days Until Stockout,Avg Daily Usage (lbs),Reasoning\n';
    
    recommendations.forEach(rec => {
      csv += `${rec.category},${rec.currentStock},${rec.targetStock},${rec.recommendedOrder},${rec.priority},${rec.daysUntilStockout},${rec.avgDailyUsage},"${rec.reasoning}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `restocking-recommendations-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const criticalRecs = recommendations.filter(r => r.priority === 'critical');
  const totalOrderAmount = recommendations.reduce((sum, rec) => sum + rec.recommendedOrder, 0);

  return (
    <div className="restocking-recommender">
      <div className="section-header-with-actions">
        <div>
          <h3>Smart Restocking Recommendations</h3>
          <p className="section-subtitle">
            Calculated with {leadTime}-day lead time + {safetyStock}-day safety buffer
          </p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn-light"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
          </button>
          <button 
            className="btn btn-secondary"
            onClick={exportToCsv}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <h4>Calculation Settings</h4>
          <div className="settings-grid">
            <div className="setting-field">
              <label>Lead Time (days):</label>
              <input 
                type="number" 
                min="1" 
                max="30" 
                value={leadTime}
                onChange={(e) => setLeadTime(parseInt(e.target.value))}
              />
              <small>Time from order to delivery</small>
            </div>
            <div className="setting-field">
              <label>Safety Stock (days):</label>
              <input 
                type="number" 
                min="1" 
                max="30" 
                value={safetyStock}
                onChange={(e) => setSafetyStock(parseInt(e.target.value))}
              />
              <small>Additional buffer for demand variability</small>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleSettingsUpdate}>
            Update Calculations
          </button>
        </div>
      )}

      {criticalRecs.length > 0 && (
        <div className="critical-recommendations-banner">
          <strong>URGENT:</strong> {criticalRecs.length} category(s) require immediate ordering
        </div>
      )}

      <div className="recommendations-summary">
        <div className="summary-card">
          <span className="summary-label">Total Items to Order:</span>
          <span className="summary-value">{recommendations.length} categories</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Order Weight:</span>
          <span className="summary-value">{Math.round(totalOrderAmount).toLocaleString()} lbs</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Critical Priority:</span>
          <span className="summary-value critical">{criticalRecs.length}</span>
        </div>
      </div>

      <div className="recommendations-list">
        {recommendations.map((rec, index) => (
          <div key={rec.category} className={`recommendation-card ${getPriorityClass(rec.priority)}`}>
            <div className="recommendation-header">
              <div className="recommendation-rank">#{index + 1}</div>
              <div className="recommendation-title">
                <span className={`priority-label-badge ${rec.priority}`}>{getPriorityLabel(rec.priority)}</span>
                <h4>{rec.category}</h4>
                <span className={`priority-badge ${rec.priority}`}>
                  {rec.priority.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="recommendation-metrics">
              <div className="metric-group">
                <div className="metric">
                  <span className="metric-label">Current Stock</span>
                  <span className="metric-value">{rec.currentStock.toLocaleString()} lbs</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Target Stock</span>
                  <span className="metric-value target">{rec.targetStock.toLocaleString()} lbs</span>
                </div>
                <div className="metric highlight">
                  <span className="metric-label">Recommended Order</span>
                  <span className="metric-value order">{rec.recommendedOrder.toLocaleString()} lbs</span>
                </div>
              </div>

              <div className="metric-group secondary">
                <div className="metric-small">
                  <span className="metric-label">Days Until Stockout:</span>
                  <span className="metric-value">{rec.daysUntilStockout}</span>
                </div>
                <div className="metric-small">
                  <span className="metric-label">Avg Daily Usage:</span>
                  <span className="metric-value">{rec.avgDailyUsage} lbs/day</span>
                </div>
              </div>
            </div>

            <div className="recommendation-reasoning">
              <strong>Reasoning:</strong> {rec.reasoning}
            </div>

            {rec.priority === 'critical' && (
              <div className="recommendation-action-bar">
                <button className="btn-action-primary">Create Purchase Order</button>
                <button className="btn-action-secondary">Contact Supplier</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="recommendations-footer">
        <div className="footer-note">
          <strong>Note:</strong> Recommendations are based on recent distribution patterns. 
          Adjust lead time and safety stock settings if your supply chain or demand patterns change.
        </div>
      </div>
    </div>
  );
};

export default RestockingRecommender;

