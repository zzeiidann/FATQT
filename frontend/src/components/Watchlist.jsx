import React, { useState, useEffect } from 'react';
import { stockAPI as api } from '../services/api';

const priceFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const formatPrice = (value) => priceFormatter.format(Math.max(value || 0, 0));

const formatPercent = (value = 0) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue >= 0 ? '+' : ''}${safeValue.toFixed(2)}%`;
};

const Watchlist = ({ stocks, onSelectStock, onClose }) => {
  const [watchlistData, setWatchlistData] = useState([]);
  const watchlistSymbols = ['BBRI.JK', 'BBCA.JK', 'BMRI.JK', 'TLKM.JK', 'ASII.JK', 'UNVR.JK', 'ICBP.JK', 'INDF.JK'];

  useEffect(() => {
    loadWatchlistData();
    const interval = setInterval(loadWatchlistData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadWatchlistData = async () => {
    const data = await Promise.all(
      watchlistSymbols.map(async (symbol) => {
        try {
          const quote = await api.getRealtimeQuote(symbol);
          const stock = stocks.find(s => s.symbol === symbol);
          return { ...quote, name: stock?.name || symbol, symbol };
        } catch (error) {
          return null;
        }
      })
    );
    setWatchlistData(data.filter(d => d !== null));
  };

  const getLogoUrl = (symbol) => {
    const cleanSymbol = symbol.replace('.JK', '');
    return `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.co.id`;
  };

  return (
    <div className="watchlist-panel">
      <div className="panel-header">
        <h3>Watchlist</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {watchlistData.length === 0 ? (
        <div className="watchlist-empty">Loading watchlist…</div>
      ) : (
        <div className="watchlist-items">
          {watchlistData.map(stock => {
            const price = stock.price ?? stock.current_price ?? stock.last_price ?? stock.previous_close ?? 0;
            const base = stock.previous_close ?? price;
            const derivedChange = base ? ((price - base) / base) * 100 : 0;
            const changePercent = stock.change_percent ?? derivedChange;
            const isPositive = (changePercent ?? 0) >= 0;
            const ticker = stock.symbol.replace('.JK', '');
            
            return (
              <div 
                key={stock.symbol} 
                className="watchlist-item"
                onClick={() => onSelectStock(stock.symbol)}
              >
                <div className="watchlist-logo-wrap">
                  <img 
                    src={getLogoUrl(stock.symbol)} 
                    alt="" 
                    className="stock-logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="stock-icon fallback-icon" style={{display: 'none'}}>{ticker.charAt(0)}</div>
                </div>
                <div className="stock-info">
                  <div className="stock-symbol-row">
                    <span className="stock-symbol">{ticker}</span>
                    <span className="stock-exchange">{stock.symbol}</span>
                  </div>
                  <div className="stock-name">{stock.name}</div>
                </div>
                <div className="stock-price">
                  <div className="price-value">
                    {formatPrice(price)}
                  </div>
                  <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
                    {formatPercent(changePercent)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
