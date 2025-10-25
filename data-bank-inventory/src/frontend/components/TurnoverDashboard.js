import React from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const TurnoverDashboard = ({ turnoverData }) => {
  const { t } = useLanguage();

  if (!turnoverData || Object.keys(turnoverData).length === 0) {
    return (
      <div className="turnover-dashboard">
        <h3>Inventory Turnover Analysis</h3>
        <p className="no-data">No turnover data available. Need distribution history to calculate turnover rates.</p>
      </div>
    );
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'critical': return 'status-critical';
      case 'low': return 'status-warning';
      case 'slow': return 'status-info';
      case 'high': return 'status-info';
      default: return 'status-normal';
    }
  };

  return (
    <div className="turnover-dashboard">
      <div className="section-header-with-info">
        <h3>Inventory Turnover Analysis</h3>
        <div className="info-tooltip">
          <span className="info-icon">ℹ</span>
          <div className="tooltip-content">
            <strong>Turnover Rate:</strong> How quickly inventory moves (higher = faster)<br/>
            <strong>Days of Supply:</strong> How long current stock will last at current usage rate<br/>
            <strong>Status indicates:</strong> Critical (&lt;3 days), Low (&lt;7 days), High (&gt;30 days), Slow (&gt;60 days)
          </div>
        </div>
      </div>

      <div className="turnover-grid">
        {Object.entries(turnoverData).map(([category, data]) => (
          <div key={category} className={`turnover-card ${getStatusClass(data.status)}`}>
            <div className="turnover-card-header">
              <h4>{category}</h4>
              <span className={`status-badge ${data.status}`}>
                {data.statusLabel}
              </span>
            </div>
            
            <div className="turnover-metrics">
              <div className="metric-row">
                <span className="metric-label">Turnover Rate:</span>
                <span className="metric-value">{data.turnoverRate}x</span>
              </div>
              
              <div className="metric-row">
                <span className="metric-label">Days of Supply:</span>
                <span className="metric-value days-supply">
                  {data.daysOfSupply === 0 ? 'Out of Stock' : `${data.daysOfSupply} days`}
                </span>
              </div>
              
              <div className="metric-row">
                <span className="metric-label">Avg Daily Usage:</span>
                <span className="metric-value">{data.averageDailyDistribution} lbs/day</span>
              </div>
            </div>

            {data.status === 'critical' && (
              <div className="turnover-alert">
                <strong>⚠️ URGENT:</strong> Stock critical - order immediately!
              </div>
            )}
            {data.status === 'low' && (
              <div className="turnover-warning">
                <strong>⚡ Attention:</strong> Plan restocking this week
              </div>
            )}
            {data.status === 'slow' && (
              <div className="turnover-info">
                <strong>📊 Note:</strong> Slow-moving item - review demand
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="turnover-summary">
        <h4>Quick Stats</h4>
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Categories at Risk:</span>
            <span className="stat-value critical">
              {Object.values(turnoverData).filter(d => d.status === 'critical' || d.status === 'low').length}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Slow-Moving:</span>
            <span className="stat-value">
              {Object.values(turnoverData).filter(d => d.status === 'slow').length}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Healthy Stock:</span>
            <span className="stat-value success">
              {Object.values(turnoverData).filter(d => d.status === 'normal').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TurnoverDashboard;

