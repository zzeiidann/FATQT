"""
High-Performance Real-Time Yahoo Finance Scraper
Low-latency scraping with async operations and streaming capability
"""

from .fast_scraper import RealTimeScraper, download_fast, get_live_price, get_live_quotes

__version__ = "2.0.0"
__all__ = ["RealTimeScraper", "download_fast", "get_live_price", "get_live_quotes"]
