#!/bin/bash

# Clona o repositório do Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp

# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
make

# Navega para a pasta models
cd models

# Baixa e converte o modelo ggml-small.bin
./make-ggml.sh small
