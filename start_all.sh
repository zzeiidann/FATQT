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
