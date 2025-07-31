const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('nodemailer'); // **Importe o Nodemailer aqui**
const nodemailer = require('nodemailer'); // **Importe o Nodemailer aqui**

const app = express();
const PORT = 3000;

// Middleware para parsear JSON no corpo das requisições (necessário para o email)
app.use(express.json());

// --- CONFIGURAÇÕES DO WHISPER.CPP ---
const WHISPER_CLI = '/data/data/com.termux/files/home/whisper.cpp/build/bin/whisper-cli';
const WHISPER_MODEL = '/data/data/com.termux/files/home/whisper.cpp/models/ggml-small.bin';

// --- CONFIGURAÇÃO DA API GEMINI ---
const GEMINI_API_KEY = 'AIzaSyBxH0TTFpHMVNA8xSvuBQ6GYUWes4UBSlE'; // << OBTENHA ISSO DO GOOGLE AI STUDIO / GOOGLE CLOUD
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// --- FIM DA CONFIGURAÇÃO GEMINI ---

// --- CONFIGURAÇÃO DO NODEMAILER ---
// **ATENÇÃO:** Substitua pelas suas credenciais de e-mail.
// Se usar Gmail com 2FA, use uma "Senha de aplicativo" (App Password)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Ou seu SMTP host (ex: smtp.office365.com para Outlook)
    port: 587,
    secure: false, // Use 'true' para porta 465, 'false' para outras (ex: 587 com STARTTLS)
    auth: {
        user: 'vnkthegoatt@gmail.com', // Seu e-mail remetente
        pass: 'kqem ylpc qfpw aqjt' // Sua senha de aplicativo ou senha do e-mail
    },
    tls: {
        rejectUnauthorized: false // Apenas para desenvolvimento/testes se tiver problemas com certificados
    }
});
// --- FIM DA CONFIGURAÇÃO DO NODEMAILER ---


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
async function createTranscriptionPdf(meetingSubject, mainTopics, generalSummary, outputPath) {
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

  const title = meetingSubject || 'Relatório de Transcrição';
  page.drawText(title, {
    x: logoImage ? logoX + logoWidth + 20 : 50,
    y: logoImage ? logoY + (logoHeight / 2) - 10 : page.getHeight() - 70,
    font: customFont,
    size: 24,
    color: rgb(0, 0.53, 0.71),
  });

  let currentY = logoImage ? logoY - 40 : page.getHeight() - 120;

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

  const addParagraphToPage = (text, startY, fontSize = 12, lineHeight = 1.2) => {
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

  currentY -= 30;
  page.drawText('Principais Tópicos da Ata:', { x: 50, y: currentY, font: customFont, size: 16, color: rgb(0.1, 0.1, 0.1) });
  currentY -= 20;

  const topicsArray = mainTopics.split('\n').filter(line => line.trim() !== '');
  const topicIndent = 70;
  const topicLineHeight = 1.2;
  const topicFontSize = 10;

  for (const topic of topicsArray) {
    let tempY = currentY;
    let currentTopicLine = '';
    const topicWords = topic.split(' ');

    for (const word of topicWords) {
      const testLine = currentTopicLine === '' ? word : currentTopicLine + ' ' + word;
      const textWidth = customFont.widthOfTextAtSize(testLine, topicFontSize);
      const maxWidthForTopic = page.getWidth() - topicIndent - 50;

      if (textWidth < maxWidthForTopic) {
        currentTopicLine = testLine;
      } else {
        page.drawText(currentTopicLine, { x: topicIndent, y: tempY, font: customFont, size: topicFontSize, color: rgb(0, 0, 0) });
        tempY -= (topicFontSize * topicLineHeight);
        if (tempY < 50) {
            page = pdfDoc.addPage();
            tempY = page.getHeight() - 50;
        }
        currentTopicLine = word;
      }
    }
    if (currentTopicLine !== '') {
      page.drawText(currentTopicLine, { x: topicIndent, y: tempY, font: customFont, size: topicFontSize, color: rgb(0, 0, 0) });
      tempY -= (topicFontSize * topicLineHeight);
    }
    currentY = tempY;
    if (currentY < 50) {
        page = pdfDoc.addPage();
        currentY = page.getHeight() - 50;
    }
  }

  currentY -= 30;
  page.drawText('Resumo do Assunto:', { x: 50, y: currentY, font: customFont, size: 16, color: rgb(0.1, 0.1, 0.1) });
  currentY -= 20;
  currentY = addParagraphToPage(generalSummary, currentY, 10, 1.3);


  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('PDF criado com sucesso em:', outputPath);
}
// --- FIM DA FUNÇÃO PARA CRIAR O PDF ---

// --- ROTA DE UPLOAD (sem mudanças aqui) ---
app.post('/upload', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nenhum arquivo de áudio foi enviado.');
  }

  const inputPath = req.file.path;
  const outputPathWav = inputPath.replace(path.extname(inputPath), '.wav');
  const txtPath = outputPathWav + '.txt';
  const pdfPath = inputPath.replace(path.extname(inputPath), '.pdf');

  let transcricao = '';
  let mainTopics = 'Não foi possível gerar os tópicos principais.';
  let generalSummary = 'Não foi possível gerar o resumo do assunto.';
  let assuntoAta = 'Assunto da Reunião Não Identificado';

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
      const prompt = `A partir da seguinte transcrição de áudio, por favor, gere um JSON com as seguintes chaves:
      1. "assunto_ata": Um título conciso (máximo 2 palavras) que represente o assunto principal da reunião.
      2. "topicos_principais": Uma lista de APENAS 5 dos principais tópicos discutidos na reunião, usando bullet points, onde cada bullet point deve estar em uma nova linha. Inclua quaisquer decisões ou itens de ação relevantes. Seja conciso e direto.
      3. "resumo_geral": Um a no maximo seis parágrafos, conciso e objetivo, que seja um resumo de todo o assunto da transcrição.

      Transcrição:
      "${transcricao}"

      Exemplo de saída JSON:
      {
        "assunto_ata": "Planejamento de Projeto e Próximos Passos",
        "topicos_principais": "- Revisão do escopo do Projeto Alfa\\n- Alocação de equipe para a Fase 2\\n- Decisão: Adiar lançamento do Módulo Beta em uma semana\\n- Item de Ação: João deve contatar o fornecedor X até sexta",
        "resumo_geral": "A reunião cobriu a revisão do Projeto Alfa, focando na alocação de recursos e cronograma. Houve um adiamento no lançamento do Módulo Beta, e ações específicas foram definidas para a equipe."
      }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();

      if (rawText.startsWith('```json')) {
        rawText = rawText.substring(7, rawText.lastIndexOf('```')).trim();
      }

      const parsedResponse = JSON.parse(rawText);

      assuntoAta = String(parsedResponse.assunto_ata || 'Assunto da Reunião Não Identificado');
      mainTopics = String(parsedResponse.topicos_principais || 'Não foi possível gerar os tópicos principais da ata.');
      generalSummary = String(parsedResponse.resumo_geral || 'Não foi possível gerar o resumo geral do assunto.');

      mainTopics = mainTopics.replace(/\r\n|\r/g, '\n').replace(/[^\x20-\x7E\nÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÃÕãõÇçÑñªº°çÇ]/g, '');
      generalSummary = generalSummary.replace(/\r\n|\n|\r/g, '\n').replace(/[^\x20-\x7E\n\rÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÃÕãõÇçÑñªº°çÇ]/g, '');

    } catch (geminiError) {
      console.error('Erro ao gerar conteúdo com Gemini:', geminiError);
      mainTopics = 'Não foi possível gerar os tópicos principais da ata devido a um erro na IA.';
      generalSummary = 'Não foi possível gerar o resumo geral do assunto devido a um erro na IA.';
      assuntoAta = 'Assunto da Reunião Não Identificado (Erro na IA)';
    }

    await createTranscriptionPdf(assuntoAta, mainTopics, generalSummary, pdfPath);

    // Salvamos os caminhos dos arquivos para o uso na rota de e-mail
    // Esses caminhos serão passados para o frontend para serem usados na requisição de e-mail
    const pdfFileName = path.basename(pdfPath);
    const txtFileName = path.basename(txtPath);
    const wavFileName = path.basename(outputPathWav); // <-- Nova linha

    res.send(`
      <h2>Processamento Concluído!</h2>
      <h3>Assunto: ${assuntoAta}</h3>
      <p><a href="/downloads/${pdfFileName}" download>Baixar Relatório da Ata em PDF</a></p>
      <p><a href="/downloads/${txtFileName}" download>Baixar Transcrição em TXT</a></p>
      <p><a href="/downloads/${wavFileName}" download>Baixar .WAV</a></p>
      <hr>
      <h3>Principais Tópicos da Ata: </h3>
      <pre>${mainTopics}</pre>
      <h3>Resumo Geral: </h3>
      <pre>${generalSummary}</pre>
      <h3>Transcrição Completa:</h3>
      <pre>${transcricao}</pre>

      <hr>
      <h3>Enviar por E-mail:</h3>
      <div id="emailForm" style="text-align: left; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #f9f9f9;">
        <p>Preencha os dados para enviar o PDF e o TXT por e-mail.</p>
        <label for="recipientEmail" style="display: block; margin-bottom: 5px; font-weight: 600;">E-mail do Destinatário:</label>
        <input type="email" id="recipientEmail" placeholder="destinatario@exemplo.com" style="width: calc(100% - 10px); padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
        <button id="sendEmailButton" data-pdf="${pdfFileName}" data-txt="${txtFileName}" data-wav="${wavFileName}" data-assunto="${encodeURIComponent(assuntoAta)}" style="width: 100%; padding: 12px; background-color: #28a745; color: white; border-radius: 5px; cursor: pointer;">Enviar por E-mail</button>
        <p id="emailStatus" style="margin-top: 10px; font-size: 0.9em; color: #555;"></p>
      </div>
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
    const filesToDelete = [inputPath];
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

// --- NOVA ROTA PARA ENVIAR E-MAIL ---
app.post('/send-email', async (req, res) => {
    const { recipientEmail, pdfFileName, txtFileName, assuntoAta, wavFileName } = req.body;

    if (!recipientEmail || !pdfFileName || !txtFileName || !wavFileName) {
        return res.status(400).json({ success: false, message: 'Dados incompletos para envio de e-mail.' });
    }

    const pdfPath = path.join(uploadDir, pdfFileName);
    const wavPath = path.join(uploadDir, wavFileName);
    const txtPath = path.join(uploadDir, txtFileName);

    // Verificar se os arquivos existem antes de tentar enviar
    if (!fs.existsSync(pdfPath) || !fs.existsSync(txtPath) || !fs.existsSync(wavPath)) {
        return res.status(404).json({ success: false, message: 'Um ou ambos os arquivos (PDF/TXT) não foram encontrados no servidor.' });
    }

    try {
        const mailOptions = {
            from: 'SEU_EMAIL@gmail.com', // O e-mail configurado no transporter
            to: recipientEmail,
            subject: `Relatório de Transcrição: ${assuntoAta || 'Reunião Sem Assunto Definido'}`,
            html: `<p>Olá,</p>
                   <p>Segue em anexo o relatório da transcrição da reunião com o assunto: <strong>${assuntoAta || 'Não Definido'}</strong>.</p>
                   <p>Você encontrará os principais tópicos da ata em PDF e a transcrição completa em TXT e o Audio Bruto em WAV.</p>
                   <p>Atenciosamente,<br>vnkthegreat</p>`,
            attachments: [
                {
                    filename: `Relatorio_Ata_${assuntoAta.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.pdf`,
                    path: pdfPath,
                    contentType: 'application/pdf'
                },
                {
                    filename: `Transcricao_${assuntoAta.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.txt`,
                    path: txtPath,
                    contentType: 'text/plain'
                },
		{
		   filename: `Audio_Reunião: ${assuntoAta.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30)}.wav`,
		   path: wavPath,
		   contentType: 'audio/wav'
		}
            ]
        };

        await transporter.sendMail(mailOptions);
        console.log(`E-mail enviado para ${recipientEmail} com ${pdfFileName} e ${txtFileName}`);
        res.json({ success: true, message: 'E-mail enviado com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ success: false, message: `Falha ao enviar e-mail: ${error.message}` });
    }
});


// --- ROTA DE DOWNLOAD (sem mudanças aqui) ---
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
  console.log('Lembre-se de substituir SUA_CHAVE_API_GEMINI no server.js!');
});
