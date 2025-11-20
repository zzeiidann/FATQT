#!/usr/bin/env python3
"""
Live monitoring test untuk IHSG
"""

import sys
sys.path.append('/Users/mraffyzeidan/Learning/FATQT')

from scrapper import RealTimeScraper
import time

print("=" * 70)
print("🔴 LIVE MONITORING - IHSG")
print("=" * 70)

scraper = RealTimeScraper()
ticker = "^JKSE"

start_time = time.time()
iteration = 0

# Monitor for 30 seconds
while (time.time() - start_time) < 30:
    iteration += 1
    elapsed = time.time() - start_time
    
    print(f"\n[{iteration}] Update at {elapsed:.1f}s:")
    print("-" * 70)
    
    quote = scraper.get_realtime_quote(ticker)
    
    if quote['error'] is None:
        print(f"Ticker:        {quote['ticker']}")
        print(f"Price:         {quote['price']:,.2f}")
        print(f"Change:        {quote['change']:,.2f} ({quote['change_percent']:+.2f}%)")
        print(f"Volume:        {quote['volume']:,}")
        print(f"Day Range:     {quote['low']:,.2f} - {quote['high']:,.2f}")
        print(f"Prev Close:    {quote['previous_close']:,.2f}")
    else:
        print(f"ERROR: {quote['error']}")
    
    # Wait 2 seconds before next update
    time.sleep(2)

print("\n" + "=" * 70)
print("✓ Monitoring complete!")
print("=" * 70)
