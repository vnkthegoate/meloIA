#!/bin/bash

echo "Compilando Whisper.cpp..."
# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
cmake -Bbuild
make -Cbuild

# Baixa e converte o modelo ggml-small.bin
cd models
./make-ggml.sh small
