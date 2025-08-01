#!/bin/bash

# Navega para o diretório
cd whisper.cpp

# Instala o CMake, se necessário
apt-get update
apt-get install -y cmake

# Compila o executável do Whisper
cmake -Bbuild
make -Cbuild

# Navega para a pasta de modelos
cd models

# Baixa e converte o modelo ggml-small.bin
./make-ggml.sh small
