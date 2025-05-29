import React, { useState, useEffect } from 'react';
import { MYPLATE_GOALS, SYSTEM_CONFIG, getCategoryStatus, getMyPlateCategory } from './FoodCategoryMapper';

const MyPlateCalculator = ({ currentInventory = {} }) => {
  const [calculations, setCalculations] = useState({});
  const [summary, setSummary] = useState({});

  useEffect(() => {
    calculateMyPlateBalance();
  }, [currentInventory]);

  const calculateMyPlateBalance = () => {
    // Calculate totals by MyPlate category
    const totals = {};
    let grandTotal = 0;

    // Initialize categories
    Object.keys(MYPLATE_GOALS).forEach(category => {
      totals[category] = 0;
    });

    // Sum up inventory by category
    Object.entries(currentInventory).forEach(([foodType, weight]) => {
      const category = getMyPlateCategory(foodType);
      totals[category] += weight;
      grandTotal += weight;
    });

    // Calculate percentages and status
    const categoryStats = {};
    Object.entries(MYPLATE_GOALS).forEach(([category, goals]) => {
      const currentWeight = totals[category] || 0;
      const currentPercentage = grandTotal > 0 ? (currentWeight / grandTotal) * 100 : 0;
      const goalPercentage = goals.percentage;
      const status = getCategoryStatus(currentPercentage, goalPercentage);
      
      // Calculate target weights
      const targetWeight = (goalPercentage / 100) * SYSTEM_CONFIG.TARGET_CAPACITY;
      const needToOrder = Math.max(0, targetWeight - currentWeight);
      
      // Calculate pallets
      const currentPallets = currentWeight / SYSTEM_CONFIG.AVG_PALLET_WEIGHT;
      const targetPallets = goals.palletTarget;
      const palletDeficit = Math.max(0, targetPallets - currentPallets);

      categoryStats[category] = {
        currentWeight,
        currentPercentage: currentPercentage.toFixed(1),
        goalPercentage,
        status,
        targetWeight,
        needToOrder,
        currentPallets: currentPallets.toFixed(1),
        targetPallets,
        palletDeficit: palletDeficit.toFixed(1),
        balanced: status === 'OKAY' ? 'OKAY' : 'NEEDS ADJUSTMENT'
      };
    });

    setCalculations(categoryStats);
    setSummary({
      totalCurrent: grandTotal,
      targetCapacity: SYSTEM_CONFIG.TARGET_CAPACITY,
      capacityUtilization: ((grandTotal / SYSTEM_CONFIG.TARGET_CAPACITY) * 100).toFixed(1),
      totalNeedToOrder: Object.values(categoryStats).reduce((sum, cat) => sum + cat.needToOrder, 0)
    });
  };

  return (
    <div className="myplate-calculator">
      <h2>MyPlate Balance Calculator</h2>
      
      {/* Summary Section */}
      <div className="summary-section">
        <h3>Current Status</h3>
        <div className="summary-stats">
          <div className="stat-item">
            <label>Total Current Inventory:</label>
            <span>{summary.totalCurrent?.toLocaleString()} lbs</span>
          </div>
          <div className="stat-item">
            <label>Target Capacity:</label>
            <span>{summary.targetCapacity?.toLocaleString()} lbs</span>
          </div>
          <div className="stat-item">
            <label>Capacity Utilization:</label>
            <span>{summary.capacityUtilization}%</span>
          </div>
          <div className="stat-item">
            <label>Total Need to Order:</label>
            <span>{summary.totalNeedToOrder?.toLocaleString()} lbs</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="category-breakdown">
        <h3>MyPlate Category Analysis</h3>
        <table className="calculations-table">
          <thead>
            <tr>
              <th>MyPlate Category</th>
              <th>Current (lbs)</th>
              <th>Current %</th>
              <th>Goal %</th>
              <th>Status</th>
              <th>Target Weight</th>
              <th>Need to Order</th>
              <th>Current Pallets</th>
              <th>Target Pallets</th>
              <th>Pallet Deficit</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(calculations).map(([category, stats]) => (
              <tr key={category} className={`status-${stats.status.toLowerCase()}`}>
                <td>{category}</td>
                <td>{stats.currentWeight?.toLocaleString()}</td>
                <td>{stats.currentPercentage}%</td>
                <td>{stats.goalPercentage}%</td>
                <td className={`status-badge ${stats.status.toLowerCase()}`}>
                  {stats.status}
                </td>
                <td>{stats.targetWeight?.toLocaleString()}</td>
                <td>{stats.needToOrder?.toLocaleString()}</td>
                <td>{stats.currentPallets}</td>
                <td>{stats.targetPallets}</td>
                <td>{stats.palletDeficit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyPlateCalculator;
