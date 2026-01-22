#!/bin/bash

# Define variables for easy configuration
KEY_IDENTIFIER="~/.ssh/bartimeo-key.pem"
REMOTE_USER="ubuntu"
REMOTE_IP="52.67.225.143"
REMOTE_PATH="~/reto-pjr/"

echo "🚀 Starting deployment to $REMOTE_IP..."

# 1. Sync local changes to the remote server
# We exclude node_modules, .git, and other local-only files to save time and bandwidth
echo "📦 Syncing files..."
rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude 'dist' \
  -e "ssh -o StrictHostKeyChecking=no -i $KEY_IDENTIFIER" \
  ./ $REMOTE_USER@$REMOTE_IP:$REMOTE_PATH

# 2. Connect to the remote server to install dependencies and restart the app
echo "🔄 Updating dependencies and restarting server..."
ssh -i $KEY_IDENTIFIER $REMOTE_USER@$REMOTE_IP << 'EOF'
    cd reto-pjr
    
    # Install any new dependencies
    pnpm install
    
    # Restart the application managed by PM2
    pm2 restart bartimeo
    
    # Save the PM2 list just in case
    pm2 save
EOF

echo "✅ Deployment complete!"
