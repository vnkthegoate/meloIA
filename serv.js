const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit'); // Adicione esta linha

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÕES DO WHISPER.CPP ---
const WHISPER_CLI = '/data/data/com.termux/files/home/whisper.cpp/build/bin/whisper-cli';
const WHISPER_MODEL = '/data/data/com.termux/files/home/whisper.cpp/models/ggml-small.bin';

// --- CONFIGURAÇÃO DA API GEMINI ---
const GEMINI_API_KEY = 'AIzaSyBxH0TTFpHMVNA8xSvuBQ6GYUWes4UBSlE'; // << OBTENHA ISSO DO GOOGLE AI STUDIO / GOOGLE CLOUD
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const uploadDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
    if (!fs.existsSync(path.join(publicDir, 'images'))) {
        fs.mkdirSync(path.join(publicDir, 'images'));
    }
    if (!fs.existsSync(path.join(publicDir, 'fonts'))) {
        fs.mkdirSync(path.join(publicDir, 'fonts'));
    }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use(express.static('public'));

// --- FUNÇÃO PARA CRIAR O PDF ---
// Adicionando 'meetingSubject' como novo parâmetro
async function createTranscriptionPdf(meetingSubject, summaryText, outputPath) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let page = pdfDoc.addPage();

  const fontPath = path.join(publicDir, 'fonts', 'NotoSans-Regular.ttf');
  let customFont;
  try {
    const fontBytes = fs.readFileSync(fontPath);
    customFont = await pdfDoc.embedFont(fontBytes);
    console.log('Fonte customizada "Noto Sans" carregada com sucesso.');
  } catch (err) {
    console.warn('AVISO: Não foi possível carregar a fonte customizada. Verifique o caminho ou se o arquivo existe. Usando Helvetica como fallback.', err);
    customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const logoPath = path.join(publicDir, 'images', 'logo.jpg');
  let logoImage = null;
  try {
    const logoBytes = fs.readFileSync(logoPath);
    if (logoPath.endsWith('.png')) {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } else if (logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg')) {
      logoImage = await pdfDoc.embedJpg(logoBytes);
    }
  } catch (err) {
    console.warn('AVISO: Não foi possível carregar o logotipo. Verifique o caminho e o formato do arquivo.', err);
  }

  const logoWidth = 70;
  const logoHeight = logoImage ? (logoImage.height * logoWidth) / logoImage.width : 0;
  const logoX = 50;
  const logoY = page.getHeight() - logoHeight - 50;

  if (logoImage) {
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });
  }

  // --- Adicionar Título (Assunto da Reunião) ---
  const title = meetingSubject || 'Relatório de ATA'; // Usa o assunto ou um título padrão
  page.drawText(title, {
    x: logoImage ? logoX + logoWidth + 20 : 50,
    y: logoImage ? logoY + (logoHeight / 2) - 10 : page.getHeight() - 70,
    font: customFont,
    size: 24,
    color: rgb(0, 0.53, 0.71),
  });

  let currentY = logoImage ? logoY - 40 : page.getHeight() - 120;

  // --- Adicionar Data e Hora ---
  const now = new Date();
  const dateTime = now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  page.drawText(`Data: ${dateTime}`, {
      x: 50,
      y: currentY,
      font: customFont,
      size: 10,
      color: rgb(0.2, 0.2, 0.2),
  });
  currentY -= 20;


  // Função auxiliar para adicionar texto com quebra de linha
  const addTextToPage = (text, startY, fontSize = 12, lineHeight = 1.2) => {
    let y = startY;
    const margin = 50;
    const maxWidth = page.getWidth() - (2 * margin);
    const textFont = customFont;
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine === '' ? word : currentLine + ' ' + word;
      const textWidth = textFont.widthOfTextAtSize(testLine, fontSize);

      if (textWidth < maxWidth) {
        currentLine = testLine;
      } else {
        page.drawText(currentLine, { x: margin, y: y, font: textFont, size: fontSize, color: rgb(0, 0, 0) });
        y -= (fontSize * lineHeight);
        if (y < 50) {
            page = pdfDoc.addPage();
            y = page.getHeight() - margin;
        }
        currentLine = word;
      }
    }
    if (currentLine !== '') {
      page.drawText(currentLine, { x: margin, y: y, font: textFont, size: fontSize, color: rgb(0, 0, 0) });
      y -= (fontSize * lineHeight);
    }
    return y;
  };

  // --- Adicionar Resumo/Tópicos (AGORA É O PRIMEIRO CONTEÚDO TEXTUAL SIGNIFICATIVO) ---
  currentY -= 30; // Espaço antes do título
  page.drawText('Principais Tópicos:', { x: 50, y: currentY, font: customFont, size: 16, color: rgb(0.1, 0.1, 0.1) });
  currentY -= 20;
  currentY = addTextToPage(summaryText, currentY, 10, 1.3);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('PDF criado com sucesso em:', outputPath);
}
// --- FIM DA FUNÇÃO PARA CRIAR O PDF ---


