// Data export utilities for CSV, PDF, and other formats

export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    // Headers
    headers.join(','),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJSON = (data, filename = 'export.json') => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportInventoryData = (inventory, unitConfig) => {
  const exportData = Object.entries(inventory).map(([category, weight]) => ({
    Category: category,
    Weight: `${weight.toFixed(1)} lbs`,
    Status: getCategoryStatus(weight, category),
    Target: `${MYPLATE_GOALS[category] || 0} lbs`,
    Percentage: `${((weight / (MYPLATE_GOALS[category] || 1)) * 100).toFixed(1)}%`
  }));

  return exportData;
};

export const exportDistributionData = (distributions) => {
  return distributions.map(dist => ({
    Date: dist.date,
    Recipient: dist.recipient,
    'Total Weight': `${dist.totalDistributed.toFixed(1)} lbs`,
    'Clients Served': dist.clientsServed,
    'Children': dist.ageGroups?.kid || 0,
    'Adults': dist.ageGroups?.adult || 0,
    'Elderly': dist.ageGroups?.elder || 0,
    'Items Count': dist.items?.length || 0,
    Notes: dist.notes || ''
  }));
};

export const exportSurveyData = (surveys) => {
  return surveys.map(survey => ({
    Date: survey.date,
    Type: survey.type,
    'Total Weight': `${survey.totalWeight.toFixed(1)} lbs`,
    'Items Count': survey.items?.length || 0,
    Notes: survey.notes || ''
  }));
};

export const generateReportData = (inventory, distributions, surveys) => {
  const totalInventory = Object.values(inventory).reduce((sum, weight) => sum + weight, 0);
  const totalDistributed = distributions.reduce((sum, dist) => sum + dist.totalDistributed, 0);
  const totalClients = distributions.reduce((sum, dist) => sum + dist.clientsServed, 0);
  
  return {
    summary: {
      'Total Inventory': `${totalInventory.toFixed(1)} lbs`,
      'Total Distributed': `${totalDistributed.toFixed(1)} lbs`,
      'Total Clients Served': totalClients,
      'Distribution Events': distributions.length,
      'Survey Events': surveys.length
    },
    inventory: exportInventoryData(inventory),
    distributions: exportDistributionData(distributions),
    surveys: exportSurveyData(surveys)
  };
};

// Helper function to get category status (you'll need to import this from your existing code)
const getCategoryStatus = (weight, category) => {
  const target = MYPLATE_GOALS[category] || 0;
  if (weight >= target * 1.1) return 'Over Target';
  if (weight >= target * 0.9) return 'On Target';
  return 'Under Target';
};

// Import these from your existing files
const MYPLATE_GOALS = {
  'DAIRY': 100,
  'GRAIN': 150,
  'PROTEIN': 80,
  'FRUIT': 100,
  'VEG': 120,
  'PRODUCE': 50,
  'MISC': 30
};
