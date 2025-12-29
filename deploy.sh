#!/bin/bash
# deploy.sh - Main deployment script for RunPod

set -e  # Exit on any error

echo "========================================"
echo "Starting Deployment Process"
echo "Time: $(date)"
echo "========================================"

# Define your project directory (update this path)
PROJECT_DIR="/workspace/var/www/POD-OCR"
LOG_FILE="/tmp/deployment.log"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Navigate to project directory
log "Navigating to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR" || exit 1

# Pull latest code from git (if applicable)
log "Pulling latest code from git..."
git pull origin main || log "Git pull failed or not a git repo"

# Stop existing processes
log "Stopping existing PM2 processes..."
pm2 stop ecosystem.config.js || log "No PM2 processes to stop"

# Clear old build artifacts
log "Clearing old build artifacts..."
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies
log "Installing dependencies..."
npm install --production=false

# Run the build
log "Building the application..."
npm run build

# Check if build was successful
if [ -d ".next" ]; then
    log "Build successful! .next directory created"
else
    log "ERROR: Build failed! .next directory not found"
    exit 1
fi

# Start the application with PM2 using ecosystem file
log "Starting the application with ecosystem.config.js..."
pm2 start ecosystem.config.js
pm2 save

# Display PM2 status
log "PM2 Process Status:"
pm2 list

echo "========================================"
echo "Deployment Completed Successfully!"
echo "Time: $(date)"
echo "========================================"

# Display logs location
log "Deployment logs saved to: $LOG_FILE"
log "To view PM2 logs: pm2 logs pod-ocr-app"
log "To view cron logs: pm2 logs pod-ocr-cron"