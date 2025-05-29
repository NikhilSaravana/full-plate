import React, { useState, useEffect } from 'react';

const OrderingSystem = ({ currentInventory }) => {
  const [projectionMode, setProjectionMode] = useState('weekly');
  const [weeklyDistribution, setWeeklyDistribution] = useState(50000);
  const [customOrders, setCustomOrders] = useState({});
  const [orderHistory, setOrderHistory] = useState([]);

  // MyPlate targets (configurable in a real system)
  const myplateTargets = {
    'VEG': 15,      // 15%
    'FRUIT': 15,    // 15%  
    'DAIRY': 3,     // 3%
    'GRAIN': 15,    // 15%
    'PROTEIN': 20,  // 20%
    'MISC': 12,     // 12%
    'PRODUCE': 20   // 20%
  };

  // Default target capacity
  const targetCapacity = 900000; // 900,000 lbs

  // Load saved data from localStorage on component mount
  useEffect(() => {
    try {
      const savedOrderHistory = localStorage.getItem('orderHistory');
      const savedCustomOrders = localStorage.getItem('customOrders');
      const savedProjectionMode = localStorage.getItem('projectionMode');
      const savedWeeklyDistribution = localStorage.getItem('weeklyDistribution');

      if (savedOrderHistory) {
        setOrderHistory(JSON.parse(savedOrderHistory));
      }
      if (savedCustomOrders) {
        setCustomOrders(JSON.parse(savedCustomOrders));
      }
      if (savedProjectionMode) {
        setProjectionMode(savedProjectionMode);
      }
      if (savedWeeklyDistribution) {
        setWeeklyDistribution(parseInt(savedWeeklyDistribution));
      }
    } catch (error) {
      console.error('Error loading ordering data from localStorage:', error);
    }
  }, []);

  // Save orderHistory to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('orderHistory', JSON.stringify(orderHistory));
    } catch (error) {
      console.error('Error saving order history to localStorage:', error);
    }
  }, [orderHistory]);

  // Save customOrders to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('customOrders', JSON.stringify(customOrders));
    } catch (error) {
      console.error('Error saving custom orders to localStorage:', error);
    }
  }, [customOrders]);

  // Save projection mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('projectionMode', projectionMode);
    } catch (error) {
      console.error('Error saving projection mode to localStorage:', error);
    }
  }, [projectionMode]);

  // Save weekly distribution to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('weeklyDistribution', weeklyDistribution.toString());
    } catch (error) {
      console.error('Error saving weekly distribution to localStorage:', error);
    }
  }, [weeklyDistribution]);

  const calculateOrderNeeds = () => {
    const total = Object.values(currentInventory || {}).reduce((sum, val) => sum + val, 0);
    
    if (total === 0) {
      // If no inventory, calculate based on targets
      return Object.entries(myplateTargets).map(([category, percentage]) => {
        const targetWeight = (targetCapacity * percentage) / 100;
        return {
          category,
          current: 0,
          target: targetWeight,
          percentage: 0,
          targetPercentage: percentage,
          needed: targetWeight,
          priority: 'high',
          pallets: Math.ceil(targetWeight / 1500) // Rough pallet calculation
        };
      });
    }

    return Object.entries(myplateTargets).map(([category, targetPercentage]) => {
      const current = currentInventory[category] || 0;
      const currentPercentage = (current / total) * 100;
      const targetWeight = (total * targetPercentage) / 100;
      const needed = Math.max(0, targetWeight - current);
      
      let priority = 'normal';
      if (currentPercentage < targetPercentage * 0.7) priority = 'high';
      else if (currentPercentage < targetPercentage * 0.9) priority = 'medium';
      else if (currentPercentage > targetPercentage * 1.3) priority = 'low';

      return {
        category,
        current,
        target: targetWeight,
        percentage: currentPercentage,
        targetPercentage,
        needed,
        priority,
        pallets: Math.ceil(needed / 1500)
      };
    });
  };

  const handleCustomOrderChange = (category, value) => {
    setCustomOrders(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };

  const submitOrder = () => {
    const orderData = calculateOrderNeeds();
    const totalOrder = orderData.reduce((sum, item) => {
      const orderAmount = customOrders[item.category] || item.needed;
      return sum + orderAmount;
    }, 0);

    const newOrder = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      mode: projectionMode,
      items: orderData.map(item => ({
        category: item.category,
        amount: customOrders[item.category] || item.needed,
        priority: item.priority
      })),
      total: totalOrder,
      status: 'pending'
    };

    setOrderHistory(prev => [newOrder, ...prev.slice(0, 19)]); // Keep last 20 orders
    setCustomOrders({});
    alert(`Order submitted for ${totalOrder.toLocaleString()} lbs across ${orderData.length} categories`);
  };

  const clearOrderHistory = () => {
    if (window.confirm('Are you sure you want to clear all order history? This cannot be undone.')) {
      setOrderHistory([]);
      localStorage.removeItem('orderHistory');
    }
  };

  const exportOrderData = () => {
    const exportData = {
      orderHistory,
      customOrders,
      projectionMode,
      weeklyDistribution,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `food-bank-orders-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const orderNeeds = calculateOrderNeeds();
  const totalOrderWeight = orderNeeds.reduce((sum, item) => {
    return sum + (customOrders[item.category] || item.needed);
  }, 0);

  const totalInventory = Object.values(currentInventory || {}).reduce((sum, val) => sum + val, 0);

  return (
    <div className="ordering-system">
      <div className="ordering-header">
        <h2>Ordering System</h2>
        <div className="ordering-actions">
          <div className="mode-selector">
            <label>
              <input
                type="radio"
                value="weekly"
                checked={projectionMode === 'weekly'}
                onChange={(e) => setProjectionMode(e.target.value)}
              />
              Weekly Planning
            </label>
            <label>
              <input
                type="radio"
                value="capacity"
                checked={projectionMode === 'capacity'}
                onChange={(e) => setProjectionMode(e.target.value)}
              />
              Full Capacity
            </label>
          </div>
          <div className="data-controls">
            <button onClick={exportOrderData} className="export-btn">
              📤 Export Orders
            </button>
            {orderHistory.length > 0 && (
              <button onClick={clearOrderHistory} className="clear-btn">
                🗑️ Clear History
              </button>
            )}
          </div>
        </div>
      </div>

      {totalInventory === 0 ? (
        <div className="empty-state">
          <h3>📋 No Inventory for Order Planning</h3>
          <p>Add some inventory data first to generate intelligent ordering recommendations based on MyPlate guidelines.</p>
          <p>Once you have inventory data, this system will calculate optimal orders to maintain nutritional balance.</p>
        </div>
      ) : (
        <>
          {projectionMode === 'weekly' && (
            <div className="projection-controls">
              <label>
                Weekly Distribution Target:
                <input
                  type="number"
                  value={weeklyDistribution}
                  onChange={(e) => setWeeklyDistribution(parseInt(e.target.value))}
                  className="distribution-input"
                />
                lbs
              </label>
            </div>
          )}

          <div className="order-calculations">
            <h3>Order Calculations - {projectionMode === 'weekly' ? 'Weekly' : 'Full Capacity'} Mode</h3>
            <table className="order-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Current</th>
                  <th>Current %</th>
                  <th>Target %</th>
                  <th>Needed</th>
                  <th>Pallets</th>
                  <th>Priority</th>
                  <th>Custom Order</th>
                </tr>
              </thead>
              <tbody>
                {orderNeeds.map(item => (
                  <tr key={item.category} className={`priority-${item.priority}`}>
                    <td className="category-name">{item.category}</td>
                    <td>{item.current.toLocaleString()} lbs</td>
                    <td>{item.percentage.toFixed(1)}%</td>
                    <td>{item.targetPercentage}%</td>
                    <td className={item.needed > 0 ? 'need-order' : ''}>{item.needed.toLocaleString()} lbs</td>
                    <td>{item.pallets}</td>
                    <td>
                      <span className={`priority-badge ${item.priority}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder={item.needed.toFixed(0)}
                        value={customOrders[item.category] || ''}
                        onChange={(e) => handleCustomOrderChange(item.category, e.target.value)}
                        className="order-input"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="order-summary">
            <h3>Order Summary</h3>
            <div className="summary-stats">
              <div className="summary-item">
                <label>Total Order Weight:</label>
                <span>{totalOrderWeight.toLocaleString()} lbs</span>
              </div>
              <div className="summary-item">
                <label>Estimated Pallets:</label>
                <span>{Math.ceil(totalOrderWeight / 1500)}</span>
              </div>
              <div className="summary-item">
                <label>High Priority Items:</label>
                <span>{orderNeeds.filter(item => item.priority === 'high').length}</span>
              </div>
              <div className="summary-item">
                <label>Projected Capacity:</label>
                <span>{((totalInventory + totalOrderWeight) / targetCapacity * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="supplier-breakdown">
              <h4>Recommended Supplier Breakdown</h4>
              <div className="supplier-order">
                <h5>NTFB AE (Primary)</h5>
                <ul>
                  {orderNeeds.filter(item => item.priority === 'high' || item.priority === 'medium').map(item => (
                    <li key={item.category}>
                      {item.category}: {(customOrders[item.category] || item.needed).toLocaleString()} lbs
                    </li>
                  ))}
                </ul>
              </div>
              {orderNeeds.some(item => item.priority === 'low') && (
                <div className="supplier-order">
                  <h5>Local Sources (Secondary)</h5>
                  <ul>
                    {orderNeeds.filter(item => item.priority === 'low').map(item => (
                      <li key={item.category}>
                        {item.category}: {(customOrders[item.category] || item.needed).toLocaleString()} lbs
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {totalOrderWeight > 0 && (
              <button onClick={submitOrder} className="submit-order-btn">
                Submit Order ({totalOrderWeight.toLocaleString()} lbs)
              </button>
            )}
          </div>
        </>
      )}

      <div className="order-history">
        <h3>Recent Order History</h3>
        <div className="history-list">
          {orderHistory.length === 0 ? (
            <p className="no-activity">No orders submitted yet.</p>
          ) : (
            orderHistory.map(order => (
              <div key={order.id} className="history-item">
                <div className="order-info">
                  <span className="order-date">{order.date}</span>
                  <span className="order-mode">{order.mode}</span>
                  <span className="order-total">{order.total.toLocaleString()} lbs</span>
                  <span className={`order-status ${order.status}`}>{order.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderingSystem;
