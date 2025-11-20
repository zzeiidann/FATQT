"""
Intraday Analysis Module
Analyzes intraday patterns (hourly, 6-hour, 12-hour periods)
"""

import pandas as pd
import numpy as np
from datetime import datetime, time
from typing import Dict, List


class IntradayAnalysis:
    """Analyze intraday patterns in stock movements"""
    
    def __init__(self, data: pd.DataFrame):
        """
        Initialize with intraday price data
        
        Args:
            data: DataFrame with datetime index and OHLCV columns
        """
        self.data = data.copy()
        if 'Date' not in self.data.columns and self.data.index.name in ['Date', 'Datetime']:
            self.data = self.data.reset_index()
        
        # Ensure datetime column
        date_col = 'Date' if 'Date' in self.data.columns else 'Datetime'
        self.data[date_col] = pd.to_datetime(self.data[date_col])
        self.data['Hour'] = self.data[date_col].dt.hour
        self.data['DayOfWeek'] = self.data[date_col].dt.dayofweek
        self.data['Returns'] = self.data['Close'].pct_change()
    
    def hourly_patterns(self) -> Dict:
        """
        Analyze hourly patterns across trading day
        
        Returns:
            Dictionary with hourly statistics
        """
        hourly = self.data.groupby('Hour').agg({
            'Returns': ['mean', 'std', 'count'],
            'Volume': ['mean', 'sum'],
            'Close': ['mean', 'min', 'max']
        }).round(4)
        
        # Calculate win rates per hour
        win_rates = {}
        for hour in range(24):
            hour_data = self.data[self.data['Hour'] == hour]
            if len(hour_data) > 0:
                wins = (hour_data['Returns'] > 0).sum()
                total = len(hour_data)
                win_rates[hour] = round(wins / total * 100, 2)
            else:
                win_rates[hour] = 0
        
        # Find most active hours
        avg_volume = hourly[('Volume', 'mean')].sort_values(ascending=False)
        most_active_hours = avg_volume.head(5).index.tolist()
        
        # Best performing hours
        avg_returns = hourly[('Returns', 'mean')]
        best_hours = avg_returns.nlargest(5).index.tolist()
        worst_hours = avg_returns.nsmallest(5).index.tolist()
        
        return {
            'hourly_stats': hourly.to_dict(),
            'win_rates': win_rates,
            'most_active_hours': [int(h) for h in most_active_hours],
            'best_performing_hours': [int(h) for h in best_hours],
            'worst_performing_hours': [int(h) for h in worst_hours]
        }
    
    def period_analysis(self, period_hours: int = 6) -> Dict:
        """
        Analyze patterns by time periods (e.g., 6-hour or 12-hour blocks)
        
        Args:
            period_hours: Number of hours per period (default: 6)
            
        Returns:
            Dictionary with period statistics
        """
        self.data['Period'] = self.data['Hour'] // period_hours
        
        period_stats = self.data.groupby('Period').agg({
            'Returns': ['mean', 'std', 'count'],
            'Volume': ['mean', 'sum'],
            'Close': ['mean', 'min', 'max']
        }).round(4)
        
        # Win rates per period
        win_rates = {}
        period_names = {}
        for period in self.data['Period'].unique():
            period_data = self.data[self.data['Period'] == period]
            start_hour = period * period_hours
            end_hour = start_hour + period_hours - 1
            period_name = f"{start_hour:02d}:00-{end_hour:02d}:59"
            period_names[int(period)] = period_name
            
            if len(period_data) > 0:
                wins = (period_data['Returns'] > 0).sum()
                total = len(period_data)
                win_rates[period_name] = round(wins / total * 100, 2)
            else:
                win_rates[period_name] = 0
        
        return {
            'period_hours': period_hours,
            'period_stats': period_stats.to_dict(),
            'period_names': period_names,
            'win_rates': win_rates
        }
    
    def day_hour_heatmap(self) -> Dict:
        """
        Create day-hour heatmap data showing returns for each day/hour combination
        
        Returns:
            Dictionary with heatmap data
        """
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        # Create pivot table
        heatmap_data = self.data.groupby(['DayOfWeek', 'Hour'])['Returns'].mean().unstack(fill_value=0)
        
        # Convert to dictionary format
        heatmap_dict = {}
        for day in range(7):
            if day in heatmap_data.index:
                heatmap_dict[day_names[day]] = heatmap_data.loc[day].round(4).to_dict()
            else:
                heatmap_dict[day_names[day]] = {}
        
        return {
            'heatmap_data': heatmap_dict,
            'description': 'Average returns by day of week and hour'
        }
    
    def opening_closing_patterns(self) -> Dict:
        """
        Analyze opening and closing hour patterns
        
        Returns:
            Dictionary with open/close statistics
        """
        # Trading hours typically 9:00-16:00 for most markets
        opening_hours = self.data[self.data['Hour'].isin([9, 10])]
        closing_hours = self.data[self.data['Hour'].isin([15, 16])]
        
        opening_stats = {
            'avg_return': float(opening_hours['Returns'].mean()),
            'std_return': float(opening_hours['Returns'].std()),
            'avg_volume': float(opening_hours['Volume'].mean()),
            'win_rate': float((opening_hours['Returns'] > 0).sum() / len(opening_hours) * 100) if len(opening_hours) > 0 else 0
        }
        
        closing_stats = {
            'avg_return': float(closing_hours['Returns'].mean()),
            'std_return': float(closing_hours['Returns'].std()),
            'avg_volume': float(closing_hours['Volume'].mean()),
            'win_rate': float((closing_hours['Returns'] > 0).sum() / len(closing_hours) * 100) if len(closing_hours) > 0 else 0
        }
        
        return {
            'opening_hours': opening_stats,
            'closing_hours': closing_stats
        }
    
    def get_all_intraday_analysis(self, include_6h: bool = True, include_12h: bool = True) -> Dict:
        """
        Get comprehensive intraday analysis
        
        Args:
            include_6h: Include 6-hour period analysis
            include_12h: Include 12-hour period analysis
            
        Returns:
            Dictionary with all intraday patterns
        """
        result = {
            'hourly': self.hourly_patterns(),
            'day_hour_heatmap': self.day_hour_heatmap(),
            'opening_closing': self.opening_closing_patterns()
        }
        
        if include_6h:
            result['period_6h'] = self.period_analysis(period_hours=6)
        
        if include_12h:
            result['period_12h'] = self.period_analysis(period_hours=12)
        
        return result
