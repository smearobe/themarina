#!/bin/bash
# Deploy the latest code to Hetzner.
# Usage: ./deploy.sh

set -e

HETZNER_USER="marina"
HETZNER_HOST="5.161.181.165"
APP_DIR="/home/marina/themarina"

echo "→ Pushing code to GitHub..."
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" || echo "(nothing new to commit)"
git push

echo "→ Pulling on Hetzner and restarting..."
ssh "$HETZNER_USER@$HETZNER_HOST" "
  cd $APP_DIR &&
  git pull &&
  npm install --production &&
  sudo systemctl restart themarina
"

echo "✓ Done — https://themarina.smearobe.com"
