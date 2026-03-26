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

    const chat = await Chat.create({
      userId: req.user._id,
      prompt,
      scenariiGenerate: optiuni,
      status: 'generat_scenarii',
      formatVideo: formatVideo || 'poveste_gta',
      videoPrincipalUrl: youtubeUrl || uploadFilePath || null,
      istoricInterviu: []
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

    if (!chat.scenariuAles) {
      if (mesajUser.includes("Am ales:")) {
        if (mesajUser.includes("DeepSeek")) chat.scenariuAles = chat.scenariiGenerate.DeepSeek;
        else if (mesajUser.includes("Qwen")) chat.scenariuAles = chat.scenariiGenerate.Qwen;

        chat.istoricInterviu.push({ rol: "user", text: mesajUser });
      }
      else {
        console.log("🔄 Generăm carduri noi bazate pe feedback...");

        const promptNou = `Ideea inițială: ${chat.prompt}\nFeedback nou (rescrie complet scenariile pe baza acestui feedback): ${mesajUser}`;
        const optiuniNoi = await genereazaOptiuni({ prompt: promptNou });

        chat.scenariiGenerate = optiuniNoi;
        chat.prompt = promptNou;

        const textAI = "Am înțeles! Am aruncat vechile idei și am generat două variante complet noi pentru tine. Analizează-le mai jos și alege-o pe cea mai bună:";

        chat.istoricInterviu.push({ rol: "user", text: mesajUser });
        chat.istoricInterviu.push({ rol: "assistant", text: textAI });
        await chat.save();

        return res.json({ success: true, status: 'in_curs', reply: textAI, data: optiuniNoi });
      }
    } else {
      chat.istoricInterviu.push({ rol: "user", text: mesajUser });
    }

    const titlu = chat.scenariuAles?.titlu || "Fara titlu";
    const draftInitial = chat.scenariuAles?.scenariu_principal || "";

    const istoricPentruAI = chat.istoricInterviu.map(m => ({
      role: (m.rol === 'user' || m.role === 'user') ? 'user' : 'assistant',
      content: m.text || m.content
    }));

    const raspunsAi = await asistentRegizor(mesajUser, istoricPentruAI, titlu, draftInitial);

    if (raspunsAi.status === "FINALIZAT") {
      chat.status = 'randare';
      await chat.save();

      const config = raspunsAi.config;

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

        await chat.save();

        return res.json({ success: true, status: 'finalizat', reply: mesajDeFinal, videoUrl: videoUrl });

      } catch (errVideo) {
        console.error("❌ Eroare Randare:", errVideo.message);
        return res.status(500).json({ error: "Randarea video a eșuat." });
      }

    } else {
      const textAI = raspunsAi.mesaj || "Am înțeles. Mai dorești și alte modificări?";
      chat.istoricInterviu.push({ rol: "assistant", text: textAI });
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
      status: 'randare',
      formatVideo: 'split_screen',
      istoricInterviu: [{
        rol: "assistant",
        text: "⏳ Se încarcă videoclipul pe server și se asamblează cu GTA V... Te rog așteaptă câteva secunde."
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

    res.json({ success: true, mesaj: "Upload complet, începem tăierea!" });

    (async () => {
      const extrageAudioTemp = path.join(process.cwd(), `temp-audio-${chat._id}.mp3`);

      try {
        console.log(`🎵 Extragem sunetul din videoclipul încărcat pentru a genera subtitrările...`);

        await new Promise((resolve, reject) => {
          ffmpeg(uploadFilePath)
            .outputOptions(['-vn', '-acodec libmp3lame', '-b:a 192k'])
            .save(extrageAudioTemp)
            .on('end', resolve)
            .on('error', reject);
        });

        const wordTimestamps = await extrageSubtitrariDinAudio(extrageAudioTemp);

        console.log(`🎬 Începem asamblarea Split-Screen...`);

        const linkuriFundal = {
          "GTA V": "https://shortsgpt-audio-135808931794-eu-north-1-an.s3.eu-north-1.amazonaws.com/Best+GTA+5+MEGA+RAMP+No+Copyright+Gameplay+for+TikTok+%26+YouTube+4K+60fps+_+261.mp4"
        };

        const videoUrl = await randeazaVideoDinamic({
          audioUrl: null,
          wordTimestamps: wordTimestamps,
          fundalJoc: linkuriFundal["GTA V"],
          videoTopUrl: uploadFilePath
        });

        chat.status = 'finalizat';
        chat.videoFinalUrl = videoUrl;
        chat.istoricInterviu.push({
          rol: "assistant",
          text: "Iată videoclipul tău Split-Screen! Gata de postat.",
          videoUrl: videoUrl
        });
        await chat.save();

      } catch (err) {
        console.error("❌ Eroare fundal Split-Screen:", err.message);
        chat.status = 'eroare';
        await chat.save();
      } finally {
        if (fs.existsSync(uploadFilePath)) fs.unlinkSync(uploadFilePath);
        if (fs.existsSync(extrageAudioTemp)) fs.unlinkSync(extrageAudioTemp);
      }
    })().catch(err => console.error("Eroare fundal:", err));

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
