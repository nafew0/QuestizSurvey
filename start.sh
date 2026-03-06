#!/bin/bash

# Start backend in background
./start_backend.sh &
BACKEND_PID=$!

# Start frontend in background
./start_frontend.sh &
FRONTEND_PID=$!

echo "Backend running on http://localhost:8000"
echo "Frontend running on http://localhost:5555"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