app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo de áudio foi enviado.');
  }

  const inputPath = req.file.path;
  const outputPathWav = inputPath.replace(path.extname(inputPath), '.wav');
  const txtPath = outputPathWav + '.txt';
  const pdfPath = inputPath.replace(path.extname(inputPath), '.pdf');

  let transcricao = '';
  let resumo = 'Não foi possível gerar o resumo. Verifique a chave da API Gemini ou tente novamente.';
  let assuntoAta = 'Assunto da Reunião Não Identificado'; // Nova variável para o assunto

  try {
    await new Promise((resolve, reject) => {
      const ffmpegCmd = `ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${outputPathWav}`;
      exec(ffmpegCmd, (err) => {
        if (err) {
          console.error('Erro ao converter para WAV:', err);
          return reject('Erro ao converter áudio');
        }
        console.log('Arquivo WAV criado:', outputPathWav);
        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      const whisperCmd = `${WHISPER_CLI} -m ${WHISPER_MODEL} -f ${outputPathWav} -l pt -otxt`;
      exec(whisperCmd, (err) => {
        if (err) {
          console.error('Erro na transcrição:', err);
          return reject('Erro na transcrição');
        }
        console.log('Transcrição concluída para:', outputPathWav);
        resolve();
      });
    });

    if (!fs.existsSync(txtPath)) {
      throw new Error('Arquivo de transcrição não encontrado após o Whisper.');
    }
    transcricao = fs.readFileSync(txtPath, 'utf-8');

    transcricao = transcricao.replace(/\r\n|\n|\r/g, '\n').replace(/[^\x20-\x7E\n\rÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÃÕãõÇçÑñªº°çÇ]/g, '');


    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      // Novo prompt para pedir o assunto e formatar a saída para facilitar a extração
      const prompt = `A partir da seguinte transcrição de áudio, por favor, gere um JSON com as seguintes chaves:
      1. "assunto_ata": Um título pequeno e conciso que represente o assunto principal da reunião.
      2. "topicos_principais": Uma lista dos principais tópicos discutidos, como se fosse uma ata de reunião, usando bullet points. Se houver, identifique também quaisquer decisões ou itens de ação relevantes. Seja conciso.
      3. "resumo": Um resumo de tudo que foi dito na transcriçao.
      Transcrição:
      "${transcricao}"

      Exemplo de saída JSON:
      {
        "assunto_ata": "Planejamento Estratégico Q3",
        "topicos_resumo": "- Revisão de metas do Q2\n- Definição de OKRs para o Q3\n- Alocação de recursos para o Projeto X\n- Decisão: Agendar follow-up semanal",
        "resumo": "Esta reunião focou na revisão do desempenho do trimestre anterior e na definição de novos objetivos para o Q3. As discussões principais incluíram a definição de OKRs, a alocação de recursos para o Projeto X, e foi tomada a decisão de agendar uma reunião de acompanhamento para aprovar o orçamento."
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();

      // Tenta parsear o JSON. O Gemini às vezes inclui '```json' e '```'
      if (rawText.startsWith('```json')) {
        rawText = rawText.substring(7, rawText.lastIndexOf('```')).trim();
      }

      const parsedResponse = JSON.parse(rawText);
      assuntoAta = parsedResponse.assunto_ata || 'Assunto da Reunião Não Identificado';
      resumo = parsedResponse.topicos_resumo || 'Não foi possível gerar os tópicos/resumo.';

      resumo = resumo.replace(/\r\n|\n|\r/g, '\n').replace(/[^\x20-\x7E\n\rÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÃÕãõÇçÑñªº°çÇ]/g, '');

    } catch (geminiError) {
      console.error('Erro ao gerar resumo/assunto com Gemini:', geminiError);
      resumo = 'Não foi possível gerar os tópicos/resumo. Verifique a chave da API Gemini ou tente novamente.';
      assuntoAta = 'Assunto da Reunião Não Identificado (Erro na IA)';
    }

    // Passa o assunto da ata para a função de criação de PDF
    await createTranscriptionPdf(assuntoAta, resumo, pdfPath);

    res.send(`
      <h2>Processamento Concluído!</h2>
      <h3>Assunto: ${assuntoAta}</h3>
      <p><a href="/downloads/${path.basename(pdfPath)}" download>Baixar Relatório da Ata em PDF</a></p>
      <p><a href="/downloads/${path.basename(txtPath)}" download>Baixar Transcrição em TXT</a></p> <hr>
      <h3>Principais Tópicos:</h3>
      <pre>${resumo}</pre>
      <h3>Transcrição Completa:</h3>
      <pre>${transcricao}</pre>
    `);

  } catch (error) {
    console.error('Erro no processamento principal:', error);
    res.status(500).send(`
        <h2>Erro no Processamento:</h2>
        <p>Ocorreu um erro ao processar o áudio ou gerar o resumo.</p>
        <pre>${error.message || error}</pre>
        <p>Por favor, tente novamente ou verifique os logs do servidor para mais detalhes.</p>
    `);
  } finally {
    const filesToDelete = [inputPath, outputPathWav];
    filesToDelete.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlink(file, (err) => {
          if (err) {
            console.error(`Erro ao remover arquivo temporário ${file}:`, err);
          } else {
            console.log(`Arquivo temporário removido: ${file}`);
          }
        });
      }
    });
  }
});

app.get('/downloads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error('Erro ao baixar o arquivo:', err);
                res.status(500).send('Erro ao baixar o arquivo.');
            }
        });
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`Acesse no navegador: http://localhost:${PORT}`);
  console.log(`Chave API: ${GEMINI_API_KEY} Conectada no server.js!`);
});
