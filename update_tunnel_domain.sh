#!/bin/bash

# Configuration
KEY_IDENTIFIER="~/.ssh/bartimeo-key.pem"
REMOTE_USER="ubuntu"
REMOTE_IP="52.67.225.143"
NEW_DOMAIN="retirobartimeo.org"
TUNNEL_ID="e331e666-2d4f-4c6c-8fb6-89fc69179cf3"

echo "🚀 Updating Cloudflare Tunnel configuration on $REMOTE_IP..."

ssh -i $KEY_IDENTIFIER $REMOTE_USER@$REMOTE_IP << EOF
    # Backup existing config
    echo "📦 Backing up current configuration..."
    sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.\$(date +%F_%T)

    # Write new configuration
    echo "📝 Writing new configuration for domain: $NEW_DOMAIN"
    sudo tee /etc/cloudflared/config.yml > /dev/null <<EOT
tunnel: $TUNNEL_ID
credentials-file: /home/ubuntu/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $NEW_DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOT

    # Restart service
    echo "🔄 Restarting cloudflared service..."
    sudo systemctl restart cloudflared
    
    # Check status
    echo "✅ Checking service status..."
    if systemctl is-active --quiet cloudflared; then
        echo "Cloudflared is running!"
    else
        echo "⚠️ Cloudflared failed to start. Please check logs."
        exit 1
    fi
EOF

echo "🎉 Server configuration updated!"
echo "⚠️  IMPORTANT: Now go to your Cloudflare Dashboard > DNS and update the CNAME record for '$NEW_DOMAIN'."
echo "   It should point to: $TUNNEL_ID.cfargotunnel.com"
