#!/bin/bash

# Clona o repositório do Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp

# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
make

# Entra na pasta de modelos
cd models

# Garante que o script tenha permissão de execução
chmod +x ./make-ggml.sh

# Baixa e converte o modelo ggml-small.bin
./make-ggml.sh small
