"""
Pattern Analysis Module
Analyzes specific day/time patterns for up/down movements
"""

import pandas as pd
import numpy as np
from datetime import datetime, time
from typing import Dict, List, Tuple


class PatternAnalysis:
    """Analyze specific patterns in stock movements"""
    
    def __init__(self, data: pd.DataFrame):
        """
        Initialize with historical price data
        
        Args:
            data: DataFrame with datetime index and OHLCV columns
        """
        self.data = data.copy()
        if 'Date' not in self.data.columns and self.data.index.name == 'Date':
            self.data = self.data.reset_index()
        
        self.data['Date'] = pd.to_datetime(self.data['Date'])
        self.data['Returns'] = self.data['Close'].pct_change()
        self.data['DayOfWeek'] = self.data['Date'].dt.dayofweek
        self.data['Month'] = self.data['Date'].dt.month
        self.data['Hour'] = self.data['Date'].dt.hour
        self.data['DayName'] = self.data['Date'].dt.day_name()
    
    def up_down_patterns_by_day(self) -> Dict:
        """
        Analyze which days tend to go up or down
        
        Returns:
            Dictionary with day-specific patterns
        """
        day_patterns = {}
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        for day_idx, day_name in enumerate(day_names):
            day_data = self.data[self.data['DayOfWeek'] == day_idx]
            
            if len(day_data) > 0:
                up_days = (day_data['Returns'] > 0).sum()
                down_days = (day_data['Returns'] < 0).sum()
                neutral_days = (day_data['Returns'] == 0).sum()
                total_days = len(day_data)
                
                avg_up_return = day_data[day_data['Returns'] > 0]['Returns'].mean() if up_days > 0 else 0
                avg_down_return = day_data[day_data['Returns'] < 0]['Returns'].mean() if down_days > 0 else 0
                
                day_patterns[day_name] = {
                    'up_days': int(up_days),
                    'down_days': int(down_days),
                    'neutral_days': int(neutral_days),
                    'total_days': int(total_days),
                    'up_percentage': round(up_days / total_days * 100, 2),
                    'down_percentage': round(down_days / total_days * 100, 2),
                    'avg_return': round(day_data['Returns'].mean(), 4),
                    'avg_up_return': round(float(avg_up_return), 4),
                    'avg_down_return': round(float(avg_down_return), 4),
                    'tendency': 'Up' if up_days > down_days else 'Down' if down_days > up_days else 'Neutral'
                }
        
        return day_patterns
    
    def hourly_up_down_patterns(self) -> Dict:
        """
        Analyze which hours tend to go up or down
        
        Returns:
            Dictionary with hour-specific patterns
        """
        hourly_patterns = {}
        
        for hour in range(24):
            hour_data = self.data[self.data['Hour'] == hour]
            
            if len(hour_data) > 0:
                up_count = (hour_data['Returns'] > 0).sum()
                down_count = (hour_data['Returns'] < 0).sum()
                total_count = len(hour_data)
                
                avg_up_return = hour_data[hour_data['Returns'] > 0]['Returns'].mean() if up_count > 0 else 0
                avg_down_return = hour_data[hour_data['Returns'] < 0]['Returns'].mean() if down_count > 0 else 0
                
                hourly_patterns[f'{hour:02d}:00'] = {
                    'up_count': int(up_count),
                    'down_count': int(down_count),
                    'total_count': int(total_count),
                    'up_percentage': round(up_count / total_count * 100, 2),
                    'down_percentage': round(down_count / total_count * 100, 2),
                    'avg_return': round(hour_data['Returns'].mean(), 4),
                    'avg_up_return': round(float(avg_up_return), 4),
                    'avg_down_return': round(float(avg_down_return), 4),
                    'tendency': 'Up' if up_count > down_count else 'Down' if down_count > up_count else 'Neutral'
                }
        
        return hourly_patterns
    
    def day_hour_combination_patterns(self) -> Dict:
        """
        Analyze specific day + hour combinations
        
        Returns:
            Dictionary with day-hour specific patterns
        """
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        combination_patterns = {}
        
        for day_idx, day_name in enumerate(day_names):
            combination_patterns[day_name] = {}
            
            for hour in range(24):
                combo_data = self.data[(self.data['DayOfWeek'] == day_idx) & (self.data['Hour'] == hour)]
                
                if len(combo_data) > 0:
                    up_count = (combo_data['Returns'] > 0).sum()
                    down_count = (combo_data['Returns'] < 0).sum()
                    total_count = len(combo_data)
                    
                    combination_patterns[day_name][f'{hour:02d}:00'] = {
                        'up_count': int(up_count),
                        'down_count': int(down_count),
                        'total_count': int(total_count),
                        'up_percentage': round(up_count / total_count * 100, 2) if total_count > 0 else 0,
                        'avg_return': round(combo_data['Returns'].mean(), 4),
                        'tendency': 'Up' if up_count > down_count else 'Down' if down_count > up_count else 'Neutral'
                    }
        
        return combination_patterns
    
    def best_worst_times_to_trade(self, top_n: int = 5) -> Dict:
        """
        Identify best and worst times to trade based on historical returns
        
        Args:
            top_n: Number of top/bottom results to return
            
        Returns:
            Dictionary with best and worst trading times
        """
        # Group by day and hour
        day_hour_returns = self.data.groupby(['DayName', 'Hour']).agg({
            'Returns': ['mean', 'count', 'std'],
            'Volume': 'mean'
        }).reset_index()
        
        day_hour_returns.columns = ['Day', 'Hour', 'AvgReturn', 'Count', 'StdReturn', 'AvgVolume']
        
        # Filter for sufficient data points
        day_hour_returns = day_hour_returns[day_hour_returns['Count'] >= 3]
        
        # Sort by average return
        best_times = day_hour_returns.nlargest(top_n, 'AvgReturn')
        worst_times = day_hour_returns.nsmallest(top_n, 'AvgReturn')
        
        return {
            'best_times': [
                {
                    'day': row['Day'],
                    'hour': f"{int(row['Hour']):02d}:00",
                    'avg_return': round(row['AvgReturn'], 4),
                    'std_return': round(row['StdReturn'], 4),
                    'sample_size': int(row['Count']),
                    'avg_volume': float(row['AvgVolume'])
                }
                for _, row in best_times.iterrows()
            ],
            'worst_times': [
                {
                    'day': row['Day'],
                    'hour': f"{int(row['Hour']):02d}:00",
                    'avg_return': round(row['AvgReturn'], 4),
                    'std_return': round(row['StdReturn'], 4),
                    'sample_size': int(row['Count']),
                    'avg_volume': float(row['AvgVolume'])
                }
                for _, row in worst_times.iterrows()
            ]
        }
    
    def consecutive_patterns(self) -> Dict:
        """
        Analyze consecutive up/down days patterns
        
        Returns:
            Dictionary with consecutive patterns analysis
        """
        # Create up/down labels
        self.data['Direction'] = self.data['Returns'].apply(lambda x: 'Up' if x > 0 else 'Down' if x < 0 else 'Flat')
        
        # Count consecutive patterns
        consecutive_up = 0
        consecutive_down = 0
        max_consecutive_up = 0
        max_consecutive_down = 0
        current_streak = 0
        last_direction = None
        
        for direction in self.data['Direction']:
            if direction == 'Up':
                if last_direction == 'Up':
                    current_streak += 1
                else:
                    current_streak = 1
                max_consecutive_up = max(max_consecutive_up, current_streak)
            elif direction == 'Down':
                if last_direction == 'Down':
                    current_streak += 1
                else:
                    current_streak = 1
                max_consecutive_down = max(max_consecutive_down, current_streak)
            else:
                current_streak = 0
            
            last_direction = direction
        
        # Probability of reversal after N consecutive days
        reversal_probs = {}
        for n in range(1, 6):  # Check up to 5 consecutive days
            # Find instances where we had n consecutive ups
            mask_up = self.data['Direction'].rolling(n).apply(lambda x: all(x == 'Up')).shift(1) == 1
            next_day_up = self.data.loc[mask_up, 'Direction'] == 'Up'
            reversal_probs[f'{n}_consecutive_ups'] = {
                'continues_up': round(float(next_day_up.sum() / len(next_day_up) * 100), 2) if len(next_day_up) > 0 else 0,
                'sample_size': int(len(next_day_up))
            }
            
            # Find instances where we had n consecutive downs
            mask_down = self.data['Direction'].rolling(n).apply(lambda x: all(x == 'Down')).shift(1) == 1
            next_day_up = self.data.loc[mask_down, 'Direction'] == 'Up'
            reversal_probs[f'{n}_consecutive_downs'] = {
                'reverses_up': round(float(next_day_up.sum() / len(next_day_up) * 100), 2) if len(next_day_up) > 0 else 0,
                'sample_size': int(len(next_day_up))
            }
        
        return {
            'max_consecutive_up_days': max_consecutive_up,
            'max_consecutive_down_days': max_consecutive_down,
            'reversal_probabilities': reversal_probs
        }
    
    def get_all_pattern_analysis(self) -> Dict:
        """
        Get comprehensive pattern analysis
        
        Returns:
            Dictionary with all patterns
        """
        return {
            'day_patterns': self.up_down_patterns_by_day(),
            'hourly_patterns': self.hourly_up_down_patterns(),
            'day_hour_combinations': self.day_hour_combination_patterns(),
            'best_worst_times': self.best_worst_times_to_trade(),
            'consecutive_patterns': self.consecutive_patterns()
        }
