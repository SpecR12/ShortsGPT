const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { OpenAI } = require('openai');
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const groqWhisper = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || ''
});

const genereazaAudio = async (text, voiceId = 'pNInz6obpgDQGcFmaJgB') => {
  console.log(`🎙️ Solicităm Audio și Sincronizare la ElevenLabs (ID: ${voiceId})...`);

  try {
    const res = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        text,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128"
      },
      {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' }
      }
    );

    if (!res.data || !res.data.audio_base64) {
      throw new Error("Datele audio lipsesc din răspunsul JSON.");
    }

    const audioBuffer = Buffer.from(res.data.audio_base64, 'base64');

    const alignment = res.data.alignment;
    let wordTimestamps = [];
    let currentWord = "";
    let wordStart = null;
    let wordEnd = null;

    for (let i = 0; i < alignment.characters.length; i++) {
      const char = alignment.characters[i];
      const start = alignment.character_start_times_seconds[i];
      const end = alignment.character_end_times_seconds[i];

      if (char !== " " && char !== "\n" && char !== "\r") {
        if (currentWord === "") wordStart = start;
        currentWord += char;
        wordEnd = end;
      } else {
        if (currentWord !== "") {
          wordTimestamps.push({ word: currentWord, start: wordStart, end: wordEnd });
          currentWord = "";
        }
      }
    }
    if (currentWord !== "") {
      wordTimestamps.push({ word: currentWord, start: wordStart, end: wordEnd });
    }
    const fileName = `audio-${crypto.randomUUID()}.mp3`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || '',
      Key: fileName,
      Body: audioBuffer,
      ContentType: 'audio/mpeg'
    }));

    const audioUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return { audioUrl, timestamps: wordTimestamps };

  } catch (error) {
    const detalii = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    console.error("❌ Eroare ElevenLabs:", detalii);
    throw new Error(`Eroare generare voce: ${detalii}`);
  }
};

const extrageSubtitrariDinAudio = async (audioFilePath) => {
  try {
    console.log(`🎙️ Trimitem audio-ul către Whisper pentru extragerea cuvintelor...`);
    const transcript = await groqWhisper.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      timestamp_granularities: ["word"]
    });

    if (!transcript.words || transcript.words.length === 0) {
      throw new Error("Whisper nu a returnat timestamp-uri pentru cuvinte.");
    }

    return transcript.words;
  } catch (error) {
    console.error("❌ Eroare la extragerea subtitrărilor:", error.message);
    throw error;
  }
};

module.exports = {
  genereazaAudio,
  extrageSubtitrariDinAudio
};
