#!/bin/bash
# Script maestro para desplegar en AWS y Raspberry Pi al mismo tiempo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "🌍 INICIANDO DESPLIEGUE HÍBRIDO (AWS + Raspberry Pi)"
echo "=========================================================="

echo -e "\n[PASO 1/2] ☁️  Desplegando en Servidor Principal (AWS EC2)..."
"$SCRIPT_DIR/aws_deploy.sh"

if [ $? -ne 0 ]; then
    echo "❌ Error en el despliegue de AWS. Abortando despliegue en la Raspberry Pi."
    exit 1
fi

echo -e "\n[PASO 2/2] 🍓 Desplegando en Servidor de Respaldo (Raspberry Pi)..."
"$SCRIPT_DIR/rpi_deploy_cold_backup.sh"

if [ $? -ne 0 ]; then
    echo "❌ Error en el despliegue de la Raspberry Pi."
    exit 1
fi

echo "=========================================================="
echo "✅ DESPLIEGUE HÍBRIDO COMPLETADO CON ÉXITO."
echo "=========================================================="
