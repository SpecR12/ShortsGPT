const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const formatTimeSRT = (seconds) => {
  const date = new Date(seconds * 1000);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
};

const genereazaFisierSRT = (wordTimestamps, srtPath) => {
  let srtContent = '';
  let counter = 1;
  let currentBlock = [];
  let currentStart = wordTimestamps[0]?.start || 0;

  wordTimestamps.forEach((item, index) => {
    currentBlock.push(item.word);

    const isEndOfSentence = item.word.match(/[.?!]/);
    const isMaxWords = currentBlock.length >= 4;
    const isLast = index === wordTimestamps.length - 1;

    if (isEndOfSentence || isMaxWords || isLast) {
      const startStr = formatTimeSRT(currentStart);
      const endStr = formatTimeSRT(item.end);

      srtContent += `${counter}\n${startStr} --> ${endStr}\n${currentBlock.join(' ')}\n\n`;

      counter++;
      currentBlock = [];
      currentStart = wordTimestamps[index + 1]?.start || item.end;
    }
  });

  fs.writeFileSync(srtPath, srtContent);
};

const randeazaVideoDinamic = async ({ audioUrl, fundalJoc, wordTimestamps, videoTopUrl = null }) => {
  return new Promise((resolve, reject) => {
    if (!fundalJoc) {
      return reject(new Error("Eroare critică: Link-ul pentru Video de fundal lipsește!"));
    }

    const uuid = crypto.randomUUID();
    const srtFileName = `subtitrare-${uuid}.srt`;
    const outputVideoName = `final-${uuid}.mp4`;

    const srtPath = path.join(process.cwd(), srtFileName);
    const outputPath = path.join(process.cwd(), outputVideoName);

    const curataFisiereTemporare = () => {
      try {
        if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        console.log(`🧹 Curățenie finalizată pentru fișierele ${uuid}`);
      } catch (err) {
        console.error("⚠️ Nu am putut șterge fișierele temporare:", err.message);
      }
    };

    let comandaFfmpeg = ffmpeg();

    if (wordTimestamps && wordTimestamps.length > 0) {
      console.log(`🎬 [1/3] Construim subtitrările dinamice (.srt)...`);
      genereazaFisierSRT(wordTimestamps, srtPath);
    }

    // ===============================================
    // ✂️ LOGICA PENTRU SPLIT-SCREEN (CU Subtitrări pe video-ul de SUS)
    // ===============================================
    if (videoTopUrl) {
      console.log(`🎬 [2/3] Mod: SPLIT-SCREEN (Așezăm textul deasupra GTA V)`);

      const complexFiltre = [
        '[0:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[top_raw]',
        '[1:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960[bot]'
      ];

      if (wordTimestamps && wordTimestamps.length > 0) {
        complexFiltre.push(`[top_raw]subtitles=${srtFileName}:force_style='FontSize=20,PrimaryColour=&H0044FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=25'[top_sub]`);
        complexFiltre.push('[top_sub][bot]vstack=inputs=2[v]');
      } else {
        complexFiltre.push('[top_raw][bot]vstack=inputs=2[v]');
      }

      comandaFfmpeg
        .input(videoTopUrl)
        .input(fundalJoc).inputOptions(['-stream_loop', '-1'])
        .complexFilter(complexFiltre)
        .outputOptions([
          '-map [v]',
          '-map 0:a', // Sunetul original
          '-shortest',
          '-c:v libx264',
          '-preset fast',
          '-crf 18',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k'
        ]);
    }
      // ===============================================
      // 📱 LOGICA PENTRU FULL-SCREEN (Povești AI)
    // ===============================================
    else {
      if(!wordTimestamps || wordTimestamps.length === 0) {
        return reject(new Error("Nu s-au furnizat timestamp-uri pentru subtitrări în modul full-screen."));
      }

      console.log(`🎬 [2/3] Mod: FULL-SCREEN`);
      comandaFfmpeg
        .input(fundalJoc).inputOptions(['-stream_loop', '-1'])
        .input(audioUrl)
        .outputOptions([
          '-shortest',
          `-vf crop=ih*(9/16):ih,scale=1080:1920:flags=lanczos,subtitles=${srtFileName}:force_style='FontSize=20,PrimaryColour=&H0044FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=25'`,
          '-c:v libx264',
          '-preset fast',
          '-crf 18',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          '-map 0:v:0',
          '-map 1:a:0'
        ]);
    }

    // ===============================================
    // 💾 SALVARE ȘI UPLOAD CĂTRE AWS S3
    // ===============================================
    comandaFfmpeg
      .save(outputPath)
      .on('end', async () => {
        console.log(`🎬 Randare locală completă! Urcăm produsul finit pe Amazon S3...`);
        try {
          const videoBuffer = fs.readFileSync(outputPath);
          const s3FileName = `shorts-${uuid}.mp4`;

          await s3.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME || '',
            Key: s3FileName,
            Body: videoBuffer,
            ContentType: 'video/mp4'
          }));

          const videoFinalUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3FileName}`;
          resolve(videoFinalUrl);

        } catch (err) {
          console.error("❌ Eroare la upload-ul S3:", err);
          reject(err);
        } finally {
          curataFisiereTemporare();
        }
      })
      .on('error', (err) => {
        console.error("❌ EROARE FFmpeg:", err.message);
        curataFisiereTemporare();
        reject(new Error("FFmpeg a eșuat la randare."));
      });
  });
};

module.exports = { randeazaVideoDinamic };
