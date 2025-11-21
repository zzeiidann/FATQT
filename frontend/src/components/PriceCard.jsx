import React from 'react';

const PriceCard = ({ quote, marketOpen, tickerInfo }) => {
  if (!quote) return null;

  const change = quote.price - quote.previous_close;
  const changePercent = (change / quote.previous_close) * 100;
  const isPositive = change >= 0;

  return (
    <div className="price-card">
      <div className="price-header">
        <div className="ticker-info">
          <span className="ticker-code">{quote.ticker}</span>
          <h1 className="ticker-name">{tickerInfo?.name || quote.ticker}</h1>
        </div>
        <span className={`market-status ${marketOpen ? 'open' : 'closed'}`}>
          {marketOpen ? 'Market Open' : 'Market Closed'}
        </span>
      </div>
      <div className="price-main">
        <div className="price-value">{quote.price?.toFixed(2) || '-'}</div>
        <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
          <span className="change-amount">{isPositive ? '+' : ''}{change.toFixed(2)}</span>
          <span className="change-percent">({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)</span>
        </div>
      </div>
      <div className="price-details">
        <div className="detail-item">
          <span className="detail-label">Open</span>
          <span className="detail-value">{quote.open?.toFixed(2) || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">High</span>
          <span className="detail-value">{quote.high?.toFixed(2) || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Low</span>
          <span className="detail-value">{quote.low?.toFixed(2) || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Volume</span>
          <span className="detail-value">{quote.volume ? (quote.volume / 1000000).toFixed(2) + 'M' : '-'}</span>
        </div>
      </div>
    </div>
  );
};

export default PriceCard;
