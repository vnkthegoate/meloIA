#!/bin/bash

# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
make

# Navega para a pasta de modelos
cd models

# Baixa e converte o modelo ggml-small.bin
./make-ggml.sh small