---
noteId: "7983d3a0c5f411f0ac92173630901f9a"
tags: []

---

# FATQT - Quick Start Guide

## 🚀 Setup (First Time Only)

```bash
chmod +x setup.sh
./setup.sh
```

## 🎯 Running the Application

### Start Everything (Recommended)
```bash
./start_all.sh
```

Then open your browser to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### Start Services Individually

**Backend only:**
```bash
./start_backend.sh
```

**Frontend only:**
```bash
./start_frontend.sh
```

## 🛑 Stopping the Application

```bash
./stop_all.sh
```

## 📊 Features

- ✅ Real-time stock price monitoring
- ✅ Live WebSocket updates
- ✅ Comprehensive quantitative analysis:
  - Seasonal patterns (monthly, weekly, quarterly, yearly)
  - Day/hour trading patterns
  - Volatility analysis (STD returns, STD volume, Bollinger Bands, ATR)
  - Pattern analysis (consecutive patterns, best/worst times)
- ✅ Interactive charts with Chart.js
- ✅ Dark/Light theme toggle
- ✅ Support for IDX stocks and IHSG index

## 🔧 Manual Testing

### Test Backend API
```bash
# Activate virtual environment
source venv/bin/activate

# Get real-time quote
curl http://localhost:8000/api/realtime/^JKSE

# Get analysis
curl http://localhost:8000/api/analysis/BBCA.JK
```

### Test Scraper
```bash
source venv/bin/activate
python test_api.py
```

## 📁 Project Structure

```
FATQT/
├── backend/           # FastAPI backend
│   ├── analysis/      # Quantitative analysis modules
│   └── main.py        # API server
├── frontend/          # Vanilla JS/HTML/CSS
│   ├── index.html
│   ├── css/
│   └── js/
├── scrapper/          # Yahoo Finance scraper
└── test_api.py        # Scraper testing
```

## 🐛 Troubleshooting

**Port already in use:**
```bash
./stop_all.sh  # Kill existing processes
./start_all.sh # Restart
```

**Backend errors:**
```bash
tail -f backend.log
```

**Frontend errors:**
```bash
tail -f frontend.log
```

## 📝 Notes

- Backend runs on port 8000
- Frontend runs on port 3000
- Logs are saved to `backend.log` and `frontend.log`
- WebSocket updates every 2 seconds
- Analysis uses last 2 years of data by default
