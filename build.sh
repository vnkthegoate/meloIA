#!/bin/bash

# Clona o repositório do Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp

# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
make

# Baixa e converte o modelo ggml-small.bin, usando o caminho completo
./models/make-ggml.sh small
