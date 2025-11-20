#!/bin/bash

echo "🚀 FATQT Stock Analysis Platform - Setup Script"
echo "================================================"
echo ""

# Check if running from correct directory
if [ ! -f "test_api.py" ]; then
    echo "❌ Error: Please run this script from the FATQT root directory"
    exit 1
fi

# 1. Setup Python Virtual Environment
echo "📦 Step 1: Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# 2. Install Python dependencies
echo ""
echo "📦 Step 2: Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1

# Install scraper dependencies
if [ -f "scrapper/requirements.txt" ]; then
    pip install -r scrapper/requirements.txt
    echo "✅ Scraper dependencies installed"
fi

# Install backend dependencies
if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
    echo "✅ Backend dependencies installed"
fi

# 3. Check if Node.js is installed
echo ""
echo "📦 Step 3: Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version) detected"

# 4. Setup frontend (optional - since it's vanilla JS/HTML)
echo ""
echo "📦 Step 4: Frontend setup..."
echo "✅ Frontend uses vanilla JS/HTML/CSS - no build step needed"

# 5. Create start scripts
echo ""
echo "📦 Step 5: Creating start scripts..."

# Backend start script
cat > start_backend.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
cd backend
echo "🚀 Starting FastAPI backend on http://localhost:8000"
python main.py
EOF
chmod +x start_backend.sh
echo "✅ Created start_backend.sh"

# Frontend start script
cat > start_frontend.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/frontend"
echo "🚀 Starting frontend on http://localhost:3000"
echo "📂 Serving from: $(pwd)"
python3 -m http.server 3000
EOF
chmod +x start_frontend.sh
echo "✅ Created start_frontend.sh"

# Combined start script
cat > start_all.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting FATQT Stock Analysis Platform"
echo "=========================================="
echo ""

# Start backend in background
echo "Starting backend..."
./start_backend.sh > backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID) - logs in backend.log"
echo "   Access at: http://localhost:8000"

# Wait for backend to start
sleep 3

# Start frontend in background
echo ""
echo "Starting frontend..."
./start_frontend.sh > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID) - logs in frontend.log"
echo "   Access at: http://localhost:3000"

echo ""
echo "=========================================="
echo "🎉 FATQT is running!"
echo "=========================================="
echo ""
echo "📊 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "To stop the application, run: ./stop_all.sh"
echo ""

# Save PIDs
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# Keep script running
wait
EOF
chmod +x start_all.sh
echo "✅ Created start_all.sh"

# Stop script
cat > stop_all.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🛑 Stopping FATQT..."

if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    kill $BACKEND_PID 2>/dev/null
    rm .backend.pid
    echo "✅ Backend stopped"
fi

if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    kill $FRONTEND_PID 2>/dev/null
    rm .frontend.pid
    echo "✅ Frontend stopped"
fi

# Kill any remaining processes on these ports
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ All services stopped"
EOF
chmod +x stop_all.sh
echo "✅ Created stop_all.sh"

# 6. Create README
cat > QUICKSTART.md << 'EOF'
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
EOF

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📚 Next steps:"
echo "   1. Run: ./start_all.sh"
echo "   2. Open: http://localhost:3000"
echo "   3. See: QUICKSTART.md for more info"
echo ""
echo "🎉 Happy trading!"
echo ""
