import React from 'react';

const PositionsTable = ({ rows }) => {
  if (!rows.length) {
    return (
      <div className="positions-card">
        <div className="panel-header">
          <h3>Active Positions</h3>
        </div>
        <div className="table-empty">No open positions</div>
      </div>
    );
  }

  return (
    <div className="positions-card">
      <div className="positions-header">
        <div className="positions-title-section">
          <h3 className="positions-title">Active Positions</h3>
          <span className="positions-count">{rows.length} open</span>
        </div>
        <div className="positions-tabs">
          <button className="pos-tab active">Active</button>
          <button className="pos-tab">Closed</button>
          <button className="pos-tab">Leaderboard</button>
        </div>
      </div>

      <div className="positions-table">
        <div className="table-header">
          <div className="th">Pair</div>
          <div className="th">Currency</div>
          <div className="th">Wager</div>
          <div className="th">Entry</div>
          <div className="th">Exit</div>
          <div className="th">Leverage</div>
          <div className="th">P&L</div>
          <div className="th">ROI</div>
          <div className="th">Actions</div>
        </div>
        <div className="table-body">
          {rows.map((row) => (
            <div className="table-data-row" key={row.id}>
              <div className="td pair-column">
                <div className="pair-avatar">{row.symbol.charAt(0)}</div>
                <div className="pair-info">
                  <div className="pair-symbol">{row.symbol.replace('.JK', '')}</div>
                  <div className="pair-label">Index</div>
                </div>
              </div>
              <div className="td currency-column">{row.currency}</div>
              <div className="td amount-column">₹{row.wager.toFixed(2)}</div>
              <div className="td price-column">{row.entry.toFixed(2)}</div>
              <div className="td price-column">{row.exit.toFixed(2)}</div>
              <div className="td leverage-column"><span className="leverage-badge">x{row.multiplier}</span></div>
              <div className={`td pnl-column ${row.pnl >= 0 ? 'positive' : 'negative'}`}>
                {row.pnl >= 0 ? '+' : ''}{row.pnl.toFixed(6)}
              </div>
              <div className={`td roi-column ${row.roi >= 0 ? 'positive' : 'negative'}`}>
                <span className="roi-badge">{row.roi >= 0 ? '+' : ''}{row.roi.toFixed(2)}%</span>
              </div>
              <div className="td actions-column">
                <button className="action-btn primary">Cash Out</button>
                <button className="action-btn secondary">Details</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PositionsTable;
