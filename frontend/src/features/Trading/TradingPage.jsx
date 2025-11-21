import { useState, useEffect, useMemo, useCallback } from 'react';
import HeroStats from './HeroStats';
import PriceChart from './PriceChart';
import OrderPanel from './OrderPanel';
import PositionsTable from '../../components/PositionsTable';
import TickerSearch from '../../components/TickerSearch';
import { stockAPI as api } from '../../services/api';
import './Trading.css';

function TradingPage({ tickers, marketOpen }) {
  // Load saved ticker from localStorage
  const [currentTicker, setCurrentTicker] = useState(() => {
    return localStorage.getItem('selectedTicker') || '';
  });
  const [quote, setQuote] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [period, setPeriod] = useState('1M');
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'dark');

  // Persist ticker to localStorage whenever it changes
  useEffect(() => {
    if (currentTicker) {
      localStorage.setItem('selectedTicker', currentTicker);
    }
  }, [currentTicker]);

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
      // Try to use saved ticker if it exists in the list
      const savedTicker = localStorage.getItem('selectedTicker');
      if (savedTicker && tickers.find(t => t.symbol === savedTicker)) {
        setCurrentTicker(savedTicker);
      } else {
        // Fall back to ^JKSE or first ticker
        const ihsg = tickers.find(t => t.symbol === '^JKSE');
        setCurrentTicker(ihsg ? ihsg.symbol : tickers[0].symbol);
      }
    }
  }, [tickers, currentTicker]);

  // Auto-set interval based on period
  // useEffect(() => {
  //   if (period === '1D') {
  //     setInterval('15m'); // Changed from 5m to 15m for more reliable data
  //   } else if (period === '1W') {
  //     setInterval('1d');
  //   } else {
  //     setInterval('1d');
  //   }
  // }, [period]);
  useEffect(() => {
      if (period === '1D') {
        setInterval('1m');      // default intraday 1D
      } else if (period === '1W') {
        setInterval('5m');
      } else {
        setInterval('1d');
      }
    }, [period]);

  const getDateRange = useCallback((selectedPeriod, customInterval = null) => {
    const now = new Date();

    // yfinance: end itu EKSKLUSIF → pakai BESOK supaya hari ini ikut ke-fetch
    const yfEnd = new Date(now);
    yfEnd.setDate(yfEnd.getDate() + 1);

    const startDate = new Date(now);
    let intervalToUse = customInterval || '1d';

    // Yahoo Finance intraday limits:
    // 1m = 7 days, 2m/5m/15m/30m = 60 days, 60m/90m = 730 days
    if (!customInterval) {
      if (selectedPeriod === '1D') {
        intervalToUse = '1m'; // default 1D pakai 1 menit
      } else if (selectedPeriod === '1W') {
        intervalToUse = '5m';
      } else {
        intervalToUse = '1d';
      }
    }

    switch (selectedPeriod) {
      case '1D':
        // ambil 5 hari ke belakang (safe untuk limit 1m=7d)
        startDate.setDate(startDate.getDate() - 5);
        break;
      case '1W':
        // ambil 10 hari ke belakang untuk 1W
        startDate.setDate(startDate.getDate() - 10);
        break;
      case '1M':
        // 1M: tetap jaga di < 60 hari kalau pakai intraday
        if (['1m', '2m', '5m', '15m', '30m'].includes(intervalToUse)) {
          startDate.setDate(startDate.getDate() - 30);
        } else {
          startDate.setMonth(startDate.getMonth() - 1);
        }
        break;
      case '3M':
        startDate.setMonth(startDate.getMonth() - 3);
        intervalToUse = '1d';
        break;
      case '6M':
        startDate.setMonth(startDate.getMonth() - 6);
        intervalToUse = '1d';
        break;
      case '1Y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        intervalToUse = '1d';
        break;
      case '5Y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        intervalToUse = '1wk';
        break;
      case '10Y':
        startDate.setFullYear(startDate.getFullYear() - 10);
        intervalToUse = '1mo';
        break;
      case 'MAX':
        startDate.setFullYear(startDate.getFullYear() - 20);
        intervalToUse = '1mo';
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
        intervalToUse = '1d';
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: yfEnd.toISOString().split('T')[0],   // <<< beda di sini: pakai BESOK
      interval: intervalToUse,
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
      console.log('[TradingPage] Loading historical data:', { ticker: currentTicker, period, interval });
      const { startDate, endDate } = getDateRange(period, interval);
      console.log('[TradingPage] Date range:', { startDate, endDate, interval });
      const response = await api.getHistoricalData(currentTicker, startDate, endDate, interval);
      console.log('[TradingPage] Received', response.data?.length || 0, 'data points');
      setHistoricalData(response.data || []);
    } catch (error) {
      console.error('[TradingPage] Error loading historical data:', error);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  }, [currentTicker, period, interval, getDateRange]);

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
                interval={interval}
                onIntervalChange={setInterval}
                theme={theme}
                quote={quote}
                ticker={currentTicker}
                startDate={getDateRange(period, interval).startDate}
                endDate={getDateRange(period, interval).endDate}
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
