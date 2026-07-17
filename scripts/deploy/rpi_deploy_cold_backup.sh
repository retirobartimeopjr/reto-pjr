#!/bin/bash
# Script para desplegar bartimeo-app en la Raspberry Pi (pi-remota)
# REGLAS APLICADAS: No interfiere con AWS (deploy.sh sigue intacto), ni con pjr-app-python.

# 1. Variables de entorno locales y remotas
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_HOST="pi-remota"
REMOTE_DIR="/media/admin/MAXELL8GB/bartimeo-app"

# 2. Archivos y directorios a excluir de la sincronización
EXCLUDES=(
    "--exclude=.git/"
    "--exclude=node_modules/"
    "--exclude=dist/"
    "--exclude=.DS_Store"
    "--exclude=.env"       # Se excluye para no sobrescribir configuraciones en producción
)

echo "=========================================================="
echo "🚀 Iniciando despliegue de bartimeo-app en Raspberry Pi"
echo "Host Destino: $REMOTE_HOST"
echo "Ruta Remota: $REMOTE_DIR"
echo "=========================================================="

# 3. Crear el directorio remoto por si no existe
echo "[1/2] Verificando y creando directorio remoto si no existe..."
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# 4. Sincronizar código fuente utilizando rsync
echo "[2/2] Sincronizando archivos del proyecto..."
rsync -avz --delete "${EXCLUDES[@]}" "$LOCAL_DIR/" "$REMOTE_HOST:$REMOTE_DIR/"

echo "=========================================================="
echo "✅ Despliegue de código completado. Iniciando compilación en Raspberry Pi..."
echo "=========================================================="

ssh "$REMOTE_HOST" << EOF
    cd $REMOTE_DIR
    echo "📦 Instalando dependencias..."
    pnpm install
    echo "🏗️ Compilando aplicación..."
    pnpm run build
    
    echo "🛑 Asegurando que el servicio esté detenido (Backup en frío)..."
    if pm2 list | grep -q "bartimeo"; then
        pm2 stop bartimeo
        pm2 delete bartimeo
        pm2 save
    fi
    echo "✅ Código sincronizado. La Raspberry Pi está lista como copia de seguridad en frío."
EOF

