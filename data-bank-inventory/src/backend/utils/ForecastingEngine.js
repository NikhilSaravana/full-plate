// Forecasting Engine Utility
// Provides predictive algorithms for inventory planning

/**
 * Forecast future demand based on historical distribution patterns
 * @param {array} distributionHistory - Historical distribution data
 * @param {number} forecastDays - Number of days to forecast (default 30)
 * @returns {object} Demand forecast by category
 */
export function forecastDemand(distributionHistory, forecastDays = 30) {
  if (!distributionHistory || distributionHistory.length === 0) {
    return {
      forecast: {},
      confidence: 'low',
      message: 'Insufficient historical data for forecasting'
    };
  }

  // Use last 30 days for forecasting
  const now = new Date();
  const lookbackDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  const recentDistributions = distributionHistory.filter(dist => {
    const distDate = parseDate(dist);
    return distDate && distDate >= lookbackDate;
  });

  if (recentDistributions.length < 3) {
    return {
      forecast: {},
      confidence: 'low',
      message: 'Need at least 3 recent distributions for forecasting'
    };
  }

  // Calculate average daily demand by category
  const categoryTotals = {};
  recentDistributions.forEach(dist => {
    if (dist.categoryTotals) {
      Object.entries(dist.categoryTotals).forEach(([category, weight]) => {
        if (!categoryTotals[category]) {
          categoryTotals[category] = [];
        }
        categoryTotals[category].push(weight);
      });
    }
  });

  // Apply simple moving average with trend adjustment
  const forecast = {};
  Object.entries(categoryTotals).forEach(([category, values]) => {
    const avgDailyDemand = values.reduce((sum, v) => sum + v, 0) / 30; // Average over 30 days
    
    // Detect trend (compare first half vs second half)
    const midpoint = Math.floor(values.length / 2);
    const firstHalfAvg = values.slice(0, midpoint).reduce((sum, v) => sum + v, 0) / midpoint;
    const secondHalfAvg = values.slice(midpoint).reduce((sum, v) => sum + v, 0) / (values.length - midpoint);
    const trendFactor = secondHalfAvg / firstHalfAvg;

    // Apply trend to forecast
    const projectedDailyDemand = avgDailyDemand * (trendFactor > 0 ? trendFactor : 1);
    const forecastedTotal = projectedDailyDemand * forecastDays;

    forecast[category] = {
      currentAvgDailyDemand: Math.round(avgDailyDemand * 10) / 10,
      projectedDailyDemand: Math.round(projectedDailyDemand * 10) / 10,
      forecastedTotal: Math.round(forecastedTotal),
      trend: trendFactor > 1.1 ? 'increasing' : trendFactor < 0.9 ? 'decreasing' : 'stable',
      trendPercentage: Math.round((trendFactor - 1) * 100)
    };
  });

  // Determine confidence level
  let confidence = 'high';
  if (recentDistributions.length < 10) {
    confidence = 'medium';
  }
  if (recentDistributions.length < 5) {
    confidence = 'low';
  }

  return {
    forecast,
    confidence,
    forecastDays,
    basedOnDays: 30,
    distributionCount: recentDistributions.length,
    message: `Forecast based on ${recentDistributions.length} distributions over the last 30 days`
  };
}

/**
 * Calculate recommended inventory targets based on demand forecast
 * @param {object} demandForecast - Demand forecast from forecastDemand()
 * @param {object} currentInventory - Current inventory levels
 * @param {number} leadTimeDays - Supplier lead time in days
 * @param {number} safetyStockDays - Safety stock buffer in days
 * @returns {object} Recommended inventory targets
 */
