import React, { useState } from 'react';
import { 
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell 
} from 'recharts';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const ForecastingDashboard = ({ 
  demandForecast, 
  inventoryTargets, 
  wastePrediction,
  riskAssessment 
}) => {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(true);

  // Color mapping for confidence levels (now using CSS variables)
  const CONFIDENCE_COLORS = {
    high: 'var(--success)',
    medium: 'var(--warning)',
    low: 'var(--error)'
  };

  const STATUS_COLORS = {
    critical: 'var(--error)',
    low: 'var(--warning)',
    adequate: 'var(--success)',
    overstocked: 'var(--accent-primary)'
  };

  // Prepare data for demand forecast chart
  const forecastChartData = demandForecast?.forecast ? 
    Object.entries(demandForecast.forecast).map(([category, data]) => ({
      category,
      current: data.currentAvgDailyDemand,
      projected: data.projectedDailyDemand,
      trend: data.trendPercentage
    })) : [];

  // Prepare data for inventory targets chart
  const targetsChartData = inventoryTargets?.targets ?
    Object.entries(inventoryTargets.targets).map(([category, data]) => ({
      category,
      current: data.currentStock,
      target: data.targetStock,
      status: data.status
    })) : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {Math.round(entry.value).toLocaleString()}
              {entry.unit || ' lbs'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getRiskLevelClass = (level) => {
    switch (level) {
      case 'critical': return 'risk-critical';
      case 'high': return 'risk-high';
      case 'medium': return 'risk-medium';
      default: return 'risk-low';
    }
  };

  return (
    <div className="forecasting-dashboard">
      {/* Risk Assessment Banner */}
      {riskAssessment && (
        <div className={`risk-assessment-banner ${getRiskLevelClass(riskAssessment.riskLevel)}`}>
          <div className="risk-header">
            <div className="risk-score">
              <span className="score-label">Risk Score:</span>
              <span className="score-value">{riskAssessment.riskScore}/100</span>
            </div>
            <div className="risk-level">
              <span className={`risk-badge ${riskAssessment.riskLevel}`}>
                {riskAssessment.riskLevel.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="risk-recommendation">
            <strong>Recommendation:</strong> {riskAssessment.recommendation}
          </div>
          {riskAssessment.riskFactors && riskAssessment.riskFactors.length > 0 && (
            <div className="risk-factors">
              <strong>Risk Factors:</strong>
              <ul>
                {riskAssessment.riskFactors.map((factor, index) => (
                  <li key={index} className={`factor-${factor.severity}`}>
                    {factor.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Demand Forecast Section */}
      <div className="forecast-section">
        <div className="section-header-with-info">
          <h3>Demand Forecast ({demandForecast?.forecastDays || 30} Days)</h3>
          {demandForecast && (
            <div className="forecast-confidence">
              <span className="confidence-label">Confidence:</span>
              <span 
                className="confidence-badge" 
                style={{ backgroundColor: CONFIDENCE_COLORS[demandForecast.confidence] }}
              >
                {demandForecast.confidence?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {demandForecast && demandForecast.forecast && Object.keys(demandForecast.forecast).length > 0 ? (
          <>
            <p className="section-subtitle">{demandForecast.message}</p>
            
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'lbs/day', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="current" fill="#293C47" name="Current Avg Daily" />
                <Bar dataKey="projected" fill="#c4a464" name="Projected Daily" />
              </BarChart>
            </ResponsiveContainer>

            {showDetails && (
              <div className="forecast-details">
                <h4>Detailed Forecast by Category</h4>
                <div className="forecast-grid">
                  {Object.entries(demandForecast.forecast).map(([category, data]) => (
                    <div key={category} className="forecast-card">
                      <div className="forecast-card-header">
                        <h5>{category}</h5>
                        <span className={`trend-badge trend-${data.trend}`}>
                          {data.trend === 'increasing' && '↑ '}
                          {data.trend === 'decreasing' && '↓ '}
                          {data.trend}
                          {data.trendPercentage !== 0 && ` (${data.trendPercentage > 0 ? '+' : ''}${data.trendPercentage}%)`}
                        </span>
                      </div>
                      <div className="forecast-metrics">
                        <div className="metric">
                          <span className="metric-label">Current Avg:</span>
                          <span className="metric-value">{data.currentAvgDailyDemand} lbs/day</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Projected Avg:</span>
                          <span className="metric-value">{data.projectedDailyDemand} lbs/day</span>
                        </div>
                        <div className="metric highlight">
                          <span className="metric-label">{demandForecast.forecastDays}-Day Total:</span>
                          <span className="metric-value">{data.forecastedTotal.toLocaleString()} lbs</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-data">
            <p>Unable to generate demand forecast</p>
            <p className="subtitle">{demandForecast?.message || 'Need more distribution history'}</p>
          </div>
        )}
      </div>

      {/* Inventory Targets Section */}
      <div className="targets-section">
        <div className="section-header-with-info">
          <h3>Recommended Inventory Targets</h3>
          {inventoryTargets && (
            <p className="section-subtitle">
              Lead time: {inventoryTargets.leadTimeDays} days, Safety stock: {inventoryTargets.safetyStockDays} days
            </p>
          )}
        </div>

        {inventoryTargets && inventoryTargets.targets && Object.keys(inventoryTargets.targets).length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={targetsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="current" fill="#293C47" name="Current Stock" />
                <Bar dataKey="target" fill="#c4a464" name="Target Stock" />
              </BarChart>
            </ResponsiveContainer>

            <div className="targets-grid">
              {Object.entries(inventoryTargets.targets).map(([category, data]) => (
                <div key={category} className={`target-card status-${data.status}`}>
                  <div className="target-card-header">
                    <h5>{category}</h5>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: STATUS_COLORS[data.status] }}
                    >
                      {data.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="target-metrics">
                    <div className="metric-row">
                      <span className="metric-label">Current Stock:</span>
                      <span className="metric-value">{data.currentStock.toLocaleString()} lbs</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Target Stock:</span>
                      <span className="metric-value">{data.targetStock.toLocaleString()} lbs</span>
                    </div>
                    <div className="metric-row highlight">
                      <span className="metric-label">Gap:</span>
                      <span className={`metric-value ${data.gap > 0 ? 'negative' : 'positive'}`}>
                        {data.gap > 0 ? '+' : ''}{data.gap.toLocaleString()} lbs
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Days of Supply:</span>
                      <span className="metric-value">{data.daysOfSupply} days</span>
                    </div>
                  </div>
                  <div className="target-action">
                    <strong>Action:</strong> {data.action}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="no-data">
            <p>Unable to calculate inventory targets</p>
            <p className="subtitle">{inventoryTargets?.message || 'Need demand forecast data'}</p>
          </div>
        )}
      </div>

      {/* Waste Prediction Section */}
      {wastePrediction && wastePrediction.itemsAtRisk > 0 && (
        <div className="waste-prediction-section">
          <div className="section-header">
            <h3>Waste Risk Prediction</h3>
            <div className="waste-summary">
              <span className="waste-stat critical">{wastePrediction.itemsAtRisk} items</span>
              <span className="waste-stat">{wastePrediction.totalAtRisk} lbs at risk</span>
            </div>
          </div>

          <p className="section-subtitle">{wastePrediction.summary}</p>

          <div className="waste-predictions-list">
            {wastePrediction.predictions.slice(0, 10).map((item, index) => (
              <div key={index} className={`waste-prediction-card risk-${item.risk}`}>
                <div className="waste-item-header">
                  <div className="waste-item-name">
                    <strong>{item.item}</strong>
                    <span className="waste-category">{item.category}</span>
                  </div>
                  <div className="waste-item-weight">{Math.round(item.weight)} lbs</div>
                </div>
                <div className="waste-item-details">
                  <div className="waste-expiry">
                    {item.daysUntilExpiry < 0 ? 
                      `Expired ${Math.abs(item.daysUntilExpiry)} days ago` :
                      `Expires in ${item.daysUntilExpiry} days (${item.expiration})`
                    }
                  </div>
                  <div className="waste-recommendation">
                    {item.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {wastePrediction.predictions.length > 10 && (
            <div className="show-more-waste">
              + {wastePrediction.predictions.length - 10} more items at risk
            </div>
          )}
        </div>
      )}

      {/* Forecasting Footer */}
      <div className="forecasting-footer">
        <div className="footer-note">
          <strong>About These Forecasts:</strong>
          <p>
            Predictions are based on historical patterns and statistical analysis. 
            Confidence levels indicate data quality (high = 10+ recent distributions, medium = 5-10, low = &lt;5). 
            Adjust your ordering and distribution strategies based on these insights and your operational knowledge.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForecastingDashboard;

