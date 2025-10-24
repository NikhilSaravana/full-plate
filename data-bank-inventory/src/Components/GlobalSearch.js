import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const GlobalSearch = ({ onSearch, placeholder = "Search everything..." }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      // Simulate search results - in real implementation, this would search your data
      const mockResults = [
        { id: 1, type: 'inventory', title: 'Bread', description: 'Grain category - 50 lbs', category: 'GRAIN' },
        { id: 2, type: 'distribution', title: 'Distribution to Family Center', description: 'Dec 15, 2023 - 25 clients', category: 'DISTRIBUTION' },
        { id: 3, type: 'report', title: 'Monthly Report', description: 'December 2023 nutrition report', category: 'REPORT' },
        { id: 4, type: 'inventory', title: 'Milk', description: 'Dairy category - 30 lbs', category: 'DAIRY' },
        { id: 5, type: 'distribution', title: 'Distribution to Community Center', description: 'Dec 14, 2023 - 40 clients', category: 'DISTRIBUTION' }
      ].filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(mockResults);
      setIsOpen(true);
    } else {
      setSearchResults([]);
      setIsOpen(false);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleResultClick(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        break;
    }
  };

  const handleResultClick = (result) => {
    if (onSearch) {
      onSearch(result);
    }
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'inventory': return '📦';
      case 'distribution': return '🚚';
      case 'report': return '📊';
      default: return '📄';
    }
  };

  const getResultColor = (type) => {
    switch (type) {
      case 'inventory': return '#28a745';
      case 'distribution': return '#007bff';
      case 'report': return '#6f42c1';
      default: return '#6c757d';
    }
  };

  return (
    <div className="global-search" ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 2 && setIsOpen(true)}
        />
        <span className="search-icon">🔍</span>
      </div>

      {isOpen && searchResults.length > 0 && (
        <div className="search-results" ref={resultsRef}>
          <div className="search-results-header">
            <span className="results-count">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </span>
            <button 
              className="close-results"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>
          
          {searchResults.map((result, index) => (
            <div
              key={result.id}
              className={`search-result ${selectedIndex === index ? 'selected' : ''}`}
              onClick={() => handleResultClick(result)}
              style={{ borderLeftColor: getResultColor(result.type) }}
            >
              <div className="result-icon">
                {getResultIcon(result.type)}
              </div>
              <div className="result-content">
                <div className="result-title">{result.title}</div>
                <div className="result-description">{result.description}</div>
                <div className="result-category">{result.category}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && searchResults.length === 0 && query.length > 2 && (
        <div className="search-results">
          <div className="no-results">
            <span className="no-results-icon">🔍</span>
            <span>No results found for "{query}"</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
