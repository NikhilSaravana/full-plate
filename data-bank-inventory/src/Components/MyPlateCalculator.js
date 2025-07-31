import React, { useState, useEffect } from 'react';
import { MYPLATE_GOALS, SYSTEM_CONFIG, getCategoryStatus, getMyPlateCategory, updateTargetCapacity } from './FoodCategoryMapper';
import { getUnitConverters } from './UnitConfiguration';

const MyPlateCalculator = ({ currentInventory = {}, targetCapacity, onUpdateTargetCapacity, unitConfig }) => {
  const [calculations, setCalculations] = useState({});
  const [summary, setSummary] = useState({});
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState(targetCapacity);
  const [displayUnit, setDisplayUnit] = useState('POUNDS'); // POUNDS, CASES, PALLETS

  const unitConverters = getUnitConverters(unitConfig);

  useEffect(() => {
    calculateMyPlateBalance();
    // eslint-disable-next-line
  }, [currentInventory, targetCapacity, isEditingCapacity, displayUnit]);

  // Update newCapacity when targetCapacity changes
  useEffect(() => {
    setNewCapacity(targetCapacity);
  }, [targetCapacity]);

  const handleCapacityEdit = async () => {
    if (isEditingCapacity) {
      if (onUpdateTargetCapacity) {
        await onUpdateTargetCapacity(Number(newCapacity));
      }
      setIsEditingCapacity(false);
      setNewCapacity(targetCapacity);
      // Force recalculation after save
      setTimeout(() => calculateMyPlateBalance(), 0);
      return;
    }
    setIsEditingCapacity(true);
  };

  const handleCapacityChange = (e) => {
    const value = e.target.value;
    if (!isNaN(value) && value >= 0) {
      setNewCapacity(Number(value));
    }
  };

  // Helper function to format values based on display unit
  const formatValue = (valueInPounds, category) => {
    if (displayUnit === 'POUNDS') {
      return `${valueInPounds.toLocaleString()} lbs`;
    } else if (displayUnit === 'CASES') {
      const cases = unitConverters.convertFromStandardWeight(valueInPounds, 'CASE', category);
      return `${cases < 1 ? cases.toFixed(3) : cases.toFixed(1)} cases`;
    } else if (displayUnit === 'PALLETS') {
      const pallets = unitConverters.convertFromStandardWeight(valueInPounds, 'PALLET', category);
      return `${pallets < 1 ? pallets.toFixed(3) : pallets.toFixed(2)} pallets`;
    }
    return `${valueInPounds.toLocaleString()} lbs`;
  };

  // Helper function to get numeric value for calculations
  const getNumericValue = (valueInPounds, category) => {
    if (displayUnit === 'POUNDS') {
      return valueInPounds;
    } else if (displayUnit === 'CASES') {
      return unitConverters.convertFromStandardWeight(valueInPounds, 'CASE', category);
    } else if (displayUnit === 'PALLETS') {
      return unitConverters.convertFromStandardWeight(valueInPounds, 'PALLET', category);
    }
    return valueInPounds;
  };

  const calculateMyPlateBalance = () => {
    console.log('MyPlate Calculator - currentInventory:', currentInventory);
    
    // Calculate totals by MyPlate category
    const totals = {};
    let grandTotal = 0;

    // Initialize categories
    Object.keys(MYPLATE_GOALS).forEach(category => {
      totals[category] = 0;
    });

    // Sum up inventory by category
    Object.entries(currentInventory).forEach(([category, weight]) => {
      console.log(`Processing category: ${category}, weight: ${weight}`);
      // currentInventory already contains aggregated category data
      // so we can use the category directly
      if (MYPLATE_GOALS[category]) {
        totals[category] += weight;
        grandTotal += weight;
        console.log(`Added ${weight} to ${category}, total now: ${totals[category]}`);
      } else {
        // If category not found in MYPLATE_GOALS, add to MISC
        console.log(`Category ${category} not found in MYPLATE_GOALS, adding to MISC`);
        totals['MISC'] += weight;
        grandTotal += weight;
      }
    });
    
    console.log('Final totals:', totals);
    console.log('Grand total:', grandTotal);

    // Calculate percentages and status
    const categoryStats = {};
    Object.entries(MYPLATE_GOALS).forEach(([category, goals]) => {
      const currentWeight = totals[category] || 0;
      const currentPercentage = grandTotal > 0 ? (currentWeight / grandTotal) * 100 : 0;
      const goalPercentage = goals.percentage;
      const status = getCategoryStatus(currentPercentage, goalPercentage);
      
      console.log(`${category}: Current=${currentWeight}lbs (${currentPercentage}%), Goal=${goalPercentage}%, Status=${status}`);
      
      // Calculate target weights based on target capacity
      const targetWeight = (goalPercentage / 100) * targetCapacity;
      const needToOrder = Math.max(0, targetWeight - currentWeight);
      
      // Calculate pallets dynamically based on target capacity
      const targetPallets = (goalPercentage / 100) * targetCapacity / SYSTEM_CONFIG.AVG_PALLET_WEIGHT;
      const currentPallets = currentWeight / SYSTEM_CONFIG.AVG_PALLET_WEIGHT;
      const palletDeficit = Math.max(0, targetPallets - currentPallets);

      categoryStats[category] = {
        currentWeight,
        currentPercentage: currentPercentage.toFixed(1),
        goalPercentage,
        status,
        targetWeight,
        needToOrder,
        currentPallets: currentPallets.toFixed(1),
        targetPallets: targetPallets.toFixed(1),
        palletDeficit: palletDeficit.toFixed(1),
        balanced: status === 'OKAY' ? 'OKAY' : 'NEEDS ADJUSTMENT'
      };
    });

    setCalculations(categoryStats);
    setSummary({
      totalCurrent: grandTotal,
      targetCapacity: targetCapacity,
      capacityUtilization: ((grandTotal / targetCapacity) * 100).toFixed(1),
      totalNeedToOrder: Object.values(categoryStats).reduce((sum, cat) => sum + cat.needToOrder, 0)
    });
  };

  return (
    <div className="myplate-calculator">
      <h2>MyPlate Balance Calculator</h2>
      
      {/* Unit Toggle */}
      <div className="unit-toggle-section">
        <h3>Display Units</h3>
        <div className="unit-toggle">
          <button
            className={`unit-btn ${displayUnit === 'POUNDS' ? 'active' : ''}`}
            onClick={() => setDisplayUnit('POUNDS')}
          >
            Pounds
          </button>
          <button
            className={`unit-btn ${displayUnit === 'CASES' ? 'active' : ''}`}
            onClick={() => setDisplayUnit('CASES')}
          >
            Cases
          </button>
          <button
            className={`unit-btn ${displayUnit === 'PALLETS' ? 'active' : ''}`}
            onClick={() => setDisplayUnit('PALLETS')}
          >
            Pallets
          </button>
        </div>
      </div>
      
      {/* Summary Section */}
      <div className="summary-section">
        <h3>Current Status</h3>
        <div className="summary-stats">
          <div className="stat-item">
            <label>Total Current Inventory:</label>
            <span>{formatValue(summary.totalCurrent || 0, 'MISC')}</span>
          </div>
          <div className="stat-item target-capacity">
            <label>Target Capacity:</label>
            {isEditingCapacity ? (
              <div className="capacity-edit">
                <input
                  type="number"
                  value={newCapacity}
                  onChange={handleCapacityChange}
                  min="0"
                  step="1000"
                /> lbs
                <button onClick={handleCapacityEdit} className="save-btn">Save</button>
              </div>
            ) : (
              <div className="capacity-display">
                <span>{formatValue(targetCapacity || 0, 'MISC')}</span>
                <button onClick={handleCapacityEdit} className="edit-btn">Edit</button>
              </div>
            )}
          </div>
          <div className="stat-item">
            <label>Capacity Utilization:</label>
            <span>{summary.capacityUtilization}%</span>
          </div>
          <div className="stat-item">
            <label>Total Need to Order:</label>
            <span>{formatValue(summary.totalNeedToOrder || 0, 'MISC')}</span>
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
              <th>Current</th>
              <th>Current %</th>
              <th>Goal %</th>
              <th>Status</th>
              <th>Target</th>
              <th>Need to Order</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(calculations).map(([category, stats]) => (
              <tr key={category} className={`status-${stats.status.toLowerCase()}`}>
                <td>{category}</td>
                <td>{formatValue(stats.currentWeight, category)}</td>
                <td>{stats.currentPercentage}%</td>
                <td>{stats.goalPercentage}%</td>
                <td className={`status-badge ${stats.status.toLowerCase()}`}>
                  {stats.status}
                </td>
                <td>{formatValue(stats.targetWeight, category)}</td>
                <td>{formatValue(stats.needToOrder, category)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyPlateCalculator;
