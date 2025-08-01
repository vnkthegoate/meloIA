#!/bin/bash

# Instala as dependências de build necessárias para compilar o Whisper.cpp
# Este comando é essencial e deve resolver o seu problema
sudo apt-get update
sudo apt-get install -y build-essential

# Navega para o diretório do Whisper.cpp
cd whisper.cpp

# Compila o executável do Whisper.
# Adicionamos 'gmake' como alternativa a 'make'
make || gmake

# Baixa e converte o modelo ggml-small.bin
cd models
./make-ggml.sh small
