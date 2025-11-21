import { useState, useEffect, useMemo, useCallback } from 'react';
import HeroStats from './HeroStats';
import PriceChart from './PriceChart';
import OrderPanel from './OrderPanel';
import PositionsTable from '../../components/PositionsTable';
import TickerSearch from '../../components/TickerSearch';
import { stockAPI as api } from '../../services/api';
import './Trading.css';

function TradingPage({ tickers, marketOpen }) {
  const [currentTicker, setCurrentTicker] = useState('');
  const [quote, setQuote] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [period, setPeriod] = useState('1M');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'dark');

  useEffect(() => {
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (tickers && tickers.length > 0 && !currentTicker) {
      const ihsg = tickers.find(t => t.symbol === '^JKSE');
      setCurrentTicker(ihsg ? ihsg.symbol : tickers[0].symbol);
    }
  }, [tickers]);

  const getDateRange = useCallback((selectedPeriod) => {
    const endDate = new Date();
    const startDate = new Date();
    let interval = '1d';

    switch(selectedPeriod) {
      case '1D':
        startDate.setDate(startDate.getDate() - 5);
        interval = '1d';
        break;
      case '1W':
        startDate.setDate(startDate.getDate() - 7);
        interval = '1d';
        break;
      case '1M':
        startDate.setMonth(startDate.getMonth() - 1);
        interval = '1d';
        break;
      case '3M':
        startDate.setMonth(startDate.getMonth() - 3);
        interval = '1d';
        break;
      case '6M':
        startDate.setMonth(startDate.getMonth() - 6);
        interval = '1d';
        break;
      case '1Y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        interval = '1d';
        break;
      case '5Y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        interval = '1wk';
        break;
      case '10Y':
        startDate.setFullYear(startDate.getFullYear() - 10);
        interval = '1mo';
        break;
      case 'MAX':
        startDate.setFullYear(startDate.getFullYear() - 20);
        interval = '1mo';
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    return { 
      startDate: startDate.toISOString().split('T')[0], 
      endDate: endDate.toISOString().split('T')[0],
      interval 
    };
  }, []);

  const loadStockData = useCallback(async () => {
    if (!currentTicker) return;
    
    try {
      console.log('Loading stock data for:', currentTicker);
      const data = await api.getRealtimeQuote(currentTicker);
      setQuote(data);
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  }, [currentTicker]);

  const loadHistoricalData = useCallback(async () => {
    if (!currentTicker) return;
    
    setLoading(true);
    try {
      console.log('Loading historical data for:', currentTicker, period);
      const { startDate, endDate, interval } = getDateRange(period);
      const response = await api.getHistoricalData(currentTicker, startDate, endDate, interval);
      setHistoricalData(response.data || []);
    } catch (error) {
      console.error('Error loading historical data:', error);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  }, [currentTicker, period, getDateRange]);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  useEffect(() => {
    loadHistoricalData();
  }, [loadHistoricalData]);

  useEffect(() => {
    if (!currentTicker) return;
    
    console.log('Connecting WebSocket for:', currentTicker);
    api.connectWebSocket(currentTicker, (data) => {
      if (data.type === 'quote' && data.data) {
        setQuote(data.data);
      } else if (data.quote) {
        setQuote(data.quote);
      }
    });

    return () => {
      console.log('Disconnecting WebSocket');
      api.disconnectWebSocket();
    };
  }, [currentTicker]);

  const positionsData = useMemo(() => {
    if (!tickers.length) return [];
    const roiTemplates = [8.34, -27.52, 23.28, 13.76, 11.01, -17.43, 3.67];
    const basePrice = quote?.price ?? quote?.current_price ?? quote?.last_price ?? 1000;

    return tickers
      .filter(t => t.symbol !== currentTicker)
      .slice(0, 5)
      .map((stock, idx) => {
        const entry = basePrice * (1 + idx * 0.005);
        const roi = roiTemplates[idx % roiTemplates.length];
        const exit = entry * (1 + roi / 100);
        const pnl = (exit - entry) / entry;
        return {
          id: stock.symbol,
          symbol: stock.symbol,
          currency: 'USDT',
          wager: 0.99 + idx * 0.5,
          entry,
          exit,
          multiplier: idx % 2 === 0 ? 50 : 10,
          pnl,
          roi,
        };
      });
  }, [tickers, quote, currentTicker]);

  const currentPrice = quote?.price ?? quote?.current_price ?? quote?.last_price;
  const currentInfo = tickers.find(t => t.symbol === currentTicker);

  return (
    <div className="trading-page">
      <div className="trading-container">
        <div className="trading-grid">
          <div className="trading-main">
            <HeroStats 
              tickerInfo={currentInfo}
              quote={quote}
              marketOpen={marketOpen}
            />

            <div className="chart-card card">
              <div className="chart-card-header">
                <p className="section-label">Price Performance</p>
              </div>
              <PriceChart 
                historicalData={historicalData}
                period={period}
                onPeriodChange={setPeriod}
                theme={theme}
                quote={quote}
                ticker={currentTicker}
                startDate={getDateRange(period).startDate}
                endDate={getDateRange(period).endDate}
                interval={getDateRange(period).interval}
              />
            </div>
          </div>

          <div className="trading-side">
            <OrderPanel ticker={currentTicker} price={currentPrice} />
          </div>
        </div>

        <div className="positions-section">
          <PositionsTable rows={positionsData} />
        </div>

        <div className="trading-utilities">
          <TickerSearch 
            tickers={tickers} 
            currentTicker={currentTicker}
            onTickerChange={setCurrentTicker}
            onRefresh={loadStockData}
          />
        </div>
      </div>
    </div>
  );
}

export default TradingPage;
