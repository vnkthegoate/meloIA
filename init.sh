#!/bin/bash

# === CONFIGURAÇÕES ===
NODE_FILE="server.js"
TUNNEL_CMD="ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 ssh.localhost.run"

echo "==============================="
echo "Iniciando seu bot Node.js..."
echo "==============================="
echo

# Verifica se o Node está instalado
if ! command -v node &> /dev/null; then
    echo "⚠️ Node.js não encontrado! Instale com: pkg install nodejs"
    exit 1
fi

# Inicia o servidor Node.js em segundo plano
node $NODE_FILE &
NODE_PID=$!

sleep 2

echo
echo "==============================="
echo "Servidor iniciado na porta 3000 com PID: $NODE_PID"
echo "Agora criando túnel público..."
echo "==============================="
echo

# Inicia o túnel Localhost.run
$TUNNEL_CMD

echo
echo "==============================="
echo "Encerrando servidor Node.js..."
echo "==============================="
kill $NODE_PID
