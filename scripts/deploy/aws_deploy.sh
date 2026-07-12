#!/bin/bash

# Define variables for easy configuration
KEY_IDENTIFIER="~/.ssh/bartimeo-key.pem"
REMOTE_USER="ubuntu"
REMOTE_IP="54.207.124.4"
REMOTE_PATH="~/reto-pjr/"

echo "🚀 Starting deployment to $REMOTE_IP..."

# 1. Sync local changes to the remote server
# We exclude node_modules, .git, and other local-only files to save time and bandwidth
echo "📦 Syncing files..."
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude 'dist' \
  -e "ssh -o StrictHostKeyChecking=no -i $KEY_IDENTIFIER" \
  "$PROJECT_ROOT/" $REMOTE_USER@$REMOTE_IP:$REMOTE_PATH

# 2. Connect to the remote server to install dependencies and restart the app
echo "🔄 Updating dependencies and restarting server..."
ssh -i $KEY_IDENTIFIER $REMOTE_USER@$REMOTE_IP << 'EOF'
    cd reto-pjr
    
    # Install any new dependencies
    pnpm install
    
    # Build the application for production
    echo "🏗️ Building the application..."
    pnpm run build
    
    # Copy service account key to dist folder so it can be found by the server
    echo "🔑 Copying service account key..."
    cp serviceAccountKey.json dist/
    
    # Restart the application using ecosystem config
    echo "🚀 Restarting PM2 Cluster..."
    # Check if process exists to decide whether to start or reload
    if pm2 list | grep -q "bartimeo"; then
        pm2 reload ecosystem.config.cjs --update-env
    else
        pm2 start ecosystem.config.cjs
    fi
    
    # Save the PM2 list
    pm2 save

    # Recargar configuración de Nginx
    echo "🌐 Reloading Nginx configuration..."
    sudo nginx -s reload
EOF

echo "✅ Deployment complete!"