export function calculateInventoryTargets(
  demandForecast,
  currentInventory,
  leadTimeDays = 7,
  safetyStockDays = 7
) {
  const targets = {};

  if (!demandForecast || !demandForecast.forecast) {
    return {
      targets: {},
      message: 'Unable to calculate targets without demand forecast'
    };
  }

  Object.entries(demandForecast.forecast).forEach(([category, forecast]) => {
    const currentStock = currentInventory[category] || 0;
    const dailyDemand = forecast.projectedDailyDemand;
    
    // Target = (Lead Time + Safety Stock) × Daily Demand
    const targetStock = dailyDemand * (leadTimeDays + safetyStockDays);
    const gap = targetStock - currentStock;
    
    let status = 'adequate';
    let action = 'Monitor stock levels';
    
    if (gap > targetStock * 0.5) {
      status = 'critical';
      action = 'URGENT: Large stockout risk, order immediately';
    } else if (gap > targetStock * 0.25) {
      status = 'low';
      action = 'Low stock, plan restocking soon';
    } else if (gap < -targetStock * 0.5) {
      status = 'overstocked';
      action = 'Overstocked, increase distributions or reduce orders';
    }

    targets[category] = {
      currentStock: Math.round(currentStock),
      targetStock: Math.round(targetStock),
      gap: Math.round(gap),
      dailyDemand: Math.round(dailyDemand * 10) / 10,
      daysOfSupply: dailyDemand > 0 ? Math.round(currentStock / dailyDemand) : 999,
      status,
      action,
      trend: forecast.trend
    };
  });

  return {
    targets,
    leadTimeDays,
    safetyStockDays,
    message: `Targets calculated for ${Object.keys(targets).length} categories`
  };
}

/**
 * Predict potential waste from expiring items
 * @param {object} detailedInventory - Detailed inventory with expiration dates
 * @param {object} demandForecast - Demand forecast
 * @returns {object} Waste prediction
 */
export function predictWaste(detailedInventory, demandForecast) {
  const now = new Date();
  const predictions = [];
  let totalAtRisk = 0;

  Object.entries(detailedInventory).forEach(([category, data]) => {
    if (!data || !data.items) return;

    const categoryDailyDemand = demandForecast?.forecast?.[category]?.projectedDailyDemand || 0;

    data.items.forEach(item => {
      if (!item.expiration || item.expiration === 'N/A') return;

      const expDate = new Date(item.expiration);
      const daysUntilExpiry = Math.floor((expDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        // Already expired
        predictions.push({
          category,
          item: item.name,
          weight: item.weight,
          expiration: item.expiration,
          daysUntilExpiry,
          risk: 'expired',
          recommendation: 'Remove from inventory immediately',
          priority: 100
        });
        totalAtRisk += item.weight;
      } else if (daysUntilExpiry <= 14) {
        // Will expire soon
        const canDistributeInTime = categoryDailyDemand > 0 && 
          (item.weight / categoryDailyDemand) <= daysUntilExpiry;

        if (!canDistributeInTime) {
          const risk = daysUntilExpiry <= 3 ? 'critical' : daysUntilExpiry <= 7 ? 'high' : 'medium';
          predictions.push({
            category,
            item: item.name,
            weight: item.weight,
            expiration: item.expiration,
            daysUntilExpiry,
            risk,
            recommendation: risk === 'critical' ? 
              'Urgent: Prioritize for immediate distribution or donation' :
              'Prioritize for distribution within the week',
            priority: 100 - daysUntilExpiry
          });
          
          if (risk === 'critical' || risk === 'high') {
            totalAtRisk += item.weight;
          }
        }
      }
    });
  });

  predictions.sort((a, b) => b.priority - a.priority);

  return {
    predictions,
    totalAtRisk: Math.round(totalAtRisk),
    itemsAtRisk: predictions.length,
    summary: predictions.length > 0 ?
      `${predictions.length} items at risk of waste (${Math.round(totalAtRisk)} lbs)` :
      'No items currently at risk of waste'
  };
}

/**
 * Generate optimal distribution schedule recommendations
 * @param {object} currentInventory - Current inventory
 * @param {object} demandForecast - Demand forecast
 * @param {object} wastePrediction - Waste prediction
 * @param {number} daysToSchedule - Number of days to schedule
 * @returns {array} Recommended distribution schedule
 */
export function recommendDistributionSchedule(
  currentInventory,
  demandForecast,
  wastePrediction,
  daysToSchedule = 7
) {
  const schedule = [];

  // Prioritize items at risk of expiration
  if (wastePrediction && wastePrediction.predictions.length > 0) {
    wastePrediction.predictions.forEach(item => {
      if (item.risk === 'expired' || item.risk === 'critical') {
        schedule.push({
          day: 1,
          priority: 'urgent',
          category: item.category,
          item: item.item,
          weight: item.weight,
          reason: `Expires in ${item.daysUntilExpiry} days`,
          action: 'Distribute immediately to prevent waste'
        });
      }
    });
  }

  // Add regular distribution recommendations based on demand
  if (demandForecast && demandForecast.forecast) {
    Object.entries(demandForecast.forecast).forEach(([category, forecast]) => {
      const currentStock = currentInventory[category] || 0;
      const dailyDemand = forecast.projectedDailyDemand;

      if (dailyDemand > 0 && currentStock > dailyDemand * 3) {
        // High stock, recommend distribution
        const recommendedAmount = Math.min(currentStock * 0.3, dailyDemand * 5);
        schedule.push({
          day: 2,
          priority: 'normal',
          category,
          weight: Math.round(recommendedAmount),
          reason: `High stock level (${Math.round(currentStock / dailyDemand)} days supply)`,
          action: 'Regular distribution to maintain optimal levels'
        });
      }
    });
  }

  return schedule.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'urgent' ? -1 : 1;
    }
    return a.day - b.day;
  });
}

