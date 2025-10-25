import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';
import { useAuth } from '../../backend/contexts/AuthContext';
import firestoreService from '../../backend/services/firestoreService';
import TrendCharts from '../components/TrendCharts';
import ForecastingDashboard from '../components/ForecastingDashboard';
import { 
  analyzeDistributionTrends,
  analyzeInventoryTrends,
  detectSeasonalPatterns,
  analyzeDemographicTrends,
  calculateEfficiencyMetrics
} from '../../backend/utils/TrendAnalysis';
import {
  forecastDemand,
  calculateInventoryTargets,
  predictWaste,
  assessInventoryRisk
} from '../../backend/utils/ForecastingEngine';

const ReportsInterface = ({ distributionHistory, currentInventory }) => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState('trends'); // 'trends', 'forecast', 'reports'
  const [dateRange, setDateRange] = useState(30);
  
  // Trend analysis state
  const [distributionTrends, setDistributionTrends] = useState(null);
  const [inventoryTrends, setInventoryTrends] = useState(null);
  const [seasonalPatterns, setSeasonalPatterns] = useState(null);
  const [demographicTrends, setDemographicTrends] = useState(null);
  const [efficiencyMetrics, setEfficiencyMetrics] = useState(null);
  
  // Forecasting state
  const [demandForecast, setDemandForecast] = useState(null);
  const [inventoryTargets, setInventoryTargets] = useState(null);
  const [wastePrediction, setWastePrediction] = useState(null);
  const [riskAssessment, setRiskAssessment] = useState(null);
  
  // Reports state (existing)
  const [reportConfig, setReportConfig] = useState({
    startDate: '',
    endDate: '',
    reportType: 'summary',
    includeAgeGroups: true
  });
  const [generatedReport, setGeneratedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Detailed inventory for waste prediction
  const [detailedInventory, setDetailedInventory] = useState({});

  // Load detailed inventory
  useEffect(() => {
    const savedDetailedInventory = localStorage.getItem('detailedInventory');
    if (savedDetailedInventory) {
      try {
        setDetailedInventory(JSON.parse(savedDetailedInventory));
      } catch (error) {
        console.error('[ReportsInterface] Invalid JSON in localStorage:', error);
        setDetailedInventory({});
      }
    }
  }, []);

  // Set default date range (last 30 days)
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    setReportConfig(prev => ({
      ...prev,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }));
  }, []);

  // Calculate trend analysis when data changes
  useEffect(() => {
    if (!distributionHistory || distributionHistory.length === 0) return;
    
    try {
      // Distribution trends
      const distTrends = analyzeDistributionTrends(distributionHistory, dateRange);
      setDistributionTrends(distTrends);
      
      // Seasonal patterns
      const seasonal = detectSeasonalPatterns(distributionHistory);
      setSeasonalPatterns(seasonal);
      
      // Demographic trends
      const demographics = analyzeDemographicTrends(distributionHistory, dateRange);
      setDemographicTrends(demographics);
      
      // For inventory trends, we'd need historical snapshots
      // For now, we'll leave it empty or show a message
      setInventoryTrends({ trend: [], categoryTrends: {}, totalChange: 0, averageInventory: 0 });
      
    } catch (error) {
      console.error('Error calculating trend analysis:', error);
    }
  }, [distributionHistory, dateRange]);

  // Calculate forecasts when inventory/distribution data changes
  useEffect(() => {
    if (!currentInventory || !distributionHistory) return;
    
    try {
      // Demand forecast
      const forecast = forecastDemand(distributionHistory, 30);
      setDemandForecast(forecast);
      
      // Inventory targets
      if (forecast && forecast.forecast) {
        const targets = calculateInventoryTargets(forecast, currentInventory, 7, 7);
        setInventoryTargets(targets);
      }
      
      // Waste prediction
      if (Object.keys(detailedInventory).length > 0) {
        const waste = predictWaste(detailedInventory, forecast);
        setWastePrediction(waste);
      }
      
      // Risk assessment
      const stockoutPredictions = {}; // We'd calculate this from InventoryAnalytics
      const risk = assessInventoryRisk(currentInventory, stockoutPredictions, wastePrediction);
      setRiskAssessment(risk);
      
    } catch (error) {
      console.error('Error calculating forecasts:', error);
    }
  }, [currentInventory, distributionHistory, detailedInventory]);

  const generateReport = () => {
    if (!reportConfig.startDate || !reportConfig.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setIsGenerating(true);
    
    try {
      const startDate = new Date(reportConfig.startDate);
      const endDate = new Date(reportConfig.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date

      // Filter distributions within date range
      const filteredDistributions = distributionHistory.filter(dist => {
        let distDate = null;
        if (dist.createdAt && dist.createdAt.toDate) {
          distDate = dist.createdAt.toDate();
        } else if (dist.createdAt && typeof dist.createdAt === 'string') {
          distDate = new Date(dist.createdAt);
        } else if (dist.timestamp) {
          distDate = new Date(dist.timestamp);
        } else if (dist.date) {
          if (typeof dist.date === 'string' && dist.date.includes('-')) {
            distDate = new Date(dist.date + 'T00:00:00');
          } else {
            distDate = new Date(dist.date);
          }
        }
        
        if (!distDate || isNaN(distDate.getTime())) return false;
        return distDate >= startDate && distDate <= endDate;
      });

      // Calculate report data
      const reportData = calculateReportData(filteredDistributions, reportConfig);
      setGeneratedReport(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateReportData = (distributions, config) => {
    const totalDistributed = distributions.reduce((sum, dist) => sum + (dist.totalDistributed || 0), 0);
    const totalClients = distributions.reduce((sum, dist) => sum + (dist.clientsServed || 0), 0);
    const totalDistributions = distributions.length;

    // Calculate total days with distributions
    const uniqueDays = new Set();
    distributions.forEach(dist => {
      let distDate = null;
      if (dist.createdAt && dist.createdAt.toDate) {
        distDate = dist.createdAt.toDate();
      } else if (dist.createdAt && typeof dist.createdAt === 'string') {
        distDate = new Date(dist.createdAt);
      } else if (dist.timestamp) {
        distDate = new Date(dist.timestamp);
      } else if (dist.date) {
        if (typeof dist.date === 'string' && dist.date.includes('-')) {
          distDate = new Date(dist.date + 'T00:00:00');
        } else {
          distDate = new Date(dist.date);
        }
      }
      if (distDate && !isNaN(distDate.getTime())) {
        uniqueDays.add(distDate.toISOString().split('T')[0]);
      }
    });
    const totalDaysDistributed = uniqueDays.size;

    // Age group totals
    const ageGroupTotals = distributions.reduce((totals, dist) => {
      console.log('[REPORTS] Processing distribution ageGroups:', dist.ageGroups, 'for dist:', dist.recipient);
      if (dist.ageGroups) {
        totals.elder += dist.ageGroups.elder || 0;
        totals.adult += dist.ageGroups.adult || 0;
        totals.kid += dist.ageGroups.kid || 0;
      }
      return totals;
    }, { elder: 0, adult: 0, kid: 0 });
    
    console.log('[REPORTS] Final age group totals:', ageGroupTotals);

    // Category totals
    const categoryTotals = distributions.reduce((totals, dist) => {
      if (dist.categoryTotals) {
        Object.entries(dist.categoryTotals).forEach(([category, weight]) => {
          totals[category] = (totals[category] || 0) + weight;
        });
      }
      return totals;
    }, {});

    // Recipient breakdown
    const recipientBreakdown = distributions.reduce((breakdown, dist) => {
      const recipient = dist.recipient || 'Unknown';
      if (!breakdown[recipient]) {
        breakdown[recipient] = {
          distributions: 0,
          totalWeight: 0,
          totalClients: 0,
          ageGroups: { elder: 0, adult: 0, kid: 0 }
        };
      }
      breakdown[recipient].distributions += 1;
      breakdown[recipient].totalWeight += dist.totalDistributed || 0;
      breakdown[recipient].totalClients += dist.clientsServed || 0;
      
      if (dist.ageGroups) {
        breakdown[recipient].ageGroups.elder += dist.ageGroups.elder || 0;
        breakdown[recipient].ageGroups.adult += dist.ageGroups.adult || 0;
        breakdown[recipient].ageGroups.kid += dist.ageGroups.kid || 0;
      }
      
      return breakdown;
    }, {});

    return {
      dateRange: {
        start: config.startDate,
        end: config.endDate
      },
      summary: {
        totalDistributed,
        totalClients,
        totalDistributions,
        totalDaysDistributed,
        averagePerDistribution: totalDistributions > 0 ? totalDistributed / totalDistributions : 0,
        averagePerClient: totalClients > 0 ? totalDistributed / totalClients : 0
      },
      ageGroups: ageGroupTotals,
      categories: categoryTotals,
      recipients: recipientBreakdown,
      distributions: config.reportType === 'detailed' ? distributions : null,
      generatedAt: new Date().toISOString()
    };
  };

  const exportReport = (format = 'txt') => {
    if (!generatedReport) return;

    const reportData = {
      ...generatedReport,
      exportDate: new Date().toISOString(),
      exportedBy: currentUser?.displayName || currentUser?.email || 'Unknown'
    };

    if (format === 'txt') {
      exportAsTxt(reportData);
    } else if (format === 'pdf') {
      exportAsPdf(reportData);
    } else {
      // Fallback to JSON
      exportAsJson(reportData);
    }
  };

  const exportAsTxt = (reportData) => {
    let txtContent = '';
    
    // Header
    txtContent += 'FOOD BANK DISTRIBUTION REPORT\n';
    txtContent += '='.repeat(50) + '\n\n';
    txtContent += `Generated: ${new Date(reportData.exportDate).toLocaleString()}\n`;
    txtContent += `Exported by: ${reportData.exportedBy}\n`;
    txtContent += `Date Range: ${formatDate(reportData.dateRange.start)} to ${formatDate(reportData.dateRange.end)}\n\n`;
    
    // Summary
    txtContent += 'SUMMARY\n';
    txtContent += '-'.repeat(20) + '\n';
    txtContent += `Total Distributions: ${reportData.summary.totalDistributions}\n`;
    txtContent += `Total Days with Distributions: ${reportData.summary.totalDaysDistributed}\n`;
    txtContent += `Total Weight Distributed: ${formatWeight(reportData.summary.totalDistributed)}\n`;
    txtContent += `Total Clients Served: ${reportData.summary.totalClients.toLocaleString()}\n`;
    txtContent += `Average per Distribution: ${formatWeight(reportData.summary.averagePerDistribution)}\n`;
    txtContent += `Average per Client: ${formatWeight(reportData.summary.averagePerClient)}\n\n`;
    
    // Age Groups
    txtContent += 'CLIENT AGE DEMOGRAPHICS\n';
    txtContent += '-'.repeat(30) + '\n';
    txtContent += `Children (0-17): ${reportData.ageGroups.kid}\n`;
    txtContent += `Adults (18-64): ${reportData.ageGroups.adult}\n`;
    txtContent += `Elders (65+): ${reportData.ageGroups.elder}\n\n`;
    
    // Categories
    txtContent += 'FOOD CATEGORY DISTRIBUTION\n';
    txtContent += '-'.repeat(35) + '\n';
    Object.entries(reportData.categories).forEach(([category, weight]) => {
      const percentage = reportData.summary.totalDistributed > 0 
        ? ((weight / reportData.summary.totalDistributed) * 100).toFixed(1)
        : 0;
      txtContent += `${category}: ${formatWeight(weight)} (${percentage}%)\n`;
    });
    txtContent += '\n';
    
    // Recipients
    txtContent += 'RECIPIENT ORGANIZATIONS\n';
    txtContent += '-'.repeat(30) + '\n';
    Object.entries(reportData.recipients).forEach(([recipient, data]) => {
      txtContent += `${recipient}:\n`;
      txtContent += `  Distributions: ${data.distributions}\n`;
      txtContent += `  Total Weight: ${formatWeight(data.totalWeight)}\n`;
      txtContent += `  Total Clients: ${data.totalClients}\n`;
      txtContent += `  Children: ${data.ageGroups.kid}, Adults: ${data.ageGroups.adult}, Elders: ${data.ageGroups.elder}\n\n`;
    });
    
    // Detailed distributions if available
    if (reportData.distributions && reportData.distributions.length > 0) {
      txtContent += 'DETAILED DISTRIBUTION RECORDS\n';
      txtContent += '-'.repeat(40) + '\n';
      reportData.distributions.forEach((dist, index) => {
        txtContent += `${index + 1}. ${formatDate(dist.date)} - ${dist.recipient}\n`;
        txtContent += `   Weight: ${formatWeight(dist.totalDistributed || 0)}\n`;
        txtContent += `   Clients: ${dist.clientsServed || 0}\n`;
        txtContent += `   Age Groups: Children: ${dist.ageGroups?.kid || 0}, Adults: ${dist.ageGroups?.adult || 0}, Elders: ${dist.ageGroups?.elder || 0}\n`;
        if (dist.notes) txtContent += `   Notes: ${dist.notes}\n`;
        txtContent += '\n';
      });
    }
    
    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txtContent);
    const fileName = `food-bank-report-${reportConfig.startDate}-to-${reportConfig.endDate}.txt`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  };

  const exportAsPdf = (reportData) => {
    // Simple PDF generation using browser's print functionality
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Food Bank Distribution Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: var(--text-primary, #333); }
          .header { text-align: center; margin-bottom: 30px; }
          .section { margin-bottom: 25px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid var(--border-color, #ddd); padding: 8px; text-align: left; }
          th { background-color: var(--bg-secondary, #f2f2f2); }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .metric { margin-bottom: 10px; }
          .metric-label { font-weight: bold; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FOOD BANK DISTRIBUTION REPORT</h1>
          <p>Generated: ${new Date(reportData.exportDate).toLocaleString()}</p>
          <p>Exported by: ${reportData.exportedBy}</p>
          <p>Date Range: ${formatDate(reportData.dateRange.start)} to ${formatDate(reportData.dateRange.end)}</p>
        </div>
        
        <div class="section">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div>
              <div class="metric"><span class="metric-label">Total Distributions:</span> ${reportData.summary.totalDistributions}</div>
              <div class="metric"><span class="metric-label">Total Days with Distributions:</span> ${reportData.summary.totalDaysDistributed}</div>
              <div class="metric"><span class="metric-label">Total Weight Distributed:</span> ${formatWeight(reportData.summary.totalDistributed)}</div>
            </div>
            <div>
              <div class="metric"><span class="metric-label">Total Clients Served:</span> ${reportData.summary.totalClients.toLocaleString()}</div>
              <div class="metric"><span class="metric-label">Average per Distribution:</span> ${formatWeight(reportData.summary.averagePerDistribution)}</div>
              <div class="metric"><span class="metric-label">Average per Client:</span> ${formatWeight(reportData.summary.averagePerClient)}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Client Age Demographics</h2>
          <table>
            <tr><th>Age Group</th><th>Count</th><th>Percentage</th></tr>
            <tr><td>Children (0-17)</td><td>${reportData.ageGroups.kid}</td><td>${reportData.summary.totalClients > 0 ? ((reportData.ageGroups.kid / reportData.summary.totalClients) * 100).toFixed(1) : 0}%</td></tr>
            <tr><td>Adults (18-64)</td><td>${reportData.ageGroups.adult}</td><td>${reportData.summary.totalClients > 0 ? ((reportData.ageGroups.adult / reportData.summary.totalClients) * 100).toFixed(1) : 0}%</td></tr>
            <tr><td>Elders (65+)</td><td>${reportData.ageGroups.elder}</td><td>${reportData.summary.totalClients > 0 ? ((reportData.ageGroups.elder / reportData.summary.totalClients) * 100).toFixed(1) : 0}%</td></tr>
          </table>
        </div>
        
        <div class="section">
          <h2>Food Category Distribution</h2>
          <table>
            <tr><th>Category</th><th>Weight</th><th>Percentage</th></tr>
            ${Object.entries(reportData.categories).map(([category, weight]) => {
              const percentage = reportData.summary.totalDistributed > 0 
                ? ((weight / reportData.summary.totalDistributed) * 100).toFixed(1)
                : 0;
              return `<tr><td>${category}</td><td>${formatWeight(weight)}</td><td>${percentage}%</td></tr>`;
            }).join('')}
          </table>
        </div>
        
        <div class="section">
          <h2>Recipient Organizations</h2>
          <table>
            <tr><th>Organization</th><th>Distributions</th><th>Total Weight</th><th>Total Clients</th><th>Children</th><th>Adults</th><th>Elders</th></tr>
            ${Object.entries(reportData.recipients).map(([recipient, data]) => 
              `<tr><td>${recipient}</td><td>${data.distributions}</td><td>${formatWeight(data.totalWeight)}</td><td>${data.totalClients}</td><td>${data.ageGroups.kid}</td><td>${data.ageGroups.adult}</td><td>${data.ageGroups.elder}</td></tr>`
            ).join('')}
          </table>
        </div>
        
        ${reportData.distributions && reportData.distributions.length > 0 ? `
        <div class="section">
          <h2>Detailed Distribution Records</h2>
          <table>
            <tr><th>Date</th><th>Recipient</th><th>Weight</th><th>Clients</th><th>Children</th><th>Adults</th><th>Elders</th><th>Notes</th></tr>
            ${reportData.distributions.map(dist => 
              `<tr><td>${formatDate(dist.date)}</td><td>${dist.recipient}</td><td>${formatWeight(dist.totalDistributed || 0)}</td><td>${dist.clientsServed || 0}</td><td>${dist.ageGroups?.kid || 0}</td><td>${dist.ageGroups?.adult || 0}</td><td>${dist.ageGroups?.elder || 0}</td><td>${dist.notes || ''}</td></tr>`
            ).join('')}
          </table>
        </div>
        ` : ''}
        
        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background-color: var(--accent-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">Print PDF</button>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Auto-print after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const exportAsJson = (reportData) => {
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `food-bank-report-${reportConfig.startDate}-to-${reportConfig.endDate}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatWeight = (weight) => {
    return weight.toLocaleString() + ' lbs';
  };

  return (
    <div className="reports-interface analytics-dashboard">
      <div className="analytics-header">
        <div className="header-content">
          <h2>Analytics & Insights</h2>
          <p className="header-subtitle">
            Historical trends, predictive forecasting, and comprehensive reports
          </p>
        </div>
      </div>

      <nav className="analytics-nav">
        <button 
          className={`nav-item ${activeView === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveView('trends')}
        >
          <span className="nav-label">Trend Analysis</span>
        </button>
        <button 
          className={`nav-item ${activeView === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveView('forecast')}
        >
          <span className="nav-label">Forecasting</span>
        </button>
        <button 
          className={`nav-item ${activeView === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveView('reports')}
        >
          <span className="nav-label">Reports</span>
        </button>
      </nav>

      <div className="analytics-content">
        {/* Trend Analysis View */}
        {activeView === 'trends' && (
          <div className="trends-view">
            <div className="view-header">
              <h3>Historical Trends & Patterns</h3>
              <p className="view-description">
                Analyze historical data to identify patterns, seasonal trends, and operational insights
              </p>
            </div>
            
            <TrendCharts
              distributionTrends={distributionTrends}
              inventoryTrends={inventoryTrends}
              seasonalPatterns={seasonalPatterns}
              demographicTrends={demographicTrends}
            />

            {efficiencyMetrics && (
              <div className="efficiency-metrics-section">
                <h3>Efficiency Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <h4>Avg Distribution Size</h4>
                    <p className="metric-value">{efficiencyMetrics.avgDistributionSize} lbs</p>
                  </div>
                  <div className="metric-card">
                    <h4>Avg Clients per Distribution</h4>
                    <p className="metric-value">{efficiencyMetrics.avgClientsPerDistribution}</p>
                  </div>
                  <div className="metric-card">
                    <h4>Total Distributions</h4>
                    <p className="metric-value">{efficiencyMetrics.totalDistributions}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Forecasting View */}
        {activeView === 'forecast' && (
          <div className="forecasting-view">
            <div className="view-header">
              <h3>Predictive Forecasting & Planning</h3>
              <p className="view-description">
                Data-driven predictions for demand, inventory targets, and waste prevention
              </p>
            </div>
            
            <ForecastingDashboard
              demandForecast={demandForecast}
              inventoryTargets={inventoryTargets}
              wastePrediction={wastePrediction}
              riskAssessment={riskAssessment}
            />
          </div>
        )}

        {/* Reports View (existing functionality) */}
        {activeView === 'reports' && (
          <div className="reports-view">
            <div className="form-container">
              <h3>Generate Reports</h3>
        
        {/* Report Configuration */}
        <div className="form-section">
          <h3>Report Configuration</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label-enhanced">Start Date:</label>
              <input
                type="date"
                className="form-control-enhanced"
                value={reportConfig.startDate}
                onChange={(e) => setReportConfig({...reportConfig, startDate: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">End Date:</label>
              <input
                type="date"
                className="form-control-enhanced"
                value={reportConfig.endDate}
                onChange={(e) => setReportConfig({...reportConfig, endDate: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label className="form-label-enhanced">Report Type:</label>
              <select
                className="form-control-enhanced"
                value={reportConfig.reportType}
                onChange={(e) => setReportConfig({...reportConfig, reportType: e.target.value})}
              >
                <option value="summary">Summary Report</option>
                <option value="detailed">Detailed Report</option>
                <option value="ageGroups">Age Group Analysis</option>
              </select>
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              onClick={generateReport} 
              className="btn btn-primary"
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Generated Report */}
        {generatedReport && (
          <div className="form-section">
            <div className="report-header">
              <h3>Generated Report</h3>
              <div className="export-buttons">
                <button onClick={() => exportReport('txt')} className="btn btn-secondary">
                  Export TXT
                </button>
                <button onClick={() => exportReport('pdf')} className="btn btn-primary">
                  Export PDF
                </button>
                <button onClick={() => exportReport('json')} className="btn btn-light">
                  Export JSON
                </button>
              </div>
            </div>
            
            <div className="report-content">
              <div className="report-summary">
                <h4>Report Summary</h4>
                <p><strong>Date Range:</strong> {formatDate(generatedReport.dateRange.start)} to {formatDate(generatedReport.dateRange.end)}</p>
                <p><strong>Total Distributions:</strong> {generatedReport.summary.totalDistributions}</p>
                <p><strong>Total Days with Distributions:</strong> {generatedReport.summary.totalDaysDistributed}</p>
                <p><strong>Total Weight Distributed:</strong> {formatWeight(generatedReport.summary.totalDistributed)}</p>
                <p><strong>Total Clients Served:</strong> {generatedReport.summary.totalClients.toLocaleString()}</p>
                <p><strong>Average per Distribution:</strong> {formatWeight(generatedReport.summary.averagePerDistribution)}</p>
                <p><strong>Average per Client:</strong> {formatWeight(generatedReport.summary.averagePerClient)}</p>
              </div>

              {/* Age Group Breakdown */}
              {reportConfig.includeAgeGroups && (
                <div className="report-age-groups">
                  <h4>Client Age Demographics</h4>
                  <div className="age-group-stats">
                    <div className="age-group-card">
                      <h5>Children (0-17)</h5>
                      <p className="age-count">{generatedReport.ageGroups.kid}</p>
                      <p className="age-percentage">
                        {generatedReport.summary.totalClients > 0 
                          ? ((generatedReport.ageGroups.kid / generatedReport.summary.totalClients) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div className="age-group-card">
                      <h5>Adults (18-64)</h5>
                      <p className="age-count">{generatedReport.ageGroups.adult}</p>
                      <p className="age-percentage">
                        {generatedReport.summary.totalClients > 0 
                          ? ((generatedReport.ageGroups.adult / generatedReport.summary.totalClients) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div className="age-group-card">
                      <h5>Elders (65+)</h5>
                      <p className="age-count">{generatedReport.ageGroups.elder}</p>
                      <p className="age-percentage">
                        {generatedReport.summary.totalClients > 0 
                          ? ((generatedReport.ageGroups.elder / generatedReport.summary.totalClients) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Breakdown */}
              <div className="report-categories">
                <h4>Food Category Distribution</h4>
                <div className="category-stats">
                  {Object.entries(generatedReport.categories).map(([category, weight]) => (
                    <div key={category} className="category-card">
                      <h5>{category}</h5>
                      <p className="category-weight">{formatWeight(weight)}</p>
                      <p className="category-percentage">
                        {generatedReport.summary.totalDistributed > 0 
                          ? ((weight / generatedReport.summary.totalDistributed) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient Breakdown */}
              <div className="report-recipients">
                <h4>Recipient Organizations</h4>
                <div className="recipient-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Organization</th>
                        <th>Distributions</th>
                        <th>Total Weight</th>
                        <th>Total Clients</th>
                        {reportConfig.includeAgeGroups && (
                          <>
                            <th>Children</th>
                            <th>Adults</th>
                            <th>Elders</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(generatedReport.recipients).map(([recipient, data]) => (
                        <tr key={recipient}>
                          <td>{recipient}</td>
                          <td>{data.distributions}</td>
                          <td>{formatWeight(data.totalWeight)}</td>
                          <td>{data.totalClients}</td>
                          {reportConfig.includeAgeGroups && (
                            <>
                              <td>{data.ageGroups.kid}</td>
                              <td>{data.ageGroups.adult}</td>
                              <td>{data.ageGroups.elder}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Distributions */}
              {reportConfig.reportType === 'detailed' && generatedReport.distributions && (
                <div className="report-detailed">
                  <h4>Detailed Distribution Records</h4>
                  <div className="detailed-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Recipient</th>
                          <th>Weight</th>
                          <th>Clients</th>
                          <th>Children</th>
                          <th>Adults</th>
                          <th>Elders</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.distributions.map((dist, index) => (
                          <tr key={index}>
                            <td>{formatDate(dist.date)}</td>
                            <td>{dist.recipient}</td>
                            <td>{formatWeight(dist.totalDistributed || 0)}</td>
                            <td>{dist.clientsServed || 0}</td>
                            <td>{dist.ageGroups?.kid || 0}</td>
                            <td>{dist.ageGroups?.adult || 0}</td>
                            <td>{dist.ageGroups?.elder || 0}</td>
                            <td>{dist.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsInterface;
