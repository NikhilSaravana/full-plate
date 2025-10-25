// Inventory Analytics Utility
// Provides turnover calculations, stockout predictions, and restocking recommendations

/**
 * Calculate inventory turnover rate for a category
 * @param {number} currentStock - Current inventory in lbs
 * @param {number} totalDistributed - Total distributed in period (lbs)
 * @param {number} days - Number of days in period
 * @returns {object} Turnover metrics
 */
export function calculateTurnoverRate(currentStock, totalDistributed, days = 30) {
  if (currentStock === 0 || totalDistributed === 0) {
    return {
      turnoverRate: 0,
      daysOfSupply: 0,
      averageDailyDistribution: 0,
      status: 'insufficient_data',
      statusLabel: 'Insufficient Data'
    };
  }

  const averageDailyDistribution = totalDistributed / days;
  const daysOfSupply = currentStock / averageDailyDistribution;
  const turnoverRate = (totalDistributed / currentStock).toFixed(2);

  let status = 'normal';
  let statusLabel = 'Normal';

  if (daysOfSupply < 3) {
    status = 'critical';
    statusLabel = 'Critical - Stockout Imminent';
  } else if (daysOfSupply < 7) {
    status = 'low';
    statusLabel = 'Low - Restock Soon';
  } else if (daysOfSupply > 60) {
    status = 'slow';
    statusLabel = 'Slow Moving';
  } else if (daysOfSupply > 30) {
    status = 'high';
    statusLabel = 'High Stock';
  }

  return {
    turnoverRate: parseFloat(turnoverRate),
    daysOfSupply: Math.round(daysOfSupply),
    averageDailyDistribution: Math.round(averageDailyDistribution),
    status,
    statusLabel
  };
}

/**
 * Predict stockout date for each category
 * @param {object} currentInventory - Current inventory by category
 * @param {array} distributionHistory - Distribution records
 * @param {number} lookbackDays - Days to look back for average (7, 14, or 30)
 * @returns {object} Stockout predictions by category
 */
export function predictStockouts(currentInventory, distributionHistory, lookbackDays = 7) {
  const predictions = {};
  const now = new Date();
  const lookbackDate = new Date(now.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));

  // Filter distributions within lookback period
  const recentDistributions = distributionHistory.filter(dist => {
    const distDate = parseDistributionDate(dist);
    return distDate && distDate >= lookbackDate;
  });

  // Calculate distribution rate by category
  const categoryDistributions = {};
  recentDistributions.forEach(dist => {
    if (dist.categoryTotals) {
      Object.entries(dist.categoryTotals).forEach(([category, weight]) => {
        if (!categoryDistributions[category]) {
          categoryDistributions[category] = 0;
        }
        categoryDistributions[category] += weight;
      });
    }
  });

  // Calculate stockout predictions
  Object.entries(currentInventory).forEach(([category, stock]) => {
    const distributed = categoryDistributions[category] || 0;
    const avgDailyDistribution = distributed / lookbackDays;

    let daysUntilStockout = 0;
    let stockoutDate = null;
    let urgency = 'none';
    let recommendation = '';

    if (avgDailyDistribution > 0) {
      daysUntilStockout = Math.floor(stock / avgDailyDistribution);
      stockoutDate = new Date(now.getTime() + (daysUntilStockout * 24 * 60 * 60 * 1000));

      if (daysUntilStockout <= 3) {
        urgency = 'critical';
        recommendation = 'URGENT: Order immediately to prevent stockout';
      } else if (daysUntilStockout <= 7) {
        urgency = 'high';
        recommendation = 'Order within 1-2 days to maintain buffer';
      } else if (daysUntilStockout <= 14) {
        urgency = 'medium';
        recommendation = 'Plan restocking within the week';
      } else if (daysUntilStockout <= 30) {
        urgency = 'low';
        recommendation = 'Monitor and plan for future restock';
      } else {
        urgency = 'none';
        recommendation = 'Stock levels adequate';
      }
    } else if (stock === 0) {
      urgency = 'critical';
      recommendation = 'OUT OF STOCK - Immediate action required';
      daysUntilStockout = 0;
    } else {
      recommendation = 'No recent distribution data - monitor usage';
    }

    predictions[category] = {
      currentStock: stock,
      avgDailyDistribution: Math.round(avgDailyDistribution * 10) / 10,
      daysUntilStockout,
      stockoutDate,
      urgency,
      recommendation,
      lookbackDays
    };
  });

  return predictions;
}

/**
 * Generate smart restocking recommendations
 * @param {object} currentInventory - Current inventory by category
 * @param {object} turnoverData - Turnover metrics by category
 * @param {object} stockoutPredictions - Stockout predictions by category
 * @param {number} leadTimeDays - Supplier lead time in days (default 7)
 * @param {number} safetyStockDays - Safety stock buffer in days (default 7)
 * @returns {array} Restocking recommendations sorted by priority
 */
export function generateRestockingRecommendations(
  currentInventory,
  turnoverData,
  stockoutPredictions,
  leadTimeDays = 7,
  safetyStockDays = 7
) {
  const recommendations = [];

  Object.entries(currentInventory).forEach(([category, currentStock]) => {
    const turnover = turnoverData[category];
    const stockout = stockoutPredictions[category];

    if (!turnover || !stockout || turnover.averageDailyDistribution === 0) {
      return; // Skip if no data
    }

    // Calculate target stock: (lead time + safety buffer) * daily usage
    const targetStock = turnover.averageDailyDistribution * (leadTimeDays + safetyStockDays);
    const recommendedOrder = Math.max(0, targetStock - currentStock);

    // Determine priority
    let priority = 'low';
    let priorityScore = 0;
    let reasoning = [];

    if (stockout.urgency === 'critical') {
      priority = 'critical';
      priorityScore = 100;
      reasoning.push(`Critical: Only ${stockout.daysUntilStockout} days until stockout`);
    } else if (stockout.urgency === 'high') {
      priority = 'high';
      priorityScore = 75;
      reasoning.push(`High: ${stockout.daysUntilStockout} days until stockout`);
    } else if (stockout.daysUntilStockout < leadTimeDays + safetyStockDays) {
      priority = 'medium';
      priorityScore = 50;
      reasoning.push(`Medium: Stock will run low before next delivery`);
    }

    // Additional reasoning
    if (turnover.status === 'slow') {
      reasoning.push('Note: Slow-moving item, order conservatively');
      priorityScore -= 10;
    }
    
    if (currentStock === 0) {
      reasoning.push('OUT OF STOCK');
      priorityScore = 100;
      priority = 'critical';
    }

    if (recommendedOrder > 0 || priority === 'critical') {
      recommendations.push({
        category,
        currentStock: Math.round(currentStock),
        targetStock: Math.round(targetStock),
        recommendedOrder: Math.round(recommendedOrder),
        priority,
        priorityScore,
        reasoning: reasoning.join('; '),
        daysUntilStockout: stockout.daysUntilStockout,
        avgDailyUsage: Math.round(turnover.averageDailyDistribution),
        leadTimeDays,
        safetyStockDays
      });
    }
  });

  // Sort by priority score (highest first)
  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Identify slow-moving inventory items
 * @param {object} detailedInventory - Detailed inventory with items
 * @param {array} distributionHistory - Distribution records
 * @param {number} slowMovingThreshold - Days threshold (default 45)
 * @returns {array} List of slow-moving items
 */
export function identifySlowMovingItems(detailedInventory, distributionHistory, slowMovingThreshold = 45) {
  const slowMovingItems = [];
  const now = new Date();

  Object.entries(detailedInventory).forEach(([category, data]) => {
    if (!data || !data.items) return;

    data.items.forEach(item => {
      // Check if item has been in inventory for long time
      const itemAge = item.addedDate ? 
        Math.floor((now - new Date(item.addedDate)) / (1000 * 60 * 60 * 24)) : 
        null;

      // Check if item is approaching expiration
      const expDate = item.expiration && item.expiration !== 'N/A' ? 
        new Date(item.expiration) : 
        null;
      const daysUntilExpiry = expDate ? 
        Math.floor((expDate - now) / (1000 * 60 * 60 * 24)) : 
        null;

      if (itemAge && itemAge > slowMovingThreshold) {
        slowMovingItems.push({
          category,
          name: item.name,
          weight: item.weight,
          age: itemAge,
          daysUntilExpiry,
          expiration: item.expiration,
          recommendation: daysUntilExpiry && daysUntilExpiry < 14 ?
            'Urgent: Prioritize for distribution or donation' :
            'Consider targeted distribution or promotional campaign',
          urgency: daysUntilExpiry && daysUntilExpiry < 14 ? 'high' : 'medium'
        });
      }
    });
  });

  return slowMovingItems.sort((a, b) => {
    // Sort by urgency (high first) then by days until expiry
    if (a.urgency !== b.urgency) {
      return a.urgency === 'high' ? -1 : 1;
    }
    if (a.daysUntilExpiry && b.daysUntilExpiry) {
      return a.daysUntilExpiry - b.daysUntilExpiry;
    }
    return 0;
  });
}

/**
 * Calculate source performance metrics
 * @param {object} detailedInventory - Detailed inventory with items
 * @param {array} surveyHistory - Survey/intake records
 * @returns {object} Performance metrics by source
 */
export function analyzeSourcePerformance(detailedInventory, surveyHistory) {
  const sourceMetrics = {};

  // Analyze detailed inventory items by source
  Object.entries(detailedInventory).forEach(([category, data]) => {
    if (!data || !data.items) return;

    data.items.forEach(item => {
      const source = item.source || 'Unknown';
      if (!sourceMetrics[source]) {
        sourceMetrics[source] = {
          totalWeight: 0,
          itemCount: 0,
          categories: {},
          expirationDays: [],
          avgShelfLife: 0
        };
      }

      sourceMetrics[source].totalWeight += item.weight;
      sourceMetrics[source].itemCount += 1;
      sourceMetrics[source].categories[category] = 
        (sourceMetrics[source].categories[category] || 0) + item.weight;

      // Calculate shelf life (days until expiration from now)
      if (item.expiration && item.expiration !== 'N/A') {
        const expDate = new Date(item.expiration);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expDate - now) / (1000 * 60 * 60 * 24));
        sourceMetrics[source].expirationDays.push(daysUntilExpiry);
      }
    });
  });

  // Calculate averages and add to survey data
  Object.entries(sourceMetrics).forEach(([source, metrics]) => {
    if (metrics.expirationDays.length > 0) {
      const avgShelfLife = metrics.expirationDays.reduce((a, b) => a + b, 0) / metrics.expirationDays.length;
      metrics.avgShelfLife = Math.round(avgShelfLife);
    }

    // Calculate reliability score (0-100)
    let reliabilityScore = 50; // Base score

    // Bonus for high volume
    if (metrics.totalWeight > 1000) reliabilityScore += 20;
    else if (metrics.totalWeight > 500) reliabilityScore += 10;

    // Bonus for good shelf life
    if (metrics.avgShelfLife > 30) reliabilityScore += 20;
    else if (metrics.avgShelfLife > 14) reliabilityScore += 10;

    // Bonus for variety (multiple categories)
    const categoryCount = Object.keys(metrics.categories).length;
    if (categoryCount > 3) reliabilityScore += 10;

    metrics.reliabilityScore = Math.min(100, reliabilityScore);
  });

  return sourceMetrics;
}

