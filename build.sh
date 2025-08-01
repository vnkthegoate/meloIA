#!/bin/bash

echo "Compilando Whisper.cpp..."
echo "Verificando o conteúdo da pasta whisper.cpp..."
ls -la /opt/render/project/src/whisper.cpp

# Adicione também um comando para ver o conteúdo geral
ls -la /opt/render/project/src/
# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
make

# Navega para a pasta de modelos
cd models

# Baixa e converte o modelo ggml-small.bin
./make-ggml.sh small
