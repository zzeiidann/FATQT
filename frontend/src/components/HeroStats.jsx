import React from 'react';

const HeroStats = ({ tickerInfo, quote, marketOpen }) => {
  if (!tickerInfo) {
    return (
      <div className="hero-card">
        <div className="hero-loading">Loading asset...</div>
      </div>
    );
  }

  const price = quote?.price ?? quote?.current_price ?? quote?.last_price ?? quote?.previous_close ?? 0;
  const prevClose = quote?.previous_close ?? price;
  const change = quote?.change ?? price - prevClose;
  const changePercent = quote?.change_percent ?? (prevClose ? (change / prevClose) * 100 : 0);
  const high = quote?.high ?? quote?.day_high ?? prevClose;
  const low = quote?.low ?? quote?.day_low ?? prevClose;
  const volume = quote?.volume ?? quote?.day_volume ?? 0;

  const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);

  const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

  const displaySymbol = tickerInfo.symbol.replace('.JK', '');
  const isPositive = changePercent >= 0;
  const displayName = tickerInfo.name || tickerInfo.symbol;

  return (
    <div className="hero-card">
      <div className="hero-header">
        <div className="hero-symbol-group">
          <div className="hero-symbol-badge">{displayName}</div>
          <div className="hero-name">{displaySymbol}</div>
        </div>
        <div className={`market-badge ${marketOpen ? 'open' : 'closed'}`}>
          <span className="market-badge-dot"></span>
          {marketOpen ? 'Live' : 'Closed'}
        </div>
      </div>

      <div className="hero-price-section">
        <div className="hero-price-main">
          <div className="hero-price-value">{formatCurrency(price)}</div>
          <div className={`hero-change-badge ${isPositive ? 'positive' : 'negative'}`}>
            <span className="change-icon">{isPositive ? '↗' : '↘'}</span>
            <span className="change-value">{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
            <span className="change-amount">({isPositive ? '+' : ''}{formatCurrency(change)})</span>
          </div>
        </div>
      </div>

      <div className="hero-stats-grid">
        <div className="hero-stat-item">
          <div className="stat-label">24h High</div>
          <div className="stat-value positive">{formatCurrency(high)}</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">24h Low</div>
          <div className="stat-value negative">{formatCurrency(low)}</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Prev Close</div>
          <div className="stat-value">{formatCurrency(prevClose)}</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-label">Volume</div>
          <div className="stat-value">{formatNumber(volume)}</div>
        </div>
      </div>
    </div>
  );
};

export default HeroStats;
