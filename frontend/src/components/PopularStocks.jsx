import React, { useState, useEffect } from 'react';
import { stockAPI as api } from '../services/api';

const PopularStocks = ({ stocks, onSelectStock }) => {
  const categories = ['Top Gainers', 'Top Losers', 'Most Active'];
  const [activeCategory, setActiveCategory] = useState('Top Gainers');
  const [marketData, setMarketData] = useState([]);

  useEffect(() => {
    loadMarketData();
    const interval = setInterval(loadMarketData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadMarketData = async () => {
    const majorStocks = ['BBRI.JK', 'BBCA.JK', 'BMRI.JK', 'TLKM.JK', 'ASII.JK', 'UNVR.JK', 'GOTO.JK', 'ICBP.JK', 'INDF.JK', 'KLBF.JK'];
    const data = await Promise.all(
      majorStocks.map(async (symbol) => {
        try {
          const quote = await api.getRealtimeQuote(symbol);
          const stock = stocks.find(s => s.symbol === symbol);
          return { ...quote, name: stock?.name || symbol, symbol };
        } catch (error) {
          return null;
        }
      })
    );
    setMarketData(data.filter(d => d !== null));
  };

  const getFilteredStocks = () => {
    let filtered = [...marketData];
    if (activeCategory === 'Top Gainers') {
      filtered.sort((a, b) => (b.change_percent || 0) - (a.change_percent || 0));
    } else if (activeCategory === 'Top Losers') {
      filtered.sort((a, b) => (a.change_percent || 0) - (b.change_percent || 0));
    } else {
      filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    }
    return filtered.slice(0, 5);
  };

  const getLogoUrl = (symbol) => {
    const cleanSymbol = symbol.replace('.JK', '');
    return `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.co.id`;
  };

  const displayStocks = getFilteredStocks();

  return (
    <div className="popular-stocks-bottom">
      <div className="section-header">
        <h2>Market Movers</h2>
        <div className="category-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="movers-grid">
        {displayStocks.map((stock, index) => {
          const isPositive = (stock.change_percent || 0) >= 0;
          
          return (
            <div
              key={stock.symbol}
              className="mover-card"
              onClick={() => onSelectStock(stock.symbol)}
            >
              <div className="mover-header">
                <div className="mover-logo-container">
                  <img 
                    src={getLogoUrl(stock.symbol)} 
                    alt="" 
                    className="mover-logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="mover-icon" style={{display: 'none'}}>{stock.symbol.charAt(0)}</div>
                </div>
                <div className="mover-info">
                  <div className="mover-symbol">{stock.symbol.replace('.JK', '')}</div>
                  <div className="mover-name">{stock.name}</div>
                </div>
                <div className="mover-rank">#{index + 1}</div>
              </div>
              <div className="mover-stats">
                <div className="mover-price">{stock.current_price?.toFixed(2) || '0.00'}</div>
                <div className={`mover-change ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}{stock.change_percent?.toFixed(2) || '0.00'}%
                </div>
              </div>
              <div className="mover-volume">
                Vol: {((stock.volume || 0) / 1000000).toFixed(2)}M
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PopularStocks;
