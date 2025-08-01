#!/bin/bash

echo "Compilando Whisper.cpp..."
echo "Verificando o conteúdo da pasta whisper.cpp..."
ls -la /opt/render/project/src/whisper.cpp

# Adicione também um comando para ver o conteúdo geral
ls -la /opt/render/project/src/
# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
cmake -Bbuild
make -Cbuild

# Baixa e converte o modelo ggml-small.bin
cd models
./make-ggml.sh small
