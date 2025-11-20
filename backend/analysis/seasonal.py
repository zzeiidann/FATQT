"""
Seasonal Analysis Module
Analyzes historical seasonal patterns in stock data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


class SeasonalAnalysis:
    """Analyze seasonal patterns in stock price movements"""
    
    def __init__(self, data: pd.DataFrame):
        """
        Initialize with historical price data
        
        Args:
            data: DataFrame with columns [Date, Open, High, Low, Close, Volume]
        """
        self.data = data.copy()
        if 'Date' not in self.data.columns and self.data.index.name == 'Date':
            self.data = self.data.reset_index()
        
        self.data['Date'] = pd.to_datetime(self.data['Date'])
        self.data['Returns'] = self.data['Close'].pct_change()
        self.data['Month'] = self.data['Date'].dt.month
        self.data['Week'] = self.data['Date'].dt.isocalendar().week
        self.data['DayOfWeek'] = self.data['Date'].dt.dayofweek
        self.data['Year'] = self.data['Date'].dt.year
    
    def monthly_patterns(self) -> Dict:
        """
        Analyze monthly patterns
        
        Returns:
            Dictionary with monthly statistics
        """
        monthly = self.data.groupby('Month').agg({
            'Returns': ['mean', 'std', 'count'],
            'Close': ['mean', 'min', 'max'],
            'Volume': 'mean'
        }).round(4)
        
        # Calculate win rate per month
        win_rates = {}
        for month in range(1, 13):
            month_data = self.data[self.data['Month'] == month]
            if len(month_data) > 0:
                wins = (month_data['Returns'] > 0).sum()
                total = len(month_data)
                win_rates[month] = round(wins / total * 100, 2)
            else:
                win_rates[month] = 0
        
        # Best and worst months
        avg_returns = monthly[('Returns', 'mean')]
        best_month = avg_returns.idxmax()
        worst_month = avg_returns.idxmin()
        
        return {
            'monthly_stats': monthly.to_dict(),
            'win_rates': win_rates,
            'best_month': {
                'month': int(best_month),
                'avg_return': float(avg_returns[best_month]),
                'name': pd.to_datetime(f'2024-{best_month}-01').strftime('%B')
            },
            'worst_month': {
                'month': int(worst_month),
                'avg_return': float(avg_returns[worst_month]),
                'name': pd.to_datetime(f'2024-{worst_month}-01').strftime('%B')
            }
        }
    
    def weekly_patterns(self) -> Dict:
        """
        Analyze weekly patterns (day of week)
        
        Returns:
            Dictionary with weekly statistics
        """
        weekly = self.data.groupby('DayOfWeek').agg({
            'Returns': ['mean', 'std', 'count'],
            'Close': ['mean', 'min', 'max'],
            'Volume': 'mean'
        }).round(4)
        
        # Calculate win rate per day
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        win_rates = {}
        for day in range(7):
            day_data = self.data[self.data['DayOfWeek'] == day]
            if len(day_data) > 0:
                wins = (day_data['Returns'] > 0).sum()
                total = len(day_data)
                win_rates[day_names[day]] = round(wins / total * 100, 2)
            else:
                win_rates[day_names[day]] = 0
        
        # Best and worst days
        avg_returns = weekly[('Returns', 'mean')]
        best_day = avg_returns.idxmax()
        worst_day = avg_returns.idxmin()
        
        return {
            'weekly_stats': weekly.to_dict(),
            'win_rates': win_rates,
            'best_day': {
                'day': day_names[best_day],
                'avg_return': float(avg_returns[best_day])
            },
            'worst_day': {
                'day': day_names[worst_day],
                'avg_return': float(avg_returns[worst_day])
            }
        }
    
    def yearly_seasonality(self) -> Dict:
        """
        Analyze year-over-year patterns
        
        Returns:
            Dictionary with yearly statistics
        """
        yearly = self.data.groupby('Year').agg({
            'Returns': ['mean', 'std', 'sum'],
            'Close': ['first', 'last', 'min', 'max'],
            'Volume': 'mean'
        }).round(4)
        
        # Calculate annual returns
        annual_returns = {}
        for year in self.data['Year'].unique():
            year_data = self.data[self.data['Year'] == year]
            if len(year_data) > 0:
                first_close = year_data.iloc[0]['Close']
                last_close = year_data.iloc[-1]['Close']
                annual_return = ((last_close - first_close) / first_close) * 100
                annual_returns[int(year)] = round(annual_return, 2)
        
        return {
            'yearly_stats': yearly.to_dict(),
            'annual_returns': annual_returns,
            'total_years': len(self.data['Year'].unique()),
            'avg_annual_return': round(np.mean(list(annual_returns.values())), 2)
        }
    
    def quarter_patterns(self) -> Dict:
        """
        Analyze quarterly patterns (Q1, Q2, Q3, Q4)
        
        Returns:
            Dictionary with quarterly statistics
        """
        self.data['Quarter'] = self.data['Date'].dt.quarter
        
        quarterly = self.data.groupby('Quarter').agg({
            'Returns': ['mean', 'std', 'count'],
            'Close': ['mean', 'min', 'max'],
            'Volume': 'mean'
        }).round(4)
        
        # Win rates per quarter
        win_rates = {}
        for q in range(1, 5):
            q_data = self.data[self.data['Quarter'] == q]
            if len(q_data) > 0:
                wins = (q_data['Returns'] > 0).sum()
                total = len(q_data)
                win_rates[f'Q{q}'] = round(wins / total * 100, 2)
            else:
                win_rates[f'Q{q}'] = 0
        
        avg_returns = quarterly[('Returns', 'mean')]
        best_quarter = avg_returns.idxmax()
        worst_quarter = avg_returns.idxmin()
        
        return {
            'quarterly_stats': quarterly.to_dict(),
            'win_rates': win_rates,
            'best_quarter': {
                'quarter': f'Q{best_quarter}',
                'avg_return': float(avg_returns[best_quarter])
            },
            'worst_quarter': {
                'quarter': f'Q{worst_quarter}',
                'avg_return': float(avg_returns[worst_quarter])
            }
        }
    
    def get_all_seasonal_analysis(self) -> Dict:
        """
        Get comprehensive seasonal analysis
        
        Returns:
            Dictionary with all seasonal patterns
        """
        return {
            'monthly': self.monthly_patterns(),
            'weekly': self.weekly_patterns(),
            'yearly': self.yearly_seasonality(),
            'quarterly': self.quarter_patterns()
        }
