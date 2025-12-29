#!/bin/bash
# restart.sh - Quick restart without rebuild

set -e

echo "Restarting application..."
pm2 restart mpg-ocr-app
pm2 save
echo "Application restarted successfully!"
pm2 list