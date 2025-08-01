#!/bin/bash

# Verifica se o diretório whisper.cpp existe
if [ ! -d "whisper.cpp" ]; then
  echo "Erro: O diretório 'whisper.cpp' não foi encontrado. Certifique-se de que ele foi adicionado ao seu repositório."
  exit 1
fi

echo "Compilando Whisper.cpp..."
# Navega para o diretório
cd whisper.cpp

# Compila o executável do Whisper
# Tenta usar 'make' e, se falhar, tenta 'gmake'
make || gmake

# Verifica se a compilação foi bem-sucedida
if [ ! -f "build/bin/whisper-cli" ]; then
  echo "Erro: O executável 'whisper-cli' não foi criado. A compilação falhou."
  exit 1
fi

echo "Baixando o modelo ggml-small.bin..."
# Navega para a pasta de modelos
cd models

# Baixa o modelo
./make-ggml.sh small
