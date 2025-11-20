"""
Volatility Analysis Module
Analyzes volatility metrics including standard deviations
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple


class VolatilityAnalysis:
    """Analyze volatility patterns in stock data"""
    
    def __init__(self, data: pd.DataFrame):
        """
        Initialize with historical price data
        
        Args:
            data: DataFrame with OHLCV columns
        """
        self.data = data.copy()
        if 'Date' not in self.data.columns and self.data.index.name == 'Date':
            self.data = self.data.reset_index()
        
        self.data['Date'] = pd.to_datetime(self.data['Date'])
        self.data['Returns'] = self.data['Close'].pct_change()
        self.data['LogReturns'] = np.log(self.data['Close'] / self.data['Close'].shift(1))
    
    def calculate_std_metrics(self, windows: List[int] = [5, 10, 20, 30, 60]) -> Dict:
        """
        Calculate standard deviation for returns and volume
        
        Args:
            windows: List of rolling window periods
            
        Returns:
            Dictionary with STD metrics
        """
        std_returns = {}
        std_volume = {}
        
        for window in windows:
            std_returns[f'{window}d'] = {
                'current': float(self.data['Returns'].tail(window).std()),
                'mean': float(self.data['Returns'].rolling(window).std().mean()),
                'max': float(self.data['Returns'].rolling(window).std().max()),
                'min': float(self.data['Returns'].rolling(window).std().min())
            }
            
            std_volume[f'{window}d'] = {
                'current': float(self.data['Volume'].tail(window).std()),
                'mean': float(self.data['Volume'].rolling(window).std().mean()),
                'max': float(self.data['Volume'].rolling(window).std().max()),
                'min': float(self.data['Volume'].rolling(window).std().min())
            }
        
        return {
            'std_returns': std_returns,
            'std_volume': std_volume
        }
    
    def historical_volatility(self, windows: List[int] = [10, 20, 30, 60]) -> Dict:
        """
        Calculate annualized historical volatility
        
        Args:
            windows: List of window periods
            
        Returns:
            Dictionary with volatility metrics
        """
        # Annualized volatility (assuming 252 trading days)
        volatility = {}
        
        for window in windows:
            rolling_std = self.data['Returns'].rolling(window).std()
            annualized_vol = rolling_std * np.sqrt(252)
            
            volatility[f'{window}d'] = {
                'current': float(annualized_vol.iloc[-1]) if len(annualized_vol) > 0 else 0,
                'mean': float(annualized_vol.mean()),
                'max': float(annualized_vol.max()),
                'min': float(annualized_vol.min()),
                'percentile_25': float(annualized_vol.quantile(0.25)),
                'percentile_75': float(annualized_vol.quantile(0.75))
            }
        
        return volatility
    
    def intraday_range_analysis(self) -> Dict:
        """
        Analyze daily price ranges (High - Low)
        
        Returns:
            Dictionary with range statistics
        """
        self.data['Range'] = self.data['High'] - self.data['Low']
        self.data['Range_Pct'] = (self.data['Range'] / self.data['Close']) * 100
        
        return {
            'avg_range': float(self.data['Range'].mean()),
            'avg_range_pct': float(self.data['Range_Pct'].mean()),
            'max_range': float(self.data['Range'].max()),
            'max_range_pct': float(self.data['Range_Pct'].max()),
            'min_range': float(self.data['Range'].min()),
            'current_range': float(self.data['Range'].iloc[-1]),
            'current_range_pct': float(self.data['Range_Pct'].iloc[-1]),
            'std_range': float(self.data['Range'].std()),
            'std_range_pct': float(self.data['Range_Pct'].std())
        }
    
    def average_true_range(self, period: int = 14) -> Dict:
        """
        Calculate Average True Range (ATR)
        
        Args:
            period: ATR period (default: 14)
            
        Returns:
            Dictionary with ATR values
        """
        # True Range calculation
        self.data['H-L'] = self.data['High'] - self.data['Low']
        self.data['H-PC'] = abs(self.data['High'] - self.data['Close'].shift(1))
        self.data['L-PC'] = abs(self.data['Low'] - self.data['Close'].shift(1))
        
        self.data['TR'] = self.data[['H-L', 'H-PC', 'L-PC']].max(axis=1)
        self.data['ATR'] = self.data['TR'].rolling(period).mean()
        
        return {
            'period': period,
            'current_atr': float(self.data['ATR'].iloc[-1]),
            'avg_atr': float(self.data['ATR'].mean()),
            'max_atr': float(self.data['ATR'].max()),
            'min_atr': float(self.data['ATR'].min()),
            'atr_pct': float((self.data['ATR'].iloc[-1] / self.data['Close'].iloc[-1]) * 100)
        }
    
    def bollinger_bands(self, period: int = 20, std_dev: int = 2) -> Dict:
        """
        Calculate Bollinger Bands
        
        Args:
            period: Moving average period
            std_dev: Number of standard deviations
            
        Returns:
            Dictionary with Bollinger Band values
        """
        self.data['SMA'] = self.data['Close'].rolling(period).mean()
        self.data['STD'] = self.data['Close'].rolling(period).std()
        
        self.data['BB_Upper'] = self.data['SMA'] + (std_dev * self.data['STD'])
        self.data['BB_Lower'] = self.data['SMA'] - (std_dev * self.data['STD'])
        self.data['BB_Width'] = self.data['BB_Upper'] - self.data['BB_Lower']
        
        current_price = self.data['Close'].iloc[-1]
        bb_upper = self.data['BB_Upper'].iloc[-1]
        bb_lower = self.data['BB_Lower'].iloc[-1]
        bb_middle = self.data['SMA'].iloc[-1]
        
        # Calculate position within bands
        bb_position = ((current_price - bb_lower) / (bb_upper - bb_lower)) * 100 if (bb_upper - bb_lower) != 0 else 50
        
        return {
            'period': period,
            'std_dev': std_dev,
            'upper_band': float(bb_upper),
            'middle_band': float(bb_middle),
            'lower_band': float(bb_lower),
            'current_price': float(current_price),
            'band_width': float(self.data['BB_Width'].iloc[-1]),
            'bb_position': float(bb_position),
            'avg_band_width': float(self.data['BB_Width'].mean())
        }
    
    def volatility_regime(self) -> Dict:
        """
        Identify current volatility regime (Low, Normal, High)
        
        Returns:
            Dictionary with volatility regime classification
        """
        # Calculate 30-day rolling volatility
        rolling_vol = self.data['Returns'].rolling(30).std() * np.sqrt(252)
        
        current_vol = rolling_vol.iloc[-1]
        vol_percentile = (rolling_vol < current_vol).sum() / len(rolling_vol.dropna()) * 100
        
        # Classify regime
        if vol_percentile < 25:
            regime = "Low"
        elif vol_percentile > 75:
            regime = "High"
        else:
            regime = "Normal"
        
        return {
            'current_volatility': float(current_vol),
            'volatility_percentile': float(vol_percentile),
            'regime': regime,
            'avg_volatility': float(rolling_vol.mean()),
            'max_volatility': float(rolling_vol.max()),
            'min_volatility': float(rolling_vol.min())
        }
    
    def get_all_volatility_analysis(self) -> Dict:
        """
        Get comprehensive volatility analysis
        
        Returns:
            Dictionary with all volatility metrics
        """
        return {
            'std_metrics': self.calculate_std_metrics(),
            'historical_volatility': self.historical_volatility(),
            'intraday_range': self.intraday_range_analysis(),
            'atr': self.average_true_range(),
            'bollinger_bands': self.bollinger_bands(),
            'volatility_regime': self.volatility_regime()
        }
