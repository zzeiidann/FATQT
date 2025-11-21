import React, { useEffect, useMemo, useRef, useState } from 'react';

const getLogoUrl = (symbol) => {
  const cleanSymbol = symbol.replace('.JK', '');
  return `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.co.id`;
};

const TickerSelector = ({ tickers, currentTicker, onTickerChange, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  const filteredTickers = useMemo(() => {
    if (!searchTerm) return tickers.slice(0, 20);
    return tickers.filter(ticker =>
      ticker.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticker.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 20);
  }, [tickers, searchTerm]);

  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  const toggleSearch = () => {
    setSearchExpanded((prev) => {
      const next = !prev;
      if (!next) {
        setSearchTerm('');
      }
      return next;
    });
  };

  const handleBlur = () => {
    if (!searchTerm.trim()) {
      setSearchExpanded(false);
    }
  };

  return (
    <div className="ticker-selector">
      <div className="ticker-selector-header">
        <div className={`selector-search ${searchExpanded ? 'expanded' : ''}`}>
          <button
            type="button"
            className="search-toggle"
            aria-label={searchExpanded ? 'Collapse search' : 'Expand search'}
            onClick={toggleSearch}
          >
            🔍
          </button>
          {searchExpanded && (
            <input
              ref={searchInputRef}
              type="text"
              className="ticker-search"
              placeholder="Search asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={handleBlur}
            />
          )}
        </div>
        <button onClick={onRefresh} className="refresh-btn" title="Refresh data">
          ↻
        </button>
      </div>

      <div className="ticker-list">
        {filteredTickers.map((ticker) => {
          const isActive = ticker.symbol === currentTicker;
          const displaySymbol = ticker.symbol.replace('.JK', '');
          return (
            <button
              key={ticker.symbol}
              className={`ticker-row ${isActive ? 'active' : ''}`}
              onClick={() => onTickerChange(ticker.symbol)}
            >
              <div className="ticker-logo">
                <img
                  src={getLogoUrl(ticker.symbol)}
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <span className="logo-fallback" style={{ display: 'none' }}>
                  {displaySymbol.charAt(0)}
                </span>
              </div>
              <div className="ticker-meta">
                <span className="ticker-symbol">{displaySymbol}</span>
                <span className="ticker-name">{ticker.name}</span>
              </div>
              <span className="ticker-category">{ticker.category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TickerSelector;
