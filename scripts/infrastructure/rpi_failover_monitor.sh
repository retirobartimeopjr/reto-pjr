#!/bin/bash
# Script de Failover Automático para la Raspberry Pi
# Este script monitorea la IP de AWS. Si no responde, enciende el túnel de Cloudflare en la Pi.

AWS_IP="54.207.124.4"
AWS_PORT="3000"

# Comprobamos si el servidor AWS responde (Timeout de 5 segundos)
if curl -s -m 5 "http://$AWS_IP:$AWS_PORT" > /dev/null; then
    # AWS ESTÁ VIVO
    # Si el túnel de Cloudflare está encendido en la Pi, lo apagamos para devolverle el tráfico a AWS
    if systemctl is-active --quiet cloudflared; then
        echo "$(date): AWS revivió. Apagando túnel local para ceder control." >> /home/pi/failover.log
        sudo systemctl stop cloudflared
    fi
else
    # AWS ESTÁ CAÍDO
    # Si el túnel de Cloudflare está apagado en la Pi, lo encendemos para tomar el control
    if ! systemctl is-active --quiet cloudflared; then
        echo "$(date): AWS CAÍDO. Encendiendo túnel local para rescate." >> /home/pi/failover.log
        sudo systemctl start cloudflared
    fi
fi
