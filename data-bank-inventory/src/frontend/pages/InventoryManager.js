import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import TurnoverDashboard from '../components/TurnoverDashboard';
import StockoutPredictor from '../components/StockoutPredictor';
import RestockingRecommender from '../components/RestockingRecommender';
import ExpirationCalendar from '../components/ExpirationCalendar';
import { 
  calculateTurnoverRate,
  predictStockouts,
  generateRestockingRecommendations,
  identifySlowMovingItems,
  analyzeSourcePerformance,
  calculateSpaceUtilization
} from '../../backend/utils/InventoryAnalytics';

const InventoryManager = ({ 
  currentInventory, 
  onNavigate, 
  outgoingMetrics = {},
  unitConfig,
  distributionHistory = []
}) => {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState('turnover');
  const [detailedInventory, setDetailedInventory] = useState({});
  const [turnoverData, setTurnoverData] = useState({});
  const [stockoutPredictions, setStockoutPredictions] = useState({});
  const [restockingRecommendations, setRestockingRecommendations] = useState([]);
  const [slowMovingItems, setSlowMovingItems] = useState([]);
  const [sourcePerformance, setSourcePerformance] = useState({});
  const [spaceUtilization, setSpaceUtilization] = useState(null);
  const [stockoutTimeframe, setStockoutTimeframe] = useState(7);
  const [restockingSettings, setRestockingSettings] = useState({ 
    leadTimeDays: 7, 
    safetyStockDays: 7 
  });

  // Load detailed inventory from localStorage
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      try {
        setDetailedInventory(JSON.parse(savedDetailedInventory));
      } catch (error) {
        console.error('[InventoryManager] Invalid JSON in localStorage:', error);
        setDetailedInventory({});
      }
    }
  }, []);

  // Calculate all analytics when data changes
  useEffect(() => {
    calculateAnalytics();
  }, [currentInventory, distributionHistory, detailedInventory, stockoutTimeframe, restockingSettings]);

  const calculateAnalytics = () => {
    if (!currentInventory || !distributionHistory) return;

    // Calculate turnover data
    const turnover = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const recentDistributions = distributionHistory.filter(dist => {
      const distDate = parseDistributionDate(dist);
      return distDate && distDate >= thirtyDaysAgo;
    });

    Object.entries(currentInventory).forEach(([category, stock]) => {
      // Calculate total distributed for this category
      const totalDistributed = recentDistributions.reduce((sum, dist) => {
        return sum + (dist.categoryTotals?.[category] || 0);
    }, 0);

      turnover[category] = calculateTurnoverRate(stock, totalDistributed, 30);
    });

    setTurnoverData(turnover);

    // Calculate stockout predictions
    const predictions = predictStockouts(
      currentInventory, 
      distributionHistory, 
      stockoutTimeframe
    );
    setStockoutPredictions(predictions);

    // Generate restocking recommendations
    const recommendations = generateRestockingRecommendations(
      currentInventory,
      turnover,
      predictions,
      restockingSettings.leadTimeDays,
      restockingSettings.safetyStockDays
    );
    setRestockingRecommendations(recommendations);

    // Identify slow-moving items
    const slowMoving = identifySlowMovingItems(detailedInventory, distributionHistory);
    setSlowMovingItems(slowMoving);

    // Analyze source performance
    const sources = analyzeSourcePerformance(detailedInventory, []);
    setSourcePerformance(sources);

    // Calculate space utilization
    const space = calculateSpaceUtilization(currentInventory, unitConfig);
    setSpaceUtilization(space);
  };

  const parseDistributionDate = (dist) => {
    if (dist.createdAt && dist.createdAt.toDate) {
      return dist.createdAt.toDate();
    } else if (dist.createdAt && typeof dist.createdAt === 'string') {
      return new Date(dist.createdAt);
    } else if (dist.timestamp) {
      return new Date(dist.timestamp);
    } else if (dist.date) {
      if (typeof dist.date === 'string' && dist.date.includes('-')) {
        return new Date(dist.date + 'T00:00:00');
      } else {
        return new Date(dist.date);
      }
    }
    return null;
  };

  const handleStockoutTimeframeChange = (days) => {
    setStockoutTimeframe(days);
  };

  const handleRestockingSettingsChange = (settings) => {
    setRestockingSettings(settings);
  };

  const totalFromSummary = Object.values(currentInventory || {}).reduce((sum, val) => sum + val, 0);

  return (
    <div className="inventory-manager-operational">
      <div className="operational-header">
        <div className="header-content">
          <h2>Inventory Operational Intelligence</h2>
          <p className="header-subtitle">
            Predictive planning and restocking recommendations powered by your distribution data
          </p>
        </div>
        
        <div className="header-stats-bar">
          <div className="stat-item">
            <span className="stat-label">Total Inventory:</span>
            <span className="stat-value">{totalFromSummary.toLocaleString()} lbs</span>
          </div>
          {spaceUtilization && (
            <>
              <div className="stat-item">
                <span className="stat-label">Warehouse Utilization:</span>
                <span className={`stat-value utilization-${spaceUtilization.status}`}>
                  {spaceUtilization.utilizationPercentage}%
                </span>
          </div>
              <div className="stat-item">
                <span className="stat-label">Total Pallets:</span>
                <span className="stat-value">{spaceUtilization.totalPallets}</span>
          </div>
            </>
          )}
        </div>
      </div>

      {totalFromSummary === 0 ? (
        <div className="empty-state">
                          <h3>{t('empty.no-inventory')}</h3>
          <p>{t('empty.no-inventory-desc')}</p>
          <button
            onClick={() => onNavigate('dataentry')}
            className="btn btn-primary btn-large"
          >
{t('empty.start-adding')}
          </button>
        </div>
      ) : (
        <>
          <nav className="operational-nav">
            <button 
              className={`nav-item ${activeSection === 'turnover' ? 'active' : ''}`}
              onClick={() => setActiveSection('turnover')}
            >
              <span className="nav-label">Turnover Analysis</span>
            </button>
            <button 
              className={`nav-item ${activeSection === 'stockout' ? 'active' : ''}`}
              onClick={() => setActiveSection('stockout')}
            >
              <span className="nav-label">Stockout Predictions</span>
              {Object.values(stockoutPredictions).filter(p => p.urgency === 'critical' || p.urgency === 'high').length > 0 && (
                <span className="nav-badge critical">
                  {Object.values(stockoutPredictions).filter(p => p.urgency === 'critical' || p.urgency === 'high').length}
                </span>
              )}
            </button>
              <button
              className={`nav-item ${activeSection === 'restocking' ? 'active' : ''}`}
              onClick={() => setActiveSection('restocking')}
            >
              <span className="nav-label">Restocking Plan</span>
              {restockingRecommendations.length > 0 && (
                <span className="nav-badge">
                  {restockingRecommendations.length}
                </span>
              )}
              </button>
            <button 
              className={`nav-item ${activeSection === 'expiration' ? 'active' : ''}`}
              onClick={() => setActiveSection('expiration')}
            >
              <span className="nav-label">Expiration Timeline</span>
            </button>
            <button
              className={`nav-item ${activeSection === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveSection('advanced')}
            >
              <span className="nav-label">Advanced Insights</span>
            </button>
          </nav>

          <div className="operational-content">
            {activeSection === 'turnover' && (
              <TurnoverDashboard turnoverData={turnoverData} />
            )}

            {activeSection === 'stockout' && (
              <StockoutPredictor 
                predictions={stockoutPredictions}
                onTimeframeChange={handleStockoutTimeframeChange}
              />
            )}

            {activeSection === 'restocking' && (
              <RestockingRecommender 
                recommendations={restockingRecommendations}
                onSettingsChange={handleRestockingSettingsChange}
              />
            )}

            {activeSection === 'expiration' && (
              <ExpirationCalendar detailedInventory={detailedInventory} />
            )}

            {activeSection === 'advanced' && (
              <div className="advanced-insights">
                <h3>Advanced Operational Insights</h3>

                {/* Slow-Moving Items */}
                {slowMovingItems.length > 0 && (
                  <div className="insight-section">
                    <h4>Slow-Moving Items ({slowMovingItems.length})</h4>
                    <p className="section-description">
                      Items that have been in inventory for extended periods. Consider targeted distribution campaigns.
                    </p>
                    <div className="slow-moving-grid">
                      {slowMovingItems.slice(0, 10).map((item, index) => (
                        <div key={index} className={`slow-moving-card urgency-${item.urgency}`}>
                          <div className="card-header">
                            <strong>{item.name}</strong>
                            <span className="category-badge">{item.category}</span>
                          </div>
                          <div className="card-details">
                            <div className="detail-row">
                              <span>Weight:</span>
                              <span>{Math.round(item.weight)} lbs</span>
                            </div>
                            <div className="detail-row">
                              <span>Age:</span>
                              <span>{item.age} days</span>
              </div>
                            {item.daysUntilExpiry && (
                              <div className="detail-row">
                                <span>Expires in:</span>
                                <span>{item.daysUntilExpiry} days</span>
            </div>
          )}
                          </div>
                          <div className="card-recommendation">
                            {item.recommendation}
                          </div>
                </div>
              ))}
            </div>
                    {slowMovingItems.length > 10 && (
                      <p className="show-more">+ {slowMovingItems.length - 10} more slow-moving items</p>
                    )}
          </div>
                )}

                {/* Source Performance */}
                {Object.keys(sourcePerformance).length > 0 && (
                  <div className="insight-section">
                    <h4>Source/Donor Performance</h4>
                    <p className="section-description">
                      Analysis of food sources based on volume, shelf life, and variety.
                    </p>
                    <div className="source-performance-grid">
                      {Object.entries(sourcePerformance)
                        .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                        .slice(0, 8)
                        .map(([source, metrics]) => (
                        <div key={source} className="source-card">
                          <h5>{source}</h5>
                          <div className="source-metrics">
                            <div className="metric">
                              <span className="metric-label">Total Weight:</span>
                              <span className="metric-value">{Math.round(metrics.totalWeight).toLocaleString()} lbs</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Items:</span>
                              <span className="metric-value">{metrics.itemCount}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Avg Shelf Life:</span>
                              <span className="metric-value">{metrics.avgShelfLife} days</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Categories:</span>
                              <span className="metric-value">{Object.keys(metrics.categories).length}</span>
                            </div>
                          </div>
                          <div className="source-reliability">
                            <div className="reliability-bar">
                              <div 
                                className="reliability-fill"
                                style={{ width: `${metrics.reliabilityScore}%` }}
                              ></div>
                            </div>
                            <span className="reliability-score">
                              Reliability: {metrics.reliabilityScore}/100
                            </span>
                          </div>
                  </div>
                ))}
              </div>
            </div>
          )}

                {/* Space Utilization Detail */}
                {spaceUtilization && (
                  <div className="insight-section">
                    <h4>Warehouse Space Utilization</h4>
                    <div className={`space-utilization-card status-${spaceUtilization.status}`}>
                      <div className="utilization-header">
                        <div className="utilization-chart">
                          <div className="chart-circle">
                            <span className="chart-percentage">{spaceUtilization.utilizationPercentage}%</span>
            </div>
            </div>
                        <div className="utilization-stats">
                          <div className="stat">
                            <span className="stat-label">Current Capacity:</span>
                            <span className="stat-value">{spaceUtilization.totalWeight.toLocaleString()} lbs</span>
          </div>
                          <div className="stat">
                            <span className="stat-label">Max Capacity:</span>
                            <span className="stat-value">{spaceUtilization.totalWarehouseCapacity.toLocaleString()} lbs</span>
              </div>
                          <div className="stat">
                            <span className="stat-label">Total Pallets:</span>
                            <span className="stat-value">{spaceUtilization.totalPallets}</span>
                </div>
              </div>
            </div>
                      <div className="utilization-recommendation">
                        <strong>Recommendation:</strong> {spaceUtilization.recommendation}
                    </div>
                      <div className="utilization-by-category">
                        <h5>Space by Category (Pallets)</h5>
                        <div className="category-pallets-grid">
                          {Object.entries(spaceUtilization.categoryPallets).map(([category, data]) => (
                            <div key={category} className="category-pallet-item">
                              <span className="category-name">{category}</span>
                              <span className="pallet-count">{data.pallets} pallets</span>
                              <span className="pallet-percentage">{data.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                    </div>
                  </div>
                )}

                {slowMovingItems.length === 0 && Object.keys(sourcePerformance).length === 0 && (
                  <div className="no-advanced-data">
                    <p>Advanced insights require detailed inventory tracking with expiration dates and sources.</p>
                    <p className="subtitle">Use the Food Intake tab to add detailed item information.</p>
                  </div>
                )}
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryManager;
