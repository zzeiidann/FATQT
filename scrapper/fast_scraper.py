"""
Fast Yahoo Finance Scraper - Optimized yfinance wrapper
Faster downloads using threading for multiple tickers
"""

import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional, Union
from datetime import datetime
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings
warnings.filterwarnings('ignore')


class RealTimeScraper:
    """
    Fast Yahoo Finance scraper using threading
    """
    
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
    
    def get_realtime_quote(self, ticker: str) -> Dict:
        """Get real-time quote for single ticker"""
        try:
            tick = yf.Ticker(ticker)
            info = tick.info
            
            return {
                'ticker': ticker,
                'price': info.get('currentPrice') or info.get('regularMarketPrice'),
                'change': info.get('regularMarketChange'),
                'change_percent': info.get('regularMarketChangePercent'),
                'volume': info.get('volume') or info.get('regularMarketVolume'),
                'open': info.get('regularMarketOpen'),
                'high': info.get('regularMarketDayHigh'),
                'low': info.get('regularMarketDayLow'),
                'previous_close': info.get('regularMarketPreviousClose'),
                'market_cap': info.get('marketCap'),
                'error': None
            }
        except Exception as e:
            return {'ticker': ticker, 'error': str(e)}
    
    def get_realtime_quotes(self, tickers: List[str]) -> pd.DataFrame:
        """Get real-time quotes for multiple tickers"""
        results = []
        for ticker in tickers:
            results.append(self.get_realtime_quote(ticker))
        return pd.DataFrame(results)
    
    def _download_single(self, ticker: str, start: str, end: str, interval: str = "1d") -> tuple:
        """Download single ticker"""
        try:
            data = yf.download(ticker, start=start, end=end, interval=interval, 
                             progress=False, auto_adjust=True)
            if len(data) == 0:
                return (ticker, None, "No data")
            return (ticker, data, None)
        except Exception as e:
            return (ticker, None, str(e))
    
    def download(
        self,
        tickers: Union[str, List[str]],
        start: str,
        end: str,
        interval: str = "1d",
        progress: bool = True
    ) -> Union[pd.DataFrame, Dict[str, pd.DataFrame]]:
        """
        Download historical data (threaded for multiple tickers)
        """
        if isinstance(tickers, str):
            tickers = [tickers]
        
        if progress:
            print(f"⚡ Downloading {len(tickers)} ticker(s)...")
        
        start_time = time.time()
        results = {}
        errors = {}
        
        # Use threading for multiple tickers
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_ticker = {
                executor.submit(self._download_single, ticker, start, end, interval): ticker
                for ticker in tickers
            }
            
            for future in as_completed(future_to_ticker):
                ticker, data, error = future.result()
                if error:
                    errors[ticker] = error
                else:
                    results[ticker] = data
        
        elapsed = time.time() - start_time
        
        if progress:
            print(f"✓ Downloaded {len(results)}/{len(tickers)} tickers in {elapsed:.2f}s")
            if len(tickers) > 1:
                print(f"⚡ Speed: {len(tickers)/elapsed:.1f} tickers/sec")
        
        # Return format
        if len(tickers) == 1:
            ticker = tickers[0]
            if ticker in results and results[ticker] is not None:
                return results[ticker]
            return pd.DataFrame()
        else:
            return results


def download_fast(
    tickers: Union[str, List[str]],
    start: str,
    end: str,
    interval: str = "1d",
    progress: bool = True
) -> Union[pd.DataFrame, Dict[str, pd.DataFrame]]:
    """
    Fast download function
    """
    scraper = RealTimeScraper()
    return scraper.download(tickers, start, end, interval, progress)


def get_live_price(ticker: str) -> float:
    """Get live price for single ticker"""
    scraper = RealTimeScraper()
    quote = scraper.get_realtime_quote(ticker)
    price = quote.get('price', 0.0)
    return price if price else 0.0


def get_live_quotes(tickers: List[str]) -> pd.DataFrame:
    """Get live quotes for multiple tickers"""
    scraper = RealTimeScraper()
    return scraper.get_realtime_quotes(tickers)
