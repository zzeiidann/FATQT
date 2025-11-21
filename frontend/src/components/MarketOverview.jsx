import React from 'react';

const MarketOverview = ({ tickers }) => {
  const indices = tickers.filter(t => t.category === 'Index').slice(0, 3);
  
  return (
    <div className="market-overview">
      <h3 className="market-overview-title">Market Overview</h3>
      <div className="market-cards">
        {indices.map(index => {
          const randomPrice = (Math.random() * 10000 + 5000).toFixed(2);
          const randomChange = (Math.random() * 2 - 1).toFixed(2);
          const isPositive = randomChange >= 0;
          
          return (
            <div key={index.symbol} className="market-card">
              <div className="market-card-header">
                <span className="market-card-symbol">{index.symbol.replace('^', '')}</span>
              </div>
              <div className="market-card-price">{randomPrice}</div>
              <div className={`market-card-change ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '+' : ''}{randomChange}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketOverview;
