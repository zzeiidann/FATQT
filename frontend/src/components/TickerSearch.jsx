import React, { useEffect, useMemo, useRef, useState } from 'react';

const getLogoUrl = (symbol) => {
  const cleanSymbol = symbol.replace('.JK', '');
  return `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.co.id`;
};

const TickerSearch = ({ tickers, currentTicker, onTickerChange, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef(null);
  const modalRef = useRef(null);

  const filteredTickers = useMemo(() => {
    if (!searchTerm) return tickers.slice(0, 30);
    return tickers.filter(ticker =>
      ticker.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticker.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 30);
  }, [tickers, searchTerm]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleTickerSelect = (ticker) => {
    onTickerChange(ticker);
    setIsOpen(false);
    setSearchTerm('');
  };

  const currentInfo = tickers.find(t => t.symbol === currentTicker);
  const displaySymbol = currentInfo ? currentInfo.symbol.replace('.JK', '') : '';

  return (
    <>
      {/* Floating Search Bubble */}
      <button
        className="search-bubble"
        onClick={() => setIsOpen(!isOpen)}
        title="Search Assets"
      >
        <svg className="bubble-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <span className="bubble-text">{displaySymbol || 'Search'}</span>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="search-modal-overlay">
          <div className="search-modal" ref={modalRef}>
            <div className="search-modal-header">
              <h3 className="search-modal-title">Search Assets</h3>
              <button
                className="search-modal-close"
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="search-modal-input-wrapper">
              <svg className="search-modal-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-modal-input"
                placeholder="Search by symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button onClick={onRefresh} className="search-modal-refresh" title="Refresh data">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
            </div>

            <div className="search-modal-list">
              {filteredTickers.map((ticker) => {
                const isActive = ticker.symbol === currentTicker;
                const displaySym = ticker.symbol.replace('.JK', '');
                return (
                  <button
                    key={ticker.symbol}
                    className={`search-modal-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleTickerSelect(ticker.symbol)}
                  >
                    <div className="search-item-logo">
                      <img
                        src={getLogoUrl(ticker.symbol)}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <span className="search-item-fallback" style={{ display: 'none' }}>
                        {displaySym.charAt(0)}
                      </span>
                    </div>
                    <div className="search-item-meta">
                      <span className="search-item-symbol">{ticker.name}</span>
                      <span className="search-item-name">{displaySym}</span>
                    </div>
                    <span className="search-item-category">{ticker.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TickerSearch;
