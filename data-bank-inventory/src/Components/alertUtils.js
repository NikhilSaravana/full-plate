// Utility to generate combined alerts for dashboard and inventory
import { SYSTEM_CONFIG } from './FoodCategoryMapper';

// Category-level alert logic (from Dashboard)
export function generateCategoryAlerts({ currentInventory, memoizedTotalInventory, outgoingMetrics }) {
  const alerts = [];
  const total = memoizedTotalInventory;
  const targetCapacity = SYSTEM_CONFIG.TARGET_CAPACITY;

  // Low inventory alerts
  Object.entries(currentInventory).forEach(([category, weight]) => {
    const percentage = total > 0 ? (weight / total) * 100 : 0;
    if (percentage < 5 && total > 0) {
      alerts.push({
        type: 'CRITICAL',
        category: 'LOW_INVENTORY',
        message: `${category} inventory critically low (${percentage.toFixed(1)}%)`,
        action: 'Consider immediate restocking',
        priority: 'high',
        source: 'category'
      });
    } else if (percentage < 10 && total > 0) {
      alerts.push({
        type: 'WARNING',
        category: 'LOW_INVENTORY',
        message: `${category} inventory low (${percentage.toFixed(1)}%)`,
        action: 'Plan for restocking soon',
        priority: 'medium',
        source: 'category'
      });
    }
  });

  // MyPlate compliance alerts
  const vegPercentage = (currentInventory.VEG / total) * 100;
  const fruitPercentage = (currentInventory.FRUIT / total) * 100;
  const proteinPercentage = (currentInventory.PROTEIN / total) * 100;
  const dairyPercentage = (currentInventory.DAIRY / total) * 100;
  const grainPercentage = (currentInventory.GRAIN / total) * 100;
  const vegOK = vegPercentage >= 13 && vegPercentage <= 17;
  const fruitOK = fruitPercentage >= 13 && fruitPercentage <= 17;
  const proteinOK = proteinPercentage >= 18 && proteinPercentage <= 22;
  const dairyOK = dairyPercentage >= 2 && dairyPercentage <= 4;
  const grainOK = grainPercentage >= 13 && grainPercentage <= 17;
  const compliantCategories = [vegOK, fruitOK, proteinOK, dairyOK, grainOK].filter(Boolean).length;
  if (compliantCategories < 3) {
    alerts.push({
      type: 'WARNING',
      category: 'MYPLATE_IMBALANCE',
      message: `Only ${compliantCategories}/5 MyPlate categories are balanced`,
      action: 'Review distribution targets',
      priority: 'medium',
      source: 'category'
    });
  }

  // Capacity alerts
  const utilization = parseFloat(total > 0 ? ((total / targetCapacity) * 100).toFixed(1) : '0.0');
  if (utilization > 90) {
    alerts.push({
      type: 'CRITICAL',
      category: 'CAPACITY_WARNING',
      message: `Warehouse at ${utilization}% capacity`,
      action: 'Increase distributions immediately',
      priority: 'high',
      source: 'category'
    });
  } else if (utilization > 75) {
    alerts.push({
      type: 'WARNING',
      category: 'CAPACITY_WARNING',
      message: `Warehouse at ${utilization}% capacity`,
      action: 'Plan for increased distributions',
      priority: 'medium',
      source: 'category'
    });
  }

  // Distribution efficiency alerts
  if (outgoingMetrics && outgoingMetrics.totalDistributedToday === 0 && total > 0) {
    alerts.push({
      type: 'WARNING',
      category: 'NO_DISTRIBUTIONS',
      message: 'No distributions recorded today',
      action: 'Consider scheduling distributions to serve community',
      priority: 'medium',
      source: 'category'
    });
  }

  // Stagnant inventory alerts
  const weeklyDistributionRate = total > 0 && outgoingMetrics ? (outgoingMetrics.totalDistributedWeek / total) * 100 : 0;
  if (weeklyDistributionRate < 5 && total > 10000) {
    alerts.push({
      type: 'WARNING',
      category: 'STAGNANT_INVENTORY',
      message: `Low distribution rate (${weeklyDistributionRate.toFixed(1)}% of inventory distributed this week)`,
      action: 'Increase outreach and distribution activities',
      priority: 'medium',
      source: 'category'
    });
  }

  // High inventory distribution opportunity
  Object.entries(currentInventory).forEach(([category, weight]) => {
    const percentage = total > 0 ? (weight / total) * 100 : 0;
    if (percentage > 25) {
      alerts.push({
        type: 'INFO',
        category: 'DISTRIBUTION_OPPORTUNITY',
        message: `${category} has high inventory (${percentage.toFixed(1)}%)`,
        action: 'Good opportunity for targeted distribution',
        priority: 'low',
        source: 'category'
      });
    }
  });

  // Distribution efficiency opportunities
  if (outgoingMetrics && outgoingMetrics.avgDistributionSize > 0 && outgoingMetrics.avgDistributionSize < 100) {
    alerts.push({
      type: 'INFO',
      category: 'DISTRIBUTION_EFFICIENCY',
      message: `Average distribution size is ${outgoingMetrics.avgDistributionSize.toFixed(1)} lbs`,
      action: 'Consider larger bulk distributions for efficiency',
      priority: 'low',
      source: 'category'
    });
  }

  return alerts;
}

// Item-level alert logic (from InventoryManager)
export function generateItemAlerts(detailedInventory, UnitConverters) {
  const newAlerts = [];
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  Object.entries(detailedInventory).forEach(([category, data]) => {
    if (data && data.items) {
      data.items.forEach(item => {
        const expDate = new Date(item.expiration);
        // Expiration alerts
        if (expDate <= today) {
          newAlerts.push({
            type: 'EXPIRED',
            severity: 'critical',
            message: `${item.name} has expired (${item.expiration})`,
            item,
            source: 'item'
          });
        } else if (expDate <= weekFromNow) {
          newAlerts.push({
            type: 'EXPIRING_SOON',
            severity: 'warning',
            message: `${item.name} expires soon (${item.expiration})`,
            item,
            source: 'item'
          });
        }
        // Low stock alerts based on converted weights
        const pallets = UnitConverters.convertFromStandardWeight(item.weight, 'PALLET', category);
        if (pallets < 5) { // Configurable threshold
          newAlerts.push({
            type: 'LOW_STOCK',
            severity: 'info',
            message: `${item.name} is running low (${pallets.toFixed(1)} pallets equivalent)` ,
            item,
            source: 'item'
          });
        }
      });
    }
  });
  return newAlerts;
}

// Combine both sets of alerts
export function getCombinedAlerts({ currentInventory, memoizedTotalInventory, outgoingMetrics, detailedInventory, UnitConverters }) {
  const categoryAlerts = generateCategoryAlerts({ currentInventory, memoizedTotalInventory, outgoingMetrics });
  const itemAlerts = generateItemAlerts(detailedInventory, UnitConverters);
  return [...categoryAlerts, ...itemAlerts];
} 