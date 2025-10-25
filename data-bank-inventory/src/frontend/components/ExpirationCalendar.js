import React, { useState } from 'react';
import { useLanguage } from '../../backend/contexts/LanguageContext';

const ExpirationCalendar = ({ detailedInventory }) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Extract and organize items by expiration
  const organizeItemsByExpiration = () => {
    const items = [];
    const now = new Date();

    Object.entries(detailedInventory || {}).forEach(([category, data]) => {
      if (!data || !data.items) return;

      data.items.forEach(item => {
        if (item.expiration && item.expiration !== 'N/A') {
          const expDate = new Date(item.expiration);
          const daysUntilExpiry = Math.floor((expDate - now) / (1000 * 60 * 60 * 24));

          items.push({
            ...item,
            category,
            expDate,
            daysUntilExpiry,
            expired: daysUntilExpiry < 0
          });
        }
      });
    });

    return items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  };

  const allItems = organizeItemsByExpiration();
  
  // Filter by category if selected
  const filteredItems = filterCategory === 'ALL' ? 
    allItems : 
    allItems.filter(item => item.category === filterCategory);

  // Group items by time period
  const groupedItems = {
    expired: filteredItems.filter(item => item.daysUntilExpiry < 0),
    thisWeek: filteredItems.filter(item => item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 7),
    nextWeek: filteredItems.filter(item => item.daysUntilExpiry > 7 && item.daysUntilExpiry <= 14),
    thisMonth: filteredItems.filter(item => item.daysUntilExpiry > 14 && item.daysUntilExpiry <= 30),
    beyond: filteredItems.filter(item => item.daysUntilExpiry > 30)
  };

  const getUrgencyClass = (daysUntilExpiry) => {
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 3) return 'critical';
    if (daysUntilExpiry <= 7) return 'warning';
    if (daysUntilExpiry <= 14) return 'caution';
    return 'normal';
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const categories = ['ALL', ...new Set(Object.keys(detailedInventory || {}))];

  if (allItems.length === 0) {
    return (
      <div className="expiration-calendar">
        <h3>Expiration Timeline</h3>
        <div className="no-data">
          <p>No items with expiration dates tracked</p>
          <p className="subtitle">Add expiration dates to items in detailed inventory tracking to see them here</p>
        </div>
      </div>
    );
  }

  const totalAtRisk = groupedItems.expired.length + groupedItems.thisWeek.length;

  return (
    <div className="expiration-calendar">
      <div className="section-header-with-controls">
        <div>
          <h3>Expiration Timeline</h3>
          <p className="section-subtitle">
            Tracking {filteredItems.length} items with expiration dates
          </p>
        </div>
        
        <div className="calendar-controls">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="category-filter"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="view-mode-toggle">
            <button 
              className={`btn-toggle ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              📅 Timeline
            </button>
            <button 
              className={`btn-toggle ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {totalAtRisk > 0 && (
        <div className="expiration-alert-banner">
          <strong>ATTENTION:</strong> {totalAtRisk} item(s) expired or expiring within 7 days - prioritize for distribution!
        </div>
      )}

      {viewMode === 'timeline' ? (
        <div className="timeline-view">
          {/* Expired Items */}
          {groupedItems.expired.length > 0 && (
            <div className="timeline-section expired-section">
              <div className="timeline-header">
                <h4>🚨 Expired ({groupedItems.expired.length})</h4>
                <span className="priority-badge critical">REMOVE IMMEDIATELY</span>
              </div>
              <div className="timeline-items">
                {groupedItems.expired.map((item, index) => (
                  <div key={index} className="expiration-item expired">
                    <div className="item-icon">❌</div>
                    <div className="item-details">
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">
                        <span className="item-category">{item.category}</span>
                        <span className="item-weight">{Math.round(item.weight)} lbs</span>
                        <span className="item-expiry">Expired: {formatDate(item.expDate)}</span>
                      </div>
                    </div>
                    <div className="item-days critical">
                      {Math.abs(item.daysUntilExpiry)} days ago
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This Week */}
          {groupedItems.thisWeek.length > 0 && (
            <div className="timeline-section thisweek-section">
              <div className="timeline-header">
                <h4>This Week (0-7 days) ({groupedItems.thisWeek.length})</h4>
                <span className="priority-badge high">HIGH PRIORITY</span>
              </div>
              <div className="timeline-items">
                {groupedItems.thisWeek.map((item, index) => (
                  <div key={index} className={`expiration-item ${getUrgencyClass(item.daysUntilExpiry)}`}>
                    <div className={`item-status-indicator ${getUrgencyClass(item.daysUntilExpiry)}`}></div>
                    <div className="item-details">
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">
                        <span className="item-category">{item.category}</span>
                        <span className="item-weight">{Math.round(item.weight)} lbs</span>
                        <span className="item-expiry">Expires: {formatDate(item.expDate)}</span>
                      </div>
                    </div>
                    <div className={`item-days ${getUrgencyClass(item.daysUntilExpiry)}`}>
                      {item.daysUntilExpiry} days
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Week */}
          {groupedItems.nextWeek.length > 0 && (
            <div className="timeline-section nextweek-section">
              <div className="timeline-header">
                <h4>📦 Next Week (8-14 days) ({groupedItems.nextWeek.length})</h4>
                <span className="priority-badge medium">PLAN DISTRIBUTION</span>
              </div>
              <div className="timeline-items">
                {groupedItems.nextWeek.map((item, index) => (
                  <div key={index} className={`expiration-item ${getUrgencyClass(item.daysUntilExpiry)}`}>
                    <div className="item-icon">📅</div>
                    <div className="item-details">
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">
                        <span className="item-category">{item.category}</span>
                        <span className="item-weight">{Math.round(item.weight)} lbs</span>
                        <span className="item-expiry">Expires: {formatDate(item.expDate)}</span>
                      </div>
                    </div>
                    <div className={`item-days ${getUrgencyClass(item.daysUntilExpiry)}`}>
                      {item.daysUntilExpiry} days
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This Month */}
          {groupedItems.thisMonth.length > 0 && (
            <div className="timeline-section thismonth-section">
              <div className="timeline-header">
                <h4>📊 This Month (15-30 days) ({groupedItems.thisMonth.length})</h4>
                <span className="priority-badge low">MONITOR</span>
              </div>
              <div className="timeline-items">
                {groupedItems.thisMonth.slice(0, 10).map((item, index) => (
                  <div key={index} className={`expiration-item ${getUrgencyClass(item.daysUntilExpiry)}`}>
                    <div className="item-icon">📋</div>
                    <div className="item-details">
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">
                        <span className="item-category">{item.category}</span>
                        <span className="item-weight">{Math.round(item.weight)} lbs</span>
                        <span className="item-expiry">Expires: {formatDate(item.expDate)}</span>
                      </div>
                    </div>
                    <div className={`item-days ${getUrgencyClass(item.daysUntilExpiry)}`}>
                      {item.daysUntilExpiry} days
                    </div>
                  </div>
                ))}
                {groupedItems.thisMonth.length > 10 && (
                  <div className="show-more">
                    + {groupedItems.thisMonth.length - 10} more items
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Beyond 30 Days */}
          {groupedItems.beyond.length > 0 && (
            <div className="timeline-section beyond-section">
              <div className="timeline-header">
                <h4>Beyond 30 Days ({groupedItems.beyond.length})</h4>
                <span className="priority-badge normal">GOOD CONDITION</span>
              </div>
              <div className="summary-note">
                {groupedItems.beyond.length} items with longer shelf life (details hidden for clarity)
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="list-view">
          <table className="expiration-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Weight</th>
                <th>Expiration Date</th>
                <th>Days Remaining</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={index} className={`row-${getUrgencyClass(item.daysUntilExpiry)}`}>
                  <td className="status-cell">
                    <span className={`status-indicator ${getUrgencyClass(item.daysUntilExpiry)}`}></span>
                  </td>
                  <td className="item-name-cell">{item.name}</td>
                  <td>{item.category}</td>
                  <td>{Math.round(item.weight)} lbs</td>
                  <td>{formatDate(item.expDate)}</td>
                  <td className={`days-cell ${getUrgencyClass(item.daysUntilExpiry)}`}>
                    {item.expired ? `${Math.abs(item.daysUntilExpiry)} days ago` : `${item.daysUntilExpiry} days`}
                  </td>
                  <td>
                    {item.daysUntilExpiry < 0 && <span className="priority-badge critical">EXPIRED</span>}
                    {item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 7 && <span className="priority-badge high">HIGH</span>}
                    {item.daysUntilExpiry > 7 && item.daysUntilExpiry <= 14 && <span className="priority-badge medium">MEDIUM</span>}
                    {item.daysUntilExpiry > 14 && <span className="priority-badge low">LOW</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="expiration-summary">
        <h4>Distribution Priority Summary</h4>
        <ol className="priority-list">
          <li><strong>Remove immediately:</strong> {groupedItems.expired.length} expired item(s)</li>
          <li><strong>Distribute this week:</strong> {groupedItems.thisWeek.length} item(s) expiring in 0-7 days</li>
          <li><strong>Plan for next week:</strong> {groupedItems.nextWeek.length} item(s) expiring in 8-14 days</li>
          <li><strong>Monitor:</strong> {groupedItems.thisMonth.length} item(s) expiring in 15-30 days</li>
        </ol>
      </div>
    </div>
  );
};

export default ExpirationCalendar;

