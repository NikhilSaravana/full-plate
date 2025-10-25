import React, { useState } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const StockoutPredictor = ({ predictions, onTimeframeChange }) => {
  const { t } = useLanguage();
  const [selectedTimeframe, setSelectedTimeframe] = useState(7);

  if (!predictions || Object.keys(predictions).length === 0) {
    return (
      <div className="stockout-predictor">
        <h3>Stockout Predictions</h3>
        <p className="no-data">No prediction data available. Need recent distribution history.</p>
      </div>
    );
  }

  const handleTimeframeChange = (days) => {
    setSelectedTimeframe(days);
    if (onTimeframeChange) {
      onTimeframeChange(days);
    }
  };

  const getUrgencyClass = (urgency) => {
    switch (urgency) {
      case 'critical': return 'urgency-critical';
      case 'high': return 'urgency-high';
      case 'medium': return 'urgency-medium';
      case 'low': return 'urgency-low';
      default: return 'urgency-none';
    }
  };

  const getUrgencyLabel = (urgency) => {
    switch (urgency) {
      case 'critical': return 'CRITICAL';
      case 'high': return 'HIGH';
      case 'medium': return 'MEDIUM';
      case 'low': return 'LOW';
      default: return 'OK';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Sort by urgency
  const sortedPredictions = Object.entries(predictions).sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    return urgencyOrder[a[1].urgency] - urgencyOrder[b[1].urgency];
  });

  const criticalCount = sortedPredictions.filter(([_, data]) => data.urgency === 'critical').length;
  const highCount = sortedPredictions.filter(([_, data]) => data.urgency === 'high').length;

  return (
    <div className="stockout-predictor">
      <div className="section-header-with-controls">
        <div>
          <h3>Stockout Predictions</h3>
          <p className="section-subtitle">Based on {selectedTimeframe}-day average distribution rate</p>
        </div>
        
        <div className="timeframe-selector">
          <span className="selector-label">Calculation Period:</span>
          <button 
            className={`btn-timeframe ${selectedTimeframe === 7 ? 'active' : ''}`}
            onClick={() => handleTimeframeChange(7)}
          >
            7 Days
          </button>
          <button 
            className={`btn-timeframe ${selectedTimeframe === 14 ? 'active' : ''}`}
            onClick={() => handleTimeframeChange(14)}
          >
            14 Days
          </button>
          <button 
            className={`btn-timeframe ${selectedTimeframe === 30 ? 'active' : ''}`}
            onClick={() => handleTimeframeChange(30)}
          >
            30 Days
          </button>
        </div>
      </div>

      {(criticalCount > 0 || highCount > 0) && (
        <div className="stockout-alert-banner">
          <strong>ACTION REQUIRED:</strong> 
          {criticalCount > 0 && ` ${criticalCount} category(s) at critical risk of stockout`}
          {criticalCount > 0 && highCount > 0 && ', '}
          {highCount > 0 && ` ${highCount} category(s) at high risk`}
        </div>
      )}

      <div className="predictions-list">
        {sortedPredictions.map(([category, data]) => (
          <div key={category} className={`prediction-card ${getUrgencyClass(data.urgency)}`}>
            <div className="prediction-header">
              <div className="prediction-title">
                <span className={`urgency-badge ${data.urgency}`}>{getUrgencyLabel(data.urgency)}</span>
                <h4>{category}</h4>
              </div>
              <div className="prediction-days">
                {data.daysUntilStockout === 0 ? (
                  <span className="stockout-now">OUT OF STOCK</span>
                ) : (
                  <span className="days-remaining">
                    <strong>{data.daysUntilStockout}</strong> days
                  </span>
                )}
              </div>
            </div>

            <div className="prediction-details">
              <div className="detail-row">
                <span className="detail-label">Current Stock:</span>
                <span className="detail-value">{Math.round(data.currentStock)} lbs</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Daily Usage:</span>
                <span className="detail-value">{data.avgDailyDistribution} lbs/day</span>
              </div>
              {data.stockoutDate && (
                <div className="detail-row">
                  <span className="detail-label">Est. Stockout Date:</span>
                  <span className="detail-value stockout-date">{formatDate(data.stockoutDate)}</span>
                </div>
              )}
            </div>

            <div className="prediction-recommendation">
              <strong>Recommendation:</strong> {data.recommendation}
            </div>

            {data.urgency === 'critical' && (
              <div className="prediction-action-bar critical">
                <button className="btn-action-urgent">Order Now</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="prediction-legend">
        <h5>Urgency Levels:</h5>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-badge urgency-critical">Critical</span>
            <span>≤ 3 days remaining</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge urgency-high">High</span>
            <span>4-7 days remaining</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge urgency-medium">Medium</span>
            <span>8-14 days remaining</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge urgency-low">Low</span>
            <span>15-30 days remaining</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge urgency-none">Adequate</span>
            <span>&gt; 30 days remaining</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockoutPredictor;

