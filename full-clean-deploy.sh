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
sleep 3

# Kill any remaining node processes
log "Killing all node processes..."
pkill -9 node || true
sleep 2

# Clear all caches and build artifacts
log "Clearing all caches and build artifacts..."
rm -rf .next
rm -rf node_modules
rm -rf .npm
rm -rf ~/.npm
rm -rf package-lock.json
rm -rf /tmp/next-*  # Clear Next.js temp files
rm -rf /root/.cache  # Clear system cache

# Pull latest code
log "Pulling latest code..."
git pull origin main || log "Git pull failed or not a git repo"

# Fresh install
log "Fresh npm install..."
npm cache clean --force
npm install --force

# Build with fresh cache
log "Building application..."
rm -rf .next  # Extra safety
NODE_ENV=production npm run build

# Verify build
log "Verifying build..."
if [ ! -d ".next" ]; then
    log "ERROR: Build failed - .next directory not created"
    exit 1
fi

# Start with PM2 using ecosystem file
log "Starting application with PM2..."
pm2 start ecosystem.config.js
sleep 5

# Wait for app to be ready
log "Waiting for application to be ready..."
for i in {1..10}; do
    if pm2 jlist | grep -q "online"; then
        log "Application is online"
        break
    fi
    sleep 2
done

pm2 startup
pm2 save

log "========================================"
log "FULL CLEAN DEPLOYMENT COMPLETED"
log "========================================"
log "Build ID: $(date +%s)"
log "Next.js Build: $(cat .next/BUILD_ID 2>/dev/null || echo 'N/A')"

pm2 list
pm2 logs --lines 50