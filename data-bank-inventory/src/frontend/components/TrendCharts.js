import React, { useState } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const TrendCharts = ({ 
  distributionTrends, 
  inventoryTrends, 
  seasonalPatterns,
  demographicTrends 
}) => {
  const { t } = useLanguage();
  const [activeChart, setActiveChart] = useState('distribution');
  const [dateRange, setDateRange] = useState(30);

  const COLORS = {
    DAIRY: '#007bff',
    GRAIN: '#28a745',
    PROTEIN: '#ffc107',
    FRUIT: '#dc3545',
    VEG: '#17a2b8',
    PRODUCE: '#6f42c1',
    MISC: '#fd7e14'
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? Math.round(entry.value).toLocaleString() : entry.value}
              {entry.name.includes('Weight') || entry.name.includes('lbs') ? ' lbs' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="trend-charts">
      <div className="chart-controls">
        <div className="chart-type-selector">
          <button 
            className={`btn-chart-type ${activeChart === 'distribution' ? 'active' : ''}`}
            onClick={() => setActiveChart('distribution')}
          >
            Distribution Trends
          </button>
          <button 
            className={`btn-chart-type ${activeChart === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveChart('inventory')}
          >
            Inventory Trends
          </button>
          <button 
            className={`btn-chart-type ${activeChart === 'seasonal' ? 'active' : ''}`}
            onClick={() => setActiveChart('seasonal')}
          >
            Seasonal Patterns
          </button>
          <button 
            className={`btn-chart-type ${activeChart === 'demographics' ? 'active' : ''}`}
            onClick={() => setActiveChart('demographics')}
          >
            Demographics
          </button>
        </div>

        <div className="date-range-selector">
          <span className="selector-label">Time Range:</span>
          <button 
            className={`btn-range ${dateRange === 7 ? 'active' : ''}`}
            onClick={() => setDateRange(7)}
          >
            7 Days
          </button>
          <button 
            className={`btn-range ${dateRange === 30 ? 'active' : ''}`}
            onClick={() => setDateRange(30)}
          >
            30 Days
          </button>
          <button 
            className={`btn-range ${dateRange === 90 ? 'active' : ''}`}
            onClick={() => setDateRange(90)}
          >
            90 Days
          </button>
        </div>
      </div>

      <div className="chart-container">
        {/* Distribution Trends Chart */}
        {activeChart === 'distribution' && distributionTrends && (
          <div className="chart-section">
            <h3>Distribution Volume Over Time</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={distributionTrends.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="totalWeight" 
                  stroke="#007bff" 
                  strokeWidth={2}
                  name="Total Distributed (lbs)"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalClients" 
                  stroke="#28a745" 
                  strokeWidth={2}
                  name="Clients Served"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {distributionTrends.peakDay && (
              <div className="chart-insights">
                <h4>Key Insights:</h4>
                <ul>
                  <li>
                    <strong>Peak Distribution Day:</strong> {distributionTrends.peakDay.date} 
                    ({distributionTrends.peakDay.totalWeight.toLocaleString()} lbs)
                  </li>
                  <li>
                    <strong>Daily Average:</strong> {distributionTrends.averageDaily?.toLocaleString()} lbs
                  </li>
                  <li>
                    <strong>Total Distributions:</strong> {distributionTrends.totalDistributions}
                  </li>
                </ul>
              </div>
            )}

            {/* Category Breakdown Chart */}
            {distributionTrends.categoryTrends && Object.keys(distributionTrends.categoryTrends).length > 0 && (
              <>
                <h3 style={{ marginTop: '40px' }}>Distribution by Category</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={distributionTrends.dailyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {Object.keys(COLORS).map(category => (
                      <Area
                        key={category}
                        type="monotone"
                        dataKey={category}
                        stackId="1"
                        stroke={COLORS[category]}
                        fill={COLORS[category]}
                        fillOpacity={0.6}
                        name={category}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}

        {/* Inventory Trends Chart */}
        {activeChart === 'inventory' && inventoryTrends && (
          <div className="chart-section">
            <h3>Inventory Levels Over Time</h3>
            
            {inventoryTrends.trend && inventoryTrends.trend.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={inventoryTrends.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalWeight" 
                      stroke="#007bff" 
                      strokeWidth={2}
                      name="Total Inventory (lbs)"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="chart-insights">
                  <h4>Key Insights:</h4>
                  <ul>
                    <li>
                      <strong>Total Change:</strong> {inventoryTrends.totalChange > 0 ? '+' : ''}
                      {inventoryTrends.totalChange?.toLocaleString()} lbs 
                      ({inventoryTrends.percentChange > 0 ? '+' : ''}{inventoryTrends.percentChange}%)
                    </li>
                    <li>
                      <strong>Average Inventory:</strong> {inventoryTrends.averageInventory?.toLocaleString()} lbs
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="no-data">
                <p>No inventory trend data available</p>
                <p className="subtitle">Historical inventory snapshots are needed to show trends over time</p>
              </div>
            )}
          </div>
        )}

        {/* Seasonal Patterns Chart */}
        {activeChart === 'seasonal' && seasonalPatterns && (
          <div className="chart-section">
            <h3>Seasonal Distribution Patterns</h3>
            
            {seasonalPatterns.monthlyTrend && seasonalPatterns.monthlyTrend.length > 0 ? (
              <>
                <h4>Monthly Trends</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={seasonalPatterns.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="totalWeight" fill="#007bff" name="Total Distributed (lbs)" />
                    <Bar dataKey="totalClients" fill="#28a745" name="Clients Served" />
                  </BarChart>
                </ResponsiveContainer>

                {seasonalPatterns.peakMonth && (
                  <div className="chart-insights">
                    <h4>Key Insights:</h4>
                    <ul>
                      <li>
                        <strong>Peak Month:</strong> {seasonalPatterns.peakMonth.month} 
                        ({seasonalPatterns.peakMonth.totalWeight.toLocaleString()} lbs distributed)
                      </li>
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No seasonal data available yet</p>
                <p className="subtitle">Need at least 2 months of data to show seasonal patterns</p>
              </div>
            )}

            {seasonalPatterns.weekdayTrend && seasonalPatterns.weekdayTrend.length > 0 && (
              <>
                <h4 style={{ marginTop: '40px' }}>Day of Week Patterns</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={seasonalPatterns.weekdayTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="totalWeight" fill="#17a2b8" name="Avg Weight (lbs)" />
                  </BarChart>
                </ResponsiveContainer>

                {seasonalPatterns.peakDay && (
                  <div className="chart-insights">
                    <h4>Key Insights:</h4>
                    <ul>
                      <li>
                        <strong>Busiest Day:</strong> {seasonalPatterns.peakDay.day} 
                        (avg {Math.round(seasonalPatterns.peakDay.totalWeight / seasonalPatterns.peakDay.distributionCount)} lbs per distribution)
                      </li>
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Demographics Trends Chart */}
        {activeChart === 'demographics' && demographicTrends && (
          <div className="chart-section">
            <h3>Demographic Trends Over Time</h3>
            
            {demographicTrends.weeklyTrend && demographicTrends.weeklyTrend.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={demographicTrends.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="kid"
                      stackId="1"
                      stroke="#ffc107"
                      fill="#ffc107"
                      fillOpacity={0.6}
                      name="Children (0-17)"
                    />
                    <Area
                      type="monotone"
                      dataKey="adult"
                      stackId="1"
                      stroke="#007bff"
                      fill="#007bff"
                      fillOpacity={0.6}
                      name="Adults (18-64)"
                    />
                    <Area
                      type="monotone"
                      dataKey="elder"
                      stackId="1"
                      stroke="#6c757d"
                      fill="#6c757d"
                      fillOpacity={0.6}
                      name="Elders (65+)"
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="chart-insights">
                  <h4>Key Insights:</h4>
                  <ul>
                    <li>
                      <strong>Total Clients Served:</strong> {demographicTrends.totalClients?.toLocaleString()}
                    </li>
                    {demographicTrends.weeklyTrend.length > 0 && (
                      <>
                        <li>
                          <strong>Latest Week Breakdown:</strong> {' '}
                          Children: {demographicTrends.weeklyTrend[demographicTrends.weeklyTrend.length - 1].kidPercent}%, {' '}
                          Adults: {demographicTrends.weeklyTrend[demographicTrends.weeklyTrend.length - 1].adultPercent}%, {' '}
                          Elders: {demographicTrends.weeklyTrend[demographicTrends.weeklyTrend.length - 1].elderPercent}%
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div className="no-data">
                <p>No demographic trend data available</p>
                <p className="subtitle">Demographics require distribution records with age group information</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendCharts;