/**
 * Calculate warehouse space utilization
 * @param {object} currentInventory - Current inventory by category
 * @param {object} unitConfig - Unit configuration with pallet weights
 * @param {number} totalWarehouseCapacity - Total warehouse capacity in lbs
 * @returns {object} Space utilization metrics
 */
export function calculateSpaceUtilization(currentInventory, unitConfig, totalWarehouseCapacity = 900000) {
  const totalWeight = Object.values(currentInventory).reduce((sum, weight) => sum + weight, 0);
  const utilizationPercentage = (totalWeight / totalWarehouseCapacity) * 100;

  const categoryPallets = {};
  let totalPallets = 0;

  Object.entries(currentInventory).forEach(([category, weight]) => {
    const palletWeight = unitConfig?.PALLET?.categorySpecific?.[category] || 1500;
    const pallets = weight / palletWeight;
    categoryPallets[category] = {
      weight,
      pallets: Math.round(pallets * 10) / 10,
      percentage: (weight / totalWeight) * 100
    };
    totalPallets += pallets;
  });

  let status = 'optimal';
  let recommendation = 'Space utilization is within optimal range';

  if (utilizationPercentage > 90) {
    status = 'critical';
    recommendation = 'CRITICAL: Warehouse at capacity. Increase distributions immediately.';
  } else if (utilizationPercentage > 75) {
    status = 'high';
    recommendation = 'WARNING: High capacity. Plan for increased distributions.';
  } else if (utilizationPercentage < 20) {
    status = 'low';
    recommendation = 'Low capacity. Consider expanding intake operations.';
  }

  return {
    totalWeight: Math.round(totalWeight),
    totalWarehouseCapacity,
    utilizationPercentage: Math.round(utilizationPercentage * 10) / 10,
    totalPallets: Math.round(totalPallets * 10) / 10,
    categoryPallets,
    status,
    recommendation
  };
}

/**
 * Helper function to parse distribution date from various formats
 */
function parseDistributionDate(dist) {
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
}