/**
 * Calculate risk score for inventory management
 * @param {object} currentInventory - Current inventory
 * @param {object} stockoutPredictions - Stockout predictions
 * @param {object} wastePrediction - Waste prediction
 * @returns {object} Risk assessment
 */
export function assessInventoryRisk(currentInventory, stockoutPredictions, wastePrediction) {
  let riskScore = 0;
  const riskFactors = [];

  // Check for imminent stockouts
  if (stockoutPredictions) {
    Object.entries(stockoutPredictions).forEach(([category, prediction]) => {
      if (prediction.urgency === 'critical') {
        riskScore += 30;
        riskFactors.push({
          type: 'stockout',
          severity: 'critical',
          category,
          message: `${category} will stockout in ${prediction.daysUntilStockout} days`
        });
      } else if (prediction.urgency === 'high') {
        riskScore += 15;
        riskFactors.push({
          type: 'stockout',
          severity: 'high',
          category,
          message: `${category} low stock (${prediction.daysUntilStockout} days remaining)`
        });
      }
    });
  }

  // Check for waste risk
  if (wastePrediction && wastePrediction.totalAtRisk > 0) {
    if (wastePrediction.totalAtRisk > 1000) {
      riskScore += 25;
      riskFactors.push({
        type: 'waste',
        severity: 'high',
        message: `${wastePrediction.itemsAtRisk} items at risk (${wastePrediction.totalAtRisk} lbs)`
      });
    } else {
      riskScore += 10;
      riskFactors.push({
        type: 'waste',
        severity: 'medium',
        message: `${wastePrediction.itemsAtRisk} items expiring soon`
      });
    }
  }

  // Check for low overall inventory
  const totalInventory = Object.values(currentInventory).reduce((sum, weight) => sum + weight, 0);
  if (totalInventory < 10000) {
    riskScore += 20;
    riskFactors.push({
      type: 'low_inventory',
      severity: 'medium',
      message: `Total inventory very low (${Math.round(totalInventory)} lbs)`
    });
  }

  // Determine overall risk level
  let riskLevel = 'low';
  if (riskScore >= 50) {
    riskLevel = 'critical';
  } else if (riskScore >= 30) {
    riskLevel = 'high';
  } else if (riskScore >= 15) {
    riskLevel = 'medium';
  }

  return {
    riskScore: Math.min(100, riskScore),
    riskLevel,
    riskFactors,
    recommendation: riskLevel === 'critical' ?
      'URGENT: Multiple critical issues require immediate attention' :
      riskLevel === 'high' ?
      'HIGH PRIORITY: Address inventory issues within 24-48 hours' :
      riskLevel === 'medium' ?
      'MODERATE: Monitor closely and plan corrective actions' :
      'LOW RISK: Inventory management is on track'
  };
}

// Helper function
function parseDate(dist) {
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

