import React, { useState } from 'react';
import '../../styles/OrderPanel.css';

const presets = [0.25, 0.5, 1, 2];

const OrderPanel = ({ ticker, price }) => {
  const [mode, setMode] = useState('manual');
  const [direction, setDirection] = useState('up');
  const [amount, setAmount] = useState(1);
  const [leverage, setLeverage] = useState(10);

  const handlePreset = (value) => setAmount(value);
  const handleLeverageChange = (e) => setLeverage(Number(e.target.value));

  const handlePlace = () => {
    console.log('Place order', { ticker, mode, direction, amount, leverage });
  };

  return (
    <div className="order-panel">
      <div className="panel-header-tabs">
        <h3 className="panel-title">Order Panel</h3>
        <div className="panel-mode-tabs">
          {['manual', 'auto'].map((tab) => (
            <button
              key={tab}
              className={`mode-tab ${mode === tab ? 'active' : ''}`}
              onClick={() => setMode(tab)}
            >
              {tab === 'manual' ? 'Manual' : 'Auto'}
            </button>
          ))}
        </div>
      </div>

      <div className="order-asset-info">
        <div className="asset-label">Asset</div>
        <div className="asset-details">
          <div className="asset-symbol">{ticker || '—'}</div>
          <div className="asset-price">₹{price ? price.toLocaleString('id-ID') : '0'}</div>
        </div>
      </div>

      <div className="order-direction">
        <div className="direction-label">Direction</div>
        <div className="direction-buttons">
          <button
            className={`direction-btn long ${direction === 'up' ? 'active' : ''}`}
            onClick={() => setDirection('up')}
          >
            <span className="dir-icon">↗</span>
            <span>Long</span>
          </button>
          <button
            className={`direction-btn short ${direction === 'down' ? 'active' : ''}`}
            onClick={() => setDirection('down')}
          >
            <span className="dir-icon">↘</span>
            <span>Short</span>
          </button>
        </div>
      </div>

      <div className="order-field">
        <label className="field-label">Wager Amount (IDR)</label>
        <div className="order-input-wrapper">
          <input
            type="number"
            className="order-input-field"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <div className="preset-buttons">
            {presets.map((p) => (
              <button key={p} className="preset-btn" onClick={() => handlePreset(p)}>{p}x</button>
            ))}
          </div>
        </div>
      </div>

      <div className="order-field">
        <label className="field-label">Leverage <span className="leverage-value">x{leverage}</span></label>
        <div className="leverage-control">
          <input
            type="range"
            className="leverage-slider"
            min="1"
            max="100"
            value={leverage}
            onChange={handleLeverageChange}
          />
          <div className="leverage-marks">
            <span>x1</span>
            <span>x25</span>
            <span>x50</span>
            <span>x100</span>
          </div>
        </div>
      </div>

      <div className="order-summary-box">
        <div className="summary-row">
          <span className="summary-label">Multiplier</span>
          <span className="summary-value">x{(leverage / 10).toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Est. P&L</span>
          <span className={`summary-value ${direction === 'up' ? 'positive' : 'negative'}`}>
            {direction === 'up' ? '+12.8%' : '-12.8%'}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Position Size</span>
          <span className="summary-value">₹{(amount * leverage).toFixed(2)}</span>
        </div>
      </div>

      <button className="place-order-btn" onClick={handlePlace}>
        <span>Place Order</span>
      </button>
    </div>
  );
};

export default OrderPanel;
