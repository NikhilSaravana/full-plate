// Trend Analysis Utility
// Processes historical data and prepares chart data for visualization

/**
 * Process distribution history for trend analysis
 * @param {array} distributionHistory - All distribution records
 * @param {number} days - Number of days to analyze
 * @returns {object} Trend data for charts
 */
export function analyzeDistributionTrends(distributionHistory, days = 30) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

  // Filter distributions within date range
  const relevantDistributions = distributionHistory.filter(dist => {
    const distDate = parseDate(dist);
    return distDate && distDate >= startDate;
  });

  // Group by date
  const dailyData = {};
  const categoryData = {};
  const recipientData = {};
  const ageGroupData = { kid: {}, adult: {}, elder: {} };

  relevantDistributions.forEach(dist => {
    const distDate = parseDate(dist);
    if (!distDate) return;

    const dateKey = distDate.toISOString().split('T')[0];

    // Daily totals
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        totalWeight: 0,
        totalClients: 0,
        distributionCount: 0
      };
    }
    dailyData[dateKey].totalWeight += dist.totalDistributed || 0;
    dailyData[dateKey].totalClients += dist.clientsServed || 0;
    dailyData[dateKey].distributionCount += 1;

    // Category breakdown
    if (dist.categoryTotals) {
      Object.entries(dist.categoryTotals).forEach(([category, weight]) => {
        if (!categoryData[category]) {
          categoryData[category] = {};
        }
        categoryData[category][dateKey] = (categoryData[category][dateKey] || 0) + weight;
      });
    }

    // Recipient data
    const recipient = dist.recipient || 'Unknown';
    if (!recipientData[recipient]) {
      recipientData[recipient] = {
        totalWeight: 0,
        totalClients: 0,
        distributionCount: 0,
        dates: []
      };
    }
    recipientData[recipient].totalWeight += dist.totalDistributed || 0;
    recipientData[recipient].totalClients += dist.clientsServed || 0;
    recipientData[recipient].distributionCount += 1;
    recipientData[recipient].dates.push(dateKey);

    // Age group trends
    if (dist.ageGroups) {
      ['kid', 'adult', 'elder'].forEach(ageGroup => {
        if (!ageGroupData[ageGroup][dateKey]) {
          ageGroupData[ageGroup][dateKey] = 0;
        }
        ageGroupData[ageGroup][dateKey] += dist.ageGroups[ageGroup] || 0;
      });
    }
  });

  // Convert to arrays for charting
  const dailyTrend = Object.values(dailyData).sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  // Prepare category trends for stacked area chart
  const categoryTrends = prepareCategoryTrends(categoryData, dailyData);

  // Calculate peak distribution times
  const peakDay = findPeakDay(dailyData);
  const averageDaily = calculateAverage(dailyData, 'totalWeight');

  return {
    dailyTrend,
    categoryTrends,
    recipientData,
    ageGroupData,
    peakDay,
    averageDaily,
    totalDistributions: relevantDistributions.length,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    }
  };
}

/**
 * Analyze inventory trends over time
 * @param {array} inventorySnapshots - Historical inventory snapshots
 * @param {number} days - Number of days to analyze
 * @returns {object} Inventory trend data
 */
