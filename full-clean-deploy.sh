#!/bin/bash
# full-clean-deploy.sh - Nuclear option: complete clean and redeploy

set -e

PROJECT_DIR="/workspace/var/www/POD-OCR"
LOG_FILE="/tmp/full-clean-deployment.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================"
log "FULL CLEAN DEPLOYMENT STARTED"
log "========================================"

cd "$PROJECT_DIR" || exit 1

# Stop and delete all PM2 processes
log "Stopping and deleting all PM2 processes..."
pm2 delete all || true
pm2 kill || true

# Kill any remaining node processes
log "Killing all node processes..."
pkill -9 node || true

# Clear all caches and build artifacts
log "Clearing all caches and build artifacts..."
rm -rf .next
rm -rf node_modules
rm -rf .npm
rm -rf ~/.npm
rm -rf package-lock.json

# Pull latest code
log "Pulling latest code..."
git pull origin main || log "Git pull failed or not a git repo"

# Fresh install
log "Fresh npm install..."
npm cache clean --force
npm install

# Build
log "Building application..."
npm run build

# Start with PM2 using ecosystem file
log "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 startup
pm2 save

log "========================================"
log "FULL CLEAN DEPLOYMENT COMPLETED"
log "========================================"

pm2 list
pm2 logs --lines 50