const Chat = require('../models/Chat');
const { genereazaOptiuni, asistentRegizor } = require('../services/ai.service');
const { genereazaAudio, extrageSubtitrariDinAudio } = require('../services/audio.service');
const { randeazaVideoDinamic } = require('../services/video.service');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

async function getPexelsVideo(query) {
  try {
    const res = await axios.get(`https://api.pexels.com/videos/search?query=${query}&orientation=portrait&size=medium&per_page=3`, {
      headers: { Authorization: process.env.PEXELS_API_KEY }
    });

    if (res.data.videos && res.data.videos.length > 0) {
      const videoRandom = res.data.videos[Math.floor(Math.random() * res.data.videos.length)];
      const hdFile = videoRandom.video_files.find(f => f.quality === 'hd') || videoRandom.video_files[0];
      return hdFile.link;
    }
    return null;
  } catch (e) {
    console.error("❌ Eroare Pexels API:", e.response?.data || e.message);
    return null;
  }
}

exports.startProiect = async (req, res) => {
  try {
    const { prompt, youtubeUrl, formatVideo } = req.body;
    const uploadFilePath = req.file ? req.file.path : null;
    const optiuni = await genereazaOptiuni({ prompt, youtubeUrl, uploadFilePath });

    const istoricInitial = [
      { rol: "user", text: prompt },
      {
        rol: "assistant",
        text: "Am generat două variante de scenariu pentru tine. Analizează-le mai jos și alege-o pe preferata ta:",
        scenarii: optiuni
      }
    ];

    const chat = await Chat.create({
      userId: req.user._id,
      prompt,
      scenariiGenerate: optiuni,
      status: 'generat_scenarii',
      formatVideo: formatVideo || 'poveste_gta',
      videoPrincipalUrl: youtubeUrl || uploadFilePath || null,
      istoricInterviu: istoricInitial
    });

    res.json({ success: true, chatId: chat._id, data: optiuni });
  } catch (e) {
    console.error("❌ Eroare StartProiect:", e.message);
    res.status(500).json({ error: "Nu s-au putut genera scenariile inițiale." });
  }
};

exports.chatInterviu = async (req, res) => {
  try {
    const chatId = req.params.id || req.body.chatId;
    const mesajUser = req.body.mesaj || req.body.mesajNou;

    if (!chatId || !mesajUser) {
      return res.status(400).json({ error: "Lipsește ID-ul chat-ului sau mesajul." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Discuția nu a fost găsită." });
    }

    if (chat.formatVideo !== 'split_screen') {
      if (!chat.scenariuAles) {
        if (mesajUser.includes("Am ales:")) {
          if (mesajUser.includes("DeepSeek")) chat.scenariuAles = chat.scenariiGenerate.DeepSeek;
          else if (mesajUser.includes("Qwen")) chat.scenariuAles = chat.scenariiGenerate.Qwen;

          chat.istoricInterviu.push({ rol: "user", text: mesajUser });
          chat.markModified('istoricInterviu');
        }
        else {
          console.log("🔄 Generăm carduri noi bazate pe feedback...");

          const promptNou = `Ideea inițială: ${chat.prompt}\nFeedback nou (rescrie complet scenariile pe baza acestui feedback): ${mesajUser}`;
          const optiuniNoi = await genereazaOptiuni({ prompt: promptNou });

          chat.scenariiGenerate = optiuniNoi;
          const textAI = "Am înțeles! Am aruncat vechile idei și am generat două variante complet noi pentru tine. Analizează-le mai jos și alege-o pe cea mai bună:";

          chat.istoricInterviu.push({ rol: "user", text: mesajUser });
          chat.istoricInterviu.push({
            rol: "assistant",
            text: textAI,
            scenarii: optiuniNoi
          });

          chat.markModified('istoricInterviu');
          await chat.save();

          return res.json({ success: true, status: 'in_curs', reply: textAI, data: optiuniNoi });
        }
      } else {
        chat.istoricInterviu.push({ rol: "user", text: mesajUser });
        chat.markModified('istoricInterviu');
      }
    } else {
      chat.istoricInterviu.push({ rol: "user", text: mesajUser });
      chat.markModified('istoricInterviu');
    }

    const titlu = chat.scenariuAles?.titlu || "Fara titlu";
    const draftInitial = chat.scenariuAles?.scenariu_principal || "";

    const istoricPentruAI = chat.istoricInterviu.map(m => ({
      role: (m.rol === 'user' || m.role === 'user') ? 'user' : 'assistant',
      content: m.text || m.content
    }));

    const raspunsAi = await asistentRegizor(mesajUser, istoricPentruAI, titlu, draftInitial, chat.formatVideo);

    if (raspunsAi.status === "FINALIZAT") {
      chat.status = 'randare';
      await chat.save();

      const config = raspunsAi.config;

      // ----------------------------------------------------
      // LOGICA RANDARE: SPLIT-SCREEN
      // ----------------------------------------------------
      if (chat.formatVideo === 'split_screen') {
        const linkuriFundal = {
          "GTA V": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/Best+GTA+5+MEGA+RAMP+No+Copyright+Gameplay+for+TikTok+%26+YouTube+4K+60fps+_+261.mp4",
          "Minecraft": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/videoplayback.mp4"
        };

        let wordTimestamps = null;
        const uploadFilePath = chat.videoPrincipalUrl;

        try {
          if (config.subtitrari && uploadFilePath && fs.existsSync(uploadFilePath)) {
            console.log(`🎵 Extragem sunetul pentru subtitrări Split-Screen...`);
            const extrageAudioTemp = path.join(process.cwd(), `temp-audio-${chat._id}.mp3`);

            await new Promise((resolve, reject) => {
              ffmpeg(uploadFilePath)
                .outputOptions(['-vn', '-acodec libmp3lame', '-b:a 192k'])
                .save(extrageAudioTemp)
                .on('end', resolve)
                .on('error', reject);
            });
            wordTimestamps = await extrageSubtitrariDinAudio(extrageAudioTemp);
            if (fs.existsSync(extrageAudioTemp)) fs.unlinkSync(extrageAudioTemp);
          }

          let fundalCautat = "GTA V";
          if (config.fundal && config.fundal.toLowerCase().includes('minecraft')) fundalCautat = "Minecraft";

          const videoUrl = await randeazaVideoDinamic({
            audioUrl: null,
            wordTimestamps: wordTimestamps,
            fundalJoc: linkuriFundal[fundalCautat] || linkuriFundal["GTA V"],
            videoTopUrl: uploadFilePath
          });

          if (uploadFilePath && fs.existsSync(uploadFilePath)) fs.unlinkSync(uploadFilePath);

          chat.videoFinalUrl = videoUrl;
          chat.status = 'finalizat';
          const mesajDeFinal = "Iată videoclipul tău Split-Screen! E gata de postat.";
          chat.istoricInterviu.push({ rol: "assistant", text: mesajDeFinal, videoUrl: videoUrl });
          chat.markModified('istoricInterviu');
          await chat.save();

          return res.json({ success: true, status: 'finalizat', reply: mesajDeFinal, videoUrl: videoUrl });

        } catch (err) {
          console.error("❌ Eroare randare Split-Screen:", err.message);
          return res.status(500).json({ error: "Eroare la asamblarea Split-Screen-ului." });
        }
      }
        // ----------------------------------------------------
        // LOGICA RANDARE: POVESTE NORMALĂ & DOCUMENTAR
      // ----------------------------------------------------
      else {
        const linkuriFundal = {
          "GTA V": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/Best+GTA+5+MEGA+RAMP+No+Copyright+Gameplay+for+TikTok+%26+YouTube+4K+60fps+_+261.mp4",
          "Minecraft": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/videoplayback.mp4",
          "Documentar Istoric": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/forest-dark.mp4"
        };

        let jocSelectat;

        if (chat.formatVideo === 'documentar_istoric' || config.fundal === 'Documentar Istoric') {
          const queryCautare = config.pexels_query || 'ancient history';
          console.log(`🔍 Caut fundal pe Pexels orientat pe poveste: "${queryCautare}"...`);

          let videoPexels = await getPexelsVideo(queryCautare);
          if (!videoPexels) {
            console.log(`⚠️ Nu s-a găsit video pentru "${queryCautare}". Se aplică fallback generic...`);
            const fallbackQueries = ['dark history', 'vintage film', 'scary historical', 'old documentary', 'abandoned place'];
            const queryRandom = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
            videoPexels = await getPexelsVideo(queryRandom);
          }
          jocSelectat = videoPexels || linkuriFundal["Documentar Istoric"];
          console.log("🎥 S-a ales fundalul:", jocSelectat);
        }
        else {
          const fundalSelectat = config.fundal || "GTA V";
          jocSelectat = linkuriFundal[fundalSelectat] || linkuriFundal["GTA V"];
        }

        let voceSelectata = config.voce || "pNInz6obpgDQGcFmaJgB";
        if (!/^[a-zA-Z0-9]{15,25}$/.test(voceSelectata)) voceSelectata = "pNInz6obpgDQGcFmaJgB";

        const textFinal = config.poveste_finala_rescrisa || draftInitial;

        try {
          console.log(`🎙️ Generăm Audio...`);
          const audioData = await genereazaAudio(textFinal, voceSelectata);

          console.log(`🎬 Randăm Video Final...`);
          const videoUrl = await randeazaVideoDinamic({
            audioUrl: audioData.audioUrl,
            fundalJoc: jocSelectat,
            wordTimestamps: audioData.timestamps
          });

          chat.videoFinalUrl = videoUrl;
          chat.status = 'finalizat';
          if (chat.scenariuAles) chat.scenariuAles.poveste_finala_rescrisa = textFinal;

          const mesajDeFinal = "Excelent! Am terminat de montat videoclipul tău. Îl poți vedea mai jos!";
          chat.istoricInterviu.push({ rol: "assistant", text: mesajDeFinal, videoUrl: videoUrl });
          chat.markModified('istoricInterviu');
          await chat.save();

          return res.json({ success: true, status: 'finalizat', reply: mesajDeFinal, videoUrl: videoUrl });

        } catch (errVideo) {
          console.error("❌ Eroare Randare:", errVideo.message);
          return res.status(500).json({ error: "Randarea video a eșuat." });
        }
      }

    } else {
      const textAI = raspunsAi.mesaj || "Am înțeles. Mai dorești și alte modificări?";
      chat.istoricInterviu.push({ rol: "assistant", text: textAI });
      chat.markModified('istoricInterviu');
      await chat.save();

      return res.json({ success: true, status: 'in_curs', reply: textAI });
    }

  } catch (e) {
    console.error("❌ EROARE CRITICĂ CONTROLLER:", e.message);
    res.status(500).json({ error: "Eroare la procesarea interviului AI." });
  }
};

exports.initSplitScreen = async (req, res) => {
  try {
    const chat = await Chat.create({
      userId: req.user._id,
      prompt: "Video Split-Screen (Upload)",
      status: 'in_interviu',
      formatVideo: 'split_screen',
      istoricInterviu: [{
        rol: "assistant",
        text: "⏳ Se încarcă videoclipul pe server. Te rog așteaptă câteva secunde..."
      }]
    });
    res.json({ success: true, chatId: chat._id });
  } catch (e) {
    console.error("❌ Eroare Init Split-Screen:", e.message);
    res.status(500).json({ error: "Eroare la inițializare." });
  }
};

exports.proceseazaSplitScreen = async (req, res) => {
  try {
    const chatId = req.params.id;
    const uploadFilePath = req.file ? req.file.path : null;

    if (!uploadFilePath || !chatId) {
      return res.status(400).json({ error: "Lipsesc fișierul sau ID-ul chat-ului!" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat negăsit" });

    chat.videoPrincipalUrl = uploadFilePath;
    chat.status = 'in_interviu';

    const mesajAI = "Am primit videoclipul tău! 🎉 \n\nÎnainte să-l asamblez, spune-mi te rog:\n1. Vrei să generez subtitrări animate peste el?\n2. Ce fundal dorești în partea de jos (ex: GTA V, Minecraft)?";

    chat.istoricInterviu.push({
      rol: "assistant",
      text: mesajAI
    });
    chat.markModified('istoricInterviu');
    await chat.save();

    res.json({ success: true, mesaj: mesajAI });

  } catch (e) {
    console.error("❌ Eroare procesare Split-Screen:", e.message);
    if (!res.headersSent) res.status(500).json({ error: "Eroare la procesarea videoclipului." });
  }
};

exports.getVociDisponibile = async (req, res) => {
  try {
    const r = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' }
    });
    const voci = r.data?.voices?.map(v => ({ id: v.voice_id, nume: v.name })) || [];
    res.json({ success: true, data: voci });
  } catch (e) {
    res.status(500).json({ error: "Nu am putut prelua vocile." });
  }
};

exports.getIstoricProiecte = async (req, res) => {
  try {
    const istoric = await Chat.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id prompt status createdAt formatVideo');
    res.json({ success: true, data: istoric });
  } catch (e) {
    console.error("❌ Eroare Istoric:", e.message);
    res.status(500).json({ error: "Eroare la preluarea istoricului." });
  }
};

exports.stergeChat = async (req, res) => {
  try {
    const chatSters = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!chatSters) {
      return res.status(404).json({ error: 'Chatul nu a fost găsit sau nu ai permisiunea.' });
    }

    res.json({ success: true, mesaj: 'Chat șters cu succes!' });
  } catch (e) {
    console.error("❌ Eroare la ștergere chat:", e.message);
    res.status(500).json({ error: "Eroare la ștergerea proiectului din baza de date." });
  }
};