export function analyzeInventoryTrends(inventorySnapshots, days = 30) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

  // Filter snapshots within date range
  const relevantSnapshots = inventorySnapshots.filter(snapshot => {
    const snapshotDate = new Date(snapshot.timestamp || snapshot.date);
    return snapshotDate >= startDate;
  }).sort((a, b) => {
    const dateA = new Date(a.timestamp || a.date);
    const dateB = new Date(b.timestamp || b.date);
    return dateA - dateB;
  });

  if (relevantSnapshots.length === 0) {
    return {
      trend: [],
      categoryTrends: {},
      totalChange: 0,
      averageInventory: 0
    };
  }

  const categoryTrends = {};
  const totalTrend = [];

  relevantSnapshots.forEach(snapshot => {
    const date = new Date(snapshot.timestamp || snapshot.date).toISOString().split('T')[0];
    let dailyTotal = 0;

    Object.entries(snapshot.inventory || {}).forEach(([category, weight]) => {
      if (!categoryTrends[category]) {
        categoryTrends[category] = [];
      }
      categoryTrends[category].push({
        date,
        weight,
        category
      });
      dailyTotal += weight;
    });

    totalTrend.push({
      date,
      totalWeight: dailyTotal
    });
  });

  // Calculate change
  const firstTotal = totalTrend[0]?.totalWeight || 0;
  const lastTotal = totalTrend[totalTrend.length - 1]?.totalWeight || 0;
  const totalChange = lastTotal - firstTotal;
  const percentChange = firstTotal > 0 ? ((totalChange / firstTotal) * 100).toFixed(1) : 0;

  // Calculate average
  const averageInventory = totalTrend.reduce((sum, day) => sum + day.totalWeight, 0) / totalTrend.length;

  return {
    trend: totalTrend,
    categoryTrends,
    totalChange,
    percentChange,
    averageInventory: Math.round(averageInventory)
  };
}

/**
 * Detect seasonal patterns in distribution data
 * @param {array} distributionHistory - All distribution records
 * @returns {object} Seasonal pattern analysis
 */
