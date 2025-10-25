import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';

const AIReportGenerator = ({ inventoryData, distributionData, surveyData }) => {
  const { t } = useLanguage();
  const { showSuccess, showError, showInfo } = useNotifications();
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);

  // AI-powered analysis function
  const generateAIRecommendations = async () => {
    setIsGenerating(true);
    
    try {
      // Simulate AI processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Analyze inventory patterns
      const inventoryAnalysis = analyzeInventoryPatterns(inventoryData);
      const distributionAnalysis = analyzeDistributionPatterns(distributionData);
      const surveyAnalysis = analyzeSurveyPatterns(surveyData);
      
      // Generate recommendations based on analysis
      const aiRecommendations = generateRecommendations({
        inventory: inventoryAnalysis,
        distribution: distributionAnalysis,
        survey: surveyAnalysis
      });
      
      setAnalysisData({ inventory: inventoryAnalysis, distribution: distributionAnalysis, survey: surveyAnalysis });
      setRecommendations(aiRecommendations);
      
      showSuccess('AI Analysis Complete', 'Generated intelligent recommendations based on your data patterns');
    } catch (error) {
      showError('Analysis Failed', 'Could not generate AI recommendations');
    } finally {
      setIsGenerating(false);
    }
  };

  // Analyze inventory patterns
  const analyzeInventoryPatterns = (data) => {
    if (!data || data.length === 0) return null;
    
    const categories = {};
    const totalWeight = data.reduce((sum, item) => sum + (item.weight || 0), 0);
    
    data.forEach(item => {
      const category = item.category || 'UNKNOWN';
      if (!categories[category]) {
        categories[category] = { count: 0, weight: 0, items: [] };
      }
      categories[category].count++;
      categories[category].weight += item.weight || 0;
      categories[category].items.push(item);
    });
    
    // Find low stock categories
    const lowStockCategories = Object.entries(categories)
      .filter(([_, data]) => data.weight < 100) // Less than 100 lbs
      .map(([category, _]) => category);
    
    // Find expiring items
    const expiringItems = data.filter(item => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      const now = new Date();
      const daysUntilExpiry = (expDate - now) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    });
    
    return {
      totalItems: data.length,
      totalWeight,
      categories,
      lowStockCategories,
      expiringItems: expiringItems.length,
      expiringItemsList: expiringItems,
      averageWeightPerItem: totalWeight / data.length
    };
  };

  // Analyze distribution patterns
  const analyzeDistributionPatterns = (data) => {
    if (!data || data.length === 0) return null;
    
    const totalDistributed = data.reduce((sum, dist) => sum + (dist.totalWeight || 0), 0);
    const averageDistribution = totalDistributed / data.length;
    
    // Find most distributed categories
    const categoryDistribution = {};
    data.forEach(dist => {
      if (dist.items) {
        dist.items.forEach(item => {
          const category = item.category || 'UNKNOWN';
          categoryDistribution[category] = (categoryDistribution[category] || 0) + (item.weight || 0);
        });
      }
    });
    
    const topCategories = Object.entries(categoryDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, _]) => category);
    
    return {
      totalDistributions: data.length,
      totalDistributed,
      averageDistribution,
      topCategories,
      categoryDistribution
    };
  };

  // Analyze survey patterns
  const analyzeSurveyPatterns = (data) => {
    if (!data || data.length === 0) return null;
    
    const totalRecipients = data.reduce((sum, survey) => sum + (survey.recipientCount || 0), 0);
    const ageGroups = {};
    const householdSizes = {};
    
    data.forEach(survey => {
      // Age group analysis
      if (survey.ageGroups) {
        Object.entries(survey.ageGroups).forEach(([ageGroup, count]) => {
          ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + count;
        });
      }
      
      // Household size analysis
      if (survey.householdSize) {
        householdSizes[survey.householdSize] = (householdSizes[survey.householdSize] || 0) + 1;
      }
    });
    
    const mostCommonAgeGroup = Object.entries(ageGroups)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
    
    const averageHouseholdSize = Object.entries(householdSizes)
      .reduce((sum, [size, count]) => sum + (parseInt(size) * count), 0) / data.length;
    
    return {
      totalSurveys: data.length,
      totalRecipients,
      ageGroups,
      householdSizes,
      mostCommonAgeGroup,
      averageHouseholdSize
    };
  };

  // Generate AI recommendations
  const generateRecommendations = (analysis) => {
    const recommendations = [];
    
    // Inventory recommendations
    if (analysis.inventory) {
      const { lowStockCategories, expiringItems, totalWeight } = analysis.inventory;
      
      if (lowStockCategories.length > 0) {
        recommendations.push({
          type: 'critical',
          category: 'inventory',
          title: 'Low Stock Alert',
          description: `Critical low stock in categories: ${lowStockCategories.join(', ')}`,
          action: 'Order more items in these categories immediately',
          priority: 'high',
          impact: 'High - May affect food distribution capacity'
        });
      }
      
      if (expiringItems > 0) {
        recommendations.push({
          type: 'warning',
          category: 'inventory',
          title: 'Expiring Items',
          description: `${expiringItems} items are expiring within 7 days`,
          action: 'Prioritize distribution of expiring items or consider donation',
          priority: 'high',
          impact: 'Medium - Prevents food waste'
        });
      }
      
      if (totalWeight < 1000) {
        recommendations.push({
          type: 'info',
          category: 'inventory',
          title: 'Low Inventory Volume',
          description: `Total inventory weight is ${totalWeight.toFixed(0)} lbs`,
          action: 'Consider increasing inventory to meet demand',
          priority: 'medium',
          impact: 'Medium - Ensures adequate food supply'
        });
      }
    }
    
    // Distribution recommendations
    if (analysis.distribution) {
      const { topCategories, averageDistribution } = analysis.distribution;
      
      if (topCategories.length > 0) {
        recommendations.push({
          type: 'success',
          category: 'distribution',
          title: 'High Demand Categories',
          description: `Most distributed categories: ${topCategories.join(', ')}`,
          action: 'Maintain high stock levels for these popular categories',
          priority: 'medium',
          impact: 'High - Optimizes distribution efficiency'
        });
      }
      
      if (averageDistribution < 50) {
        recommendations.push({
          type: 'info',
          category: 'distribution',
          title: 'Small Distribution Sizes',
          description: `Average distribution is ${averageDistribution.toFixed(0)} lbs`,
          action: 'Consider increasing distribution sizes or frequency',
          priority: 'low',
          impact: 'Low - May improve recipient satisfaction'
        });
      }
    }
    
    // Survey-based recommendations
    if (analysis.survey) {
      const { mostCommonAgeGroup, averageHouseholdSize, totalRecipients } = analysis.survey;
      
      if (mostCommonAgeGroup !== 'Unknown') {
        recommendations.push({
          type: 'info',
          category: 'demographics',
          title: 'Target Demographic',
          description: `Primary age group served: ${mostCommonAgeGroup}`,
          action: 'Tailor inventory and programs to this demographic',
          priority: 'medium',
          impact: 'Medium - Improves service relevance'
        });
      }
      
      if (averageHouseholdSize > 4) {
        recommendations.push({
          type: 'success',
          category: 'distribution',
          title: 'Large Households',
          description: `Average household size is ${averageHouseholdSize.toFixed(1)} people`,
          action: 'Increase portion sizes for large families',
          priority: 'medium',
          impact: 'High - Better serves family needs'
        });
      }
    }
    
    // Strategic recommendations
    recommendations.push({
      type: 'strategic',
      category: 'operations',
      title: 'Data-Driven Insights',
      description: 'Your data shows strong patterns that can guide decision-making',
      action: 'Use these insights to optimize operations and improve service',
      priority: 'low',
      impact: 'High - Long-term operational improvement'
    });
    
    return recommendations;
  };

  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      case 'strategic': return '🎯';
      default: return '📊';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'var(--error)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'inventory': return '📦';
      case 'distribution': return '🚚';
      case 'demographics': return '👥';
      case 'operations': return '⚙️';
      default: return '📈';
    }
  };

  return (
    <div className="ai-report-generator">
      <div className="ai-header">
        <h2>🤖 AI-Powered Report Generator</h2>
        <p>Get intelligent insights and recommendations based on your data patterns</p>
      </div>

      <div className="ai-controls">
        <button 
          onClick={generateAIRecommendations}
          disabled={isGenerating}
          className="btn btn-primary ai-generate-btn"
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span>
              Analyzing Data...
            </>
          ) : (
            <>
              🧠 Generate AI Recommendations
            </>
          )}
        </button>
      </div>

      {recommendations && (
        <div className="ai-recommendations">
          <h3>🎯 AI Recommendations</h3>
          <div className="recommendations-grid">
            {recommendations.map((rec, index) => (
              <div key={index} className={`recommendation-card ${rec.type}`}>
                <div className="recommendation-header">
                  <span className="recommendation-icon">
                    {getRecommendationIcon(rec.type)}
                  </span>
                  <div className="recommendation-meta">
                    <span className="recommendation-category">
                      {getCategoryIcon(rec.category)} {rec.category.toUpperCase()}
                    </span>
                    <span 
                      className="recommendation-priority"
                      style={{ color: getPriorityColor(rec.priority) }}
                    >
                      {rec.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                </div>
                
                <div className="recommendation-content">
                  <h4>{rec.title}</h4>
                  <p className="recommendation-description">{rec.description}</p>
                  <div className="recommendation-action">
                    <strong>Recommended Action:</strong> {rec.action}
                  </div>
                  <div className="recommendation-impact">
                    <strong>Expected Impact:</strong> {rec.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisData && (
        <div className="ai-analysis-data">
          <h3>📊 Data Analysis Summary</h3>
          <div className="analysis-grid">
            {analysisData.inventory && (
              <div className="analysis-section">
                <h4>📦 Inventory Analysis</h4>
                <ul>
                  <li>Total Items: {analysisData.inventory.totalItems}</li>
                  <li>Total Weight: {analysisData.inventory.totalWeight.toFixed(0)} lbs</li>
                  <li>Low Stock Categories: {analysisData.inventory.lowStockCategories.length}</li>
                  <li>Expiring Items: {analysisData.inventory.expiringItems}</li>
                </ul>
              </div>
            )}
            
            {analysisData.distribution && (
              <div className="analysis-section">
                <h4>🚚 Distribution Analysis</h4>
                <ul>
                  <li>Total Distributions: {analysisData.distribution.totalDistributions}</li>
                  <li>Total Distributed: {analysisData.distribution.totalDistributed.toFixed(0)} lbs</li>
                  <li>Top Categories: {analysisData.distribution.topCategories.join(', ')}</li>
                </ul>
              </div>
            )}
            
            {analysisData.survey && (
              <div className="analysis-section">
                <h4>👥 Demographics Analysis</h4>
                <ul>
                  <li>Total Recipients: {analysisData.survey.totalRecipients}</li>
                  <li>Primary Age Group: {analysisData.survey.mostCommonAgeGroup}</li>
                  <li>Average Household Size: {analysisData.survey.averageHouseholdSize.toFixed(1)}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReportGenerator;