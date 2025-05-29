import React, { useState, useEffect } from 'react';
import MyPlateCalculator from './MyPlateCalculator';
import InventoryManager from './InventoryManager';
import OrderingSystem from './OrderingSystem';
import SurveyInterface from './SurveyInterface';
import ReportView from './ReportView';
import UnitConfiguration from './UnitConfiguration';

const Dashboard = () => {
  // Real inventory state that starts empty and gets populated by user data
  const [currentInventory, setCurrentInventory] = useState({
    'DAIRY': 0,
    'GRAIN': 0,
    'PROTEIN': 0,
    'FRUIT': 0,
    'VEG': 0,
    'PRODUCE': 0,
    'MISC': 0
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [recentActivity, setRecentActivity] = useState([]);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');

  // Load data from localStorage on startup
  useEffect(() => {
    try {
      const savedInventory = localStorage.getItem('foodBankInventory');
      const savedActivity = localStorage.getItem('foodBankActivity');
      const hasBeenSetup = localStorage.getItem('foodBankSetupComplete');

      if (savedInventory) {
        setCurrentInventory(JSON.parse(savedInventory));
      }
      if (savedActivity) {
        setRecentActivity(JSON.parse(savedActivity));
      }
      if (hasBeenSetup) {
        setIsFirstTime(false);
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      showAutoSaveStatus('Error loading saved data', true);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('foodBankInventory', JSON.stringify(currentInventory));
      showAutoSaveStatus('Data saved');
    } catch (error) {
      console.error('Error saving inventory to localStorage:', error);
      showAutoSaveStatus('Error saving data', true);
    }
  }, [currentInventory]);

  useEffect(() => {
    try {
      localStorage.setItem('foodBankActivity', JSON.stringify(recentActivity));
      if (recentActivity.length > 0) {
        showAutoSaveStatus('Data saved');
      }
    } catch (error) {
      console.error('Error saving activity to localStorage:', error);
      showAutoSaveStatus('Error saving data', true);
    }
  }, [recentActivity]);

  const showAutoSaveStatus = (message, isError = false) => {
    setAutoSaveStatus({ message, isError });
    setTimeout(() => setAutoSaveStatus(''), 1500);
  };

  const exportAllData = () => {
    try {
      const allData = {
        inventory: currentInventory,
        activity: recentActivity,
        detailedInventory: JSON.parse(localStorage.getItem('detailedInventory') || '{}'),
        unitConfigurations: JSON.parse(localStorage.getItem('unitConfigurations') || '{}'),
        orderHistory: JSON.parse(localStorage.getItem('orderHistory') || '[]'),
        customOrders: JSON.parse(localStorage.getItem('customOrders') || '{}'),
        projectionMode: localStorage.getItem('projectionMode') || 'weekly',
        weeklyDistribution: localStorage.getItem('weeklyDistribution') || '50000',
        setupComplete: localStorage.getItem('foodBankSetupComplete') || 'false',
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(allData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `food-bank-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      showAutoSaveStatus('Backup exported');
    } catch (error) {
      console.error('Error exporting data:', error);
      showAutoSaveStatus('Export failed', true);
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (window.confirm('This will replace ALL current data. Are you sure you want to continue?')) {
          // Restore all data
          if (importedData.inventory) setCurrentInventory(importedData.inventory);
          if (importedData.activity) setRecentActivity(importedData.activity);
          
          // Restore localStorage data
          if (importedData.detailedInventory) {
            localStorage.setItem('detailedInventory', JSON.stringify(importedData.detailedInventory));
          }
          if (importedData.unitConfigurations) {
            localStorage.setItem('unitConfigurations', JSON.stringify(importedData.unitConfigurations));
          }
          if (importedData.orderHistory) {
            localStorage.setItem('orderHistory', JSON.stringify(importedData.orderHistory));
          }
          if (importedData.customOrders) {
            localStorage.setItem('customOrders', JSON.stringify(importedData.customOrders));
          }
          if (importedData.projectionMode) {
            localStorage.setItem('projectionMode', importedData.projectionMode);
          }
          if (importedData.weeklyDistribution) {
            localStorage.setItem('weeklyDistribution', importedData.weeklyDistribution);
          }
          if (importedData.setupComplete) {
            localStorage.setItem('foodBankSetupComplete', importedData.setupComplete);
            setIsFirstTime(importedData.setupComplete !== 'true');
          }

          showAutoSaveStatus('Data imported successfully');
          
          // Refresh the page to ensure all components reload with new data
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (error) {
        console.error('Error importing data:', error);
        showAutoSaveStatus('Import failed - invalid file', true);
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  };

  const handleSurveySubmit = (surveyData) => {
    console.log('Survey data received:', surveyData);
    
    // Update inventory based on survey data
    if (surveyData.type !== 'DISTRIBUTION' && surveyData.categoryTotals) {
      setCurrentInventory(prev => {
        const updated = { ...prev };
        Object.entries(surveyData.categoryTotals).forEach(([category, weight]) => {
          if (surveyData.type === 'SINGLE' || surveyData.type === 'BULK') {
            // Add to inventory
            updated[category] = (updated[category] || 0) + weight;
          }
        });
        return updated;
      });
    }

    // Handle distribution - subtract from inventory
    if (surveyData.type === 'DISTRIBUTION' && surveyData.distribution) {
      const distributedWeight = parseFloat(surveyData.distribution.totalDistributed) || 0;
      // For now, distribute proportionally across categories
      const totalCurrent = Object.values(currentInventory).reduce((sum, val) => sum + val, 0);
      if (totalCurrent > 0) {
        setCurrentInventory(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(category => {
            const proportion = updated[category] / totalCurrent;
            const reduction = distributedWeight * proportion;
            updated[category] = Math.max(0, updated[category] - reduction);
          });
          return updated;
        });
      }
    }

    // Add to activity feed
    const activityMessage = surveyData.type === 'DISTRIBUTION' 
      ? `Distributed ${surveyData.distribution?.totalDistributed || '?'} to ${surveyData.distribution?.clientsServed || '?'} clients`
      : `Added ${surveyData.items?.length || 0} items from ${surveyData.source}`;

    setRecentActivity(prev => [{
      type: surveyData.type === 'DISTRIBUTION' ? 'DISTRIBUTION' : 'INTAKE',
      message: activityMessage,
      time: 'Just now',
      timestamp: new Date().toISOString()
    }, ...prev.slice(0, 19)]); // Keep last 20 activities

    // Mark as no longer first time
    if (isFirstTime) {
      setIsFirstTime(false);
      localStorage.setItem('foodBankSetupComplete', 'true');
    }
  };

  const getTotalInventory = () => {
    return Object.values(currentInventory).reduce((sum, val) => sum + val, 0);
  };

  const getCapacityUtilization = () => {
    const total = getTotalInventory();
    // Default target capacity - could be made configurable
    const targetCapacity = 900000;
    return total > 0 ? ((total / targetCapacity) * 100).toFixed(1) : '0.0';
  };

  const getMyPlateCompliance = () => {
    const total = getTotalInventory();
    if (total === 0) return 'No data yet';

    const vegPercentage = (currentInventory.VEG / total) * 100;
    const fruitPercentage = (currentInventory.FRUIT / total) * 100;
    const proteinPercentage = (currentInventory.PROTEIN / total) * 100;
    
    // MyPlate compliance check
    const vegOK = vegPercentage >= 13 && vegPercentage <= 17;
    const fruitOK = fruitPercentage >= 13 && fruitPercentage <= 17;
    const proteinOK = proteinPercentage >= 18 && proteinPercentage <= 22;
    
    const compliantCategories = [vegOK, fruitOK, proteinOK].filter(Boolean).length;
    return `${compliantCategories}/3 Categories Compliant`;
  };

  const getNutritionalScore = () => {
    const total = getTotalInventory();
    if (total === 0) return 'No data yet';

    // Calculate percentage of "green" (nutritious) foods
    const greenCategories = ['VEG', 'FRUIT', 'PRODUCE', 'PROTEIN'];
    const greenWeight = greenCategories.reduce((sum, cat) => sum + (currentInventory[cat] || 0), 0);
    const percentage = ((greenWeight / total) * 100).toFixed(1);
    return `${percentage}% Nutritious Foods`;
  };

  const resetAllData = () => {
    if (window.confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      localStorage.clear();
      setCurrentInventory({
        'DAIRY': 0,
        'GRAIN': 0,
        'PROTEIN': 0,
        'FRUIT': 0,
        'VEG': 0,
        'PRODUCE': 0,
        'MISC': 0
      });
      setRecentActivity([]);
      setIsFirstTime(true);
      showAutoSaveStatus('All data reset');
    }
  };

  return (
    <div className="dashboard">
      {/* Auto-save status indicator - subtle and temporary */}
      {autoSaveStatus && (
        <div className={`auto-save-status visible ${autoSaveStatus.isError ? 'error' : ''}`}>
          {autoSaveStatus.message}
        </div>
      )}

      <header className="dashboard-header">
        <h1>Food Bank Inventory Manager</h1>
        {isFirstTime && (
          <div className="first-time-notice">
            <p>👋 Welcome! Start by entering your current inventory using the "Data Entry" tab.</p>
          </div>
        )}
        <div className="header-stats">
          <div className="stat-card">
            <h3>Total Inventory</h3>
            <p className="stat-value">
              {getTotalInventory().toLocaleString()} lbs
            </p>
          </div>
          <div className="stat-card">
            <h3>Capacity Utilization</h3>
            <p className="stat-value">{getCapacityUtilization()}%</p>
          </div>
          <div className="stat-card">
            <h3>MyPlate Compliance</h3>
            <p className="stat-value">{getMyPlateCompliance()}</p>
          </div>
          <div className="stat-card">
            <h3>Nutritional Quality</h3>
            <p className="stat-value">{getNutritionalScore()}</p>
          </div>
        </div>
      </header>

      <nav className="dashboard-nav">
        <div className="nav-main">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'survey' ? 'active' : ''}
            onClick={() => setActiveTab('survey')}
          >
            Data Entry
          </button>
          <button 
            className={activeTab === 'inventory' ? 'active' : ''}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
          <button 
            className={activeTab === 'myplate' ? 'active' : ''}
            onClick={() => setActiveTab('myplate')}
          >
            MyPlate Analysis
          </button>
          <button 
            className={activeTab === 'ordering' ? 'active' : ''}
            onClick={() => setActiveTab('ordering')}
          >
            Ordering
          </button>
          <button 
            className={activeTab === 'units' ? 'active' : ''}
            onClick={() => setActiveTab('units')}
          >
            Unit Config
          </button>
          <button 
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>
        
        {/* Subtle data management controls */}
        <div className="nav-utils">
          <button onClick={exportAllData} className="util-btn" title="Export backup">
            ⬇
          </button>
          <label className="util-btn" title="Import data">
            ⬆
            <input
              type="file"
              accept=".json"
              onChange={importData}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={resetAllData} className="util-btn danger" title="Reset all data">
            ⟲
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {getTotalInventory() === 0 ? (
              <div className="empty-state">
                <h2>📦 No Inventory Data Yet</h2>
                <p>Get started by adding your current inventory using the "Data Entry" tab.</p>
                <button 
                  className="get-started-btn"
                  onClick={() => setActiveTab('survey')}
                >
                  Start Adding Inventory
                </button>
              </div>
            ) : (
              <div className="overview-grid">
                <div className="overview-section">
                  <h2>Current Inventory Distribution</h2>
                  <div className="category-grid">
                    {Object.entries(currentInventory).map(([category, weight]) => {
                      const total = getTotalInventory();
                      const percentage = total > 0 ? ((weight / total) * 100).toFixed(1) : '0.0';
                      const isOverTarget = parseFloat(percentage) > 20;
                      const isUnderTarget = parseFloat(percentage) < 5 && total > 0;
                      
                      return (
                        <div key={category} className={`category-card ${isOverTarget ? 'over-target' : isUnderTarget ? 'under-target' : ''}`}>
                          <h4>{category}</h4>
                          <p className="weight">{weight.toLocaleString()} lbs</p>
                          <p className="percentage">{percentage}%</p>
                          <div className="category-status">
                            {isOverTarget && <span className="status-badge over">OVER</span>}
                            {isUnderTarget && <span className="status-badge under">UNDER</span>}
                            {!isOverTarget && !isUnderTarget && <span className="status-badge okay">OKAY</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="overview-section">
                  <h2>Recent Activity</h2>
                  <div className="activity-feed">
                    {recentActivity.length === 0 ? (
                      <p className="no-activity">No recent activity. Start by entering some inventory data!</p>
                    ) : (
                      recentActivity.slice(0, 10).map((activity, index) => (
                        <div key={index} className={`activity-item ${activity.type.toLowerCase()}`}>
                          <div className="activity-icon">
                            {activity.type === 'INTAKE' && '📦'}
                            {activity.type === 'DISTRIBUTION' && '🚚'}
                            {activity.type === 'ALERT' && '⚠️'}
                            {activity.type === 'ORDER' && '📋'}
                          </div>
                          <div className="activity-content">
                            <p className="activity-message">{activity.message}</p>
                            <p className="activity-time">{activity.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="overview-section">
                  <h2>Quick Actions</h2>
                  <div className="quick-actions">
                    <button 
                      className="action-btn primary"
                      onClick={() => setActiveTab('survey')}
                    >
                      📝 Add Inventory
                    </button>
                    <button 
                      className="action-btn secondary"
                      onClick={() => setActiveTab('myplate')}
                    >
                      📊 Check MyPlate
                    </button>
                    <button 
                      className="action-btn secondary"
                      onClick={() => setActiveTab('reports')}
                    >
                      📈 View Reports
                    </button>
                    <button 
                      className="action-btn danger"
                      onClick={resetAllData}
                    >
                      🗑️ Reset All Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'survey' && (
          <SurveyInterface onDataSubmit={handleSurveySubmit} />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager currentInventory={currentInventory} />
        )}

        {activeTab === 'myplate' && (
          <MyPlateCalculator currentInventory={currentInventory} />
        )}

        {activeTab === 'ordering' && (
          <OrderingSystem currentInventory={currentInventory} />
        )}

        {activeTab === 'units' && (
          <UnitConfiguration />
        )}

        {activeTab === 'reports' && (
          <ReportView currentInventory={currentInventory} />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