export function detectSeasonalPatterns(distributionHistory) {
  const monthlyData = {};
  const weeklyData = {};
  const dayOfWeekData = {};

  distributionHistory.forEach(dist => {
    const distDate = parseDate(dist);
    if (!distDate) return;

    // Monthly aggregation
    const monthKey = `${distDate.getFullYear()}-${String(distDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        totalWeight: 0,
        totalClients: 0,
        distributionCount: 0
      };
    }
    monthlyData[monthKey].totalWeight += dist.totalDistributed || 0;
    monthlyData[monthKey].totalClients += dist.clientsServed || 0;
    monthlyData[monthKey].distributionCount += 1;

    // Day of week aggregation
    const dayOfWeek = distDate.getDay(); // 0 = Sunday
    if (!dayOfWeekData[dayOfWeek]) {
      dayOfWeekData[dayOfWeek] = {
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        totalWeight: 0,
        distributionCount: 0
      };
    }
    dayOfWeekData[dayOfWeek].totalWeight += dist.totalDistributed || 0;
    dayOfWeekData[dayOfWeek].distributionCount += 1;
  });

  // Convert to arrays
  const monthlyTrend = Object.values(monthlyData).sort((a, b) => 
    a.month.localeCompare(b.month)
  );

  const weekdayTrend = Object.values(dayOfWeekData);

  // Identify peak month
  const peakMonth = monthlyTrend.length > 0 ?
    monthlyTrend.reduce((max, current) => 
      current.totalWeight > max.totalWeight ? current : max
    ) : null;

  // Identify peak day of week
  const peakDay = weekdayTrend.length > 0 ?
    weekdayTrend.reduce((max, current) => 
      current.totalWeight > max.totalWeight ? current : max
    ) : null;

  return {
    monthlyTrend,
    weekdayTrend,
    peakMonth,
    peakDay
  };
}

/**
 * Analyze demographic trends over time
 * @param {array} distributionHistory - Distribution records with age groups
 * @param {number} days - Number of days to analyze
 * @returns {object} Demographic trend data
 */
export function analyzeDemographicTrends(distributionHistory, days = 30) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

  const weeklyData = {};

  distributionHistory.forEach(dist => {
    const distDate = parseDate(dist);
    if (!distDate || distDate < startDate) return;

    // Group by week
    const weekStart = new Date(distDate);
    weekStart.setDate(distDate.getDate() - distDate.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        week: weekKey,
        kid: 0,
        adult: 0,
        elder: 0,
        total: 0
      };
    }

    if (dist.ageGroups) {
      weeklyData[weekKey].kid += dist.ageGroups.kid || 0;
      weeklyData[weekKey].adult += dist.ageGroups.adult || 0;
      weeklyData[weekKey].elder += dist.ageGroups.elder || 0;
      weeklyData[weekKey].total += (dist.ageGroups.kid || 0) + 
                                     (dist.ageGroups.adult || 0) + 
                                     (dist.ageGroups.elder || 0);
    }
  });

  const weeklyTrend = Object.values(weeklyData)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(week => ({
      ...week,
      kidPercent: week.total > 0 ? ((week.kid / week.total) * 100).toFixed(1) : 0,
      adultPercent: week.total > 0 ? ((week.adult / week.total) * 100).toFixed(1) : 0,
      elderPercent: week.total > 0 ? ((week.elder / week.total) * 100).toFixed(1) : 0
    }));

  return {
    weeklyTrend,
    totalClients: weeklyTrend.reduce((sum, week) => sum + week.total, 0)
  };
}

/**
 * Calculate efficiency metrics over time
 * @param {array} distributionHistory - Distribution records
 * @param {array} inventorySnapshots - Inventory snapshots
 * @param {number} days - Number of days to analyze
 * @returns {object} Efficiency metrics
 */
export function calculateEfficiencyMetrics(distributionHistory, inventorySnapshots, days = 30) {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

  // Calculate distribution efficiency (weight per distribution)
  const recentDistributions = distributionHistory.filter(dist => {
    const distDate = parseDate(dist);
    return distDate && distDate >= startDate;
  });

  const avgDistributionSize = recentDistributions.length > 0 ?
    recentDistributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0) / recentDistributions.length :
    0;

  const avgClientsPerDistribution = recentDistributions.length > 0 ?
    recentDistributions.reduce((sum, dist) => sum + (dist.clientsServed || 0), 0) / recentDistributions.length :
    0;

  // Calculate inventory turnover from snapshots
  const turnoverHistory = [];
  if (inventorySnapshots.length > 1) {
    for (let i = 1; i < inventorySnapshots.length; i++) {
      const prevSnapshot = inventorySnapshots[i - 1];
      const currSnapshot = inventorySnapshots[i];
      
      const prevTotal = Object.values(prevSnapshot.inventory || {}).reduce((sum, w) => sum + w, 0);
      const currTotal = Object.values(currSnapshot.inventory || {}).reduce((sum, w) => sum + w, 0);
      
      const avgInventory = (prevTotal + currTotal) / 2;
      
      // Calculate distributions between snapshots
      const snapshotDate1 = new Date(prevSnapshot.timestamp || prevSnapshot.date);
      const snapshotDate2 = new Date(currSnapshot.timestamp || currSnapshot.date);
      
      const distributionsBetween = distributionHistory.filter(dist => {
        const distDate = parseDate(dist);
        return distDate && distDate >= snapshotDate1 && distDate < snapshotDate2;
      });
      
      const totalDistributed = distributionsBetween.reduce((sum, dist) => 
        sum + (dist.totalDistributed || 0), 0
      );
      
      const turnoverRate = avgInventory > 0 ? (totalDistributed / avgInventory) : 0;
      
      turnoverHistory.push({
        date: snapshotDate2.toISOString().split('T')[0],
        turnoverRate: parseFloat(turnoverRate.toFixed(3)),
        avgInventory: Math.round(avgInventory),
        distributed: Math.round(totalDistributed)
      });
    }
  }

  return {
    avgDistributionSize: Math.round(avgDistributionSize),
    avgClientsPerDistribution: Math.round(avgClientsPerDistribution * 10) / 10,
    turnoverHistory,
    totalDistributions: recentDistributions.length
  };
}

// Helper functions

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

function prepareCategoryTrends(categoryData, dailyData) {
  const allDates = Object.keys(dailyData).sort();
  const trends = {};

  Object.keys(categoryData).forEach(category => {
    trends[category] = allDates.map(date => ({
      date,
      [category]: categoryData[category][date] || 0
    }));
  });

  return trends;
}

function findPeakDay(dailyData) {
  const entries = Object.values(dailyData);
  if (entries.length === 0) return null;

  return entries.reduce((max, current) => 
    current.totalWeight > max.totalWeight ? current : max
  );
}

function calculateAverage(dailyData, field) {
  const entries = Object.values(dailyData);
  if (entries.length === 0) return 0;

  const sum = entries.reduce((total, day) => total + (day[field] || 0), 0);
  return Math.round(sum / entries.length);
}

