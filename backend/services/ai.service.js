const { OpenAI } = require('openai');
const fs = require('fs');
require('dotenv').config();

const deepseek = new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' });
const qwen = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY || '' });
const groqWhisper = new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY || '' });

async function cereScenariu(model, numeModel, prompt, referintaText = null) {
  let sysPrompt = `You are a viral TikTok and YouTube Shorts director.
IMPORTANT: You must write the entire response in ENGLISH!
DO NOT use markdown formatting.
DO NOT wrap the JSON in \`\`\` or \`\`\`json.
Return ONLY raw JSON.

The story must be LONG, highly detailed, and engaging, written in the style of viral Reddit stories (like r/nosleep, r/LetsNotMeet, or r/TrueOffMyChest) or fast-paced historical documentaries. It should be rich in narrative and take about 60-90 seconds to read aloud (around 200-350 words).

Respond STRICTLY with a valid JSON using these exact keys:
{
  "titlu": "Catchy English Title here",
  "hooks": ["Shocking English Hook 1", "Intriguing English Hook 2", "Viral English Hook 3"],
  "scenariu_principal": "The long, highly detailed English story or documentary script goes here. Build up the suspense, use paragraphs, and make it captivating...",
  "recomandare_voce": "male_deep",
  "recomandare_fundal": "minecraft_parkour"
}`;

  if (referintaText) sysPrompt += `\nCLONE the style and tone of this text: ${referintaText}`;

  try {
    const res = await model.chat.completions.create({
      model: numeModel,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 4000
    });

    let content = res.choices[0].message.content;

    content = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Invalid JSON format after cleanup");
    }

  } catch (e) {
    console.error(`Eroare generare ${numeModel}:`, e.message);
    return { eroare: "Generare eșuată" };
  }
}

/**
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.youtubeUrl]
 * @param {string} [params.uploadFilePath]
 */
const genereazaOptiuni = async ({ prompt, youtubeUrl, uploadFilePath }) => {
  let ref = null;
  if (youtubeUrl) {
    const { YoutubeTranscript } = await import('youtube-transcript');

    const t = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    ref = t.map(x => x.text).join(' ');
  } else if (uploadFilePath) {
    ref = await groqWhisper.audio.transcriptions.create({
      file: fs.createReadStream(uploadFilePath),
      model: "whisper-large-v3",
      response_format: "text"
    });
    fs.unlinkSync(uploadFilePath);
  }

  const [opt1, opt2] = await Promise.all([ cereScenariu(deepseek, 'deepseek-chat', prompt, ref), cereScenariu(qwen, 'qwen/qwen-2.5-72b-instruct', prompt, ref) ]);
  return { DeepSeek: opt1, Qwen: opt2 };
};

/**
 * @param {string} mesajNou
 * @param {Array} istoric
 * @param {string} titluPoveste
 * @param {string} scenariuDraft
 */
const asistentRegizor = async (mesajNou, istoric, titluPoveste, scenariuDraft) => {
  const listaVoci = `
    - Adam (Masculin, Ferm): pNInz6obpgDQGcFmaJgB
    - Sarah (Feminin, Matura, Calda): EXAVITQu4vr4xnSDxMaL
    - Bella (Feminin, Profesionala): hpp4J3VqNfWAUOO0d1Us
    - Charlie (Masculin, Deep, Energetic): IKne3meq5aSn9XLyUdCD
    - Lily (Feminin, Catifelat): pFZP5JQG7iQjIQuC4Bku
    - Liam (Masculin, Social Media): TX3LPaxmHKxFdv7VOQHJ
  `;
  const sysPrompt = `Ești un regizor video expert.
Statusul curent:
Titlu selectat: "${titluPoveste}"
Schița actuală: "${scenariuDraft}"

Sarcina ta depinde de contextul discuției:

🚨 REGULĂ NOUĂ - RESPINGEREA SAU MODIFICAREA POVEȘTII:
- Dacă utilizatorul spune că NU îi place nicio variantă inițială, sau dacă "Schița actuală" este goală, TU preiei controlul! Generează IMEDIAT o NOUĂ propunere de poveste captivantă direct în mesajul tău, pe baza noilor lui instrucțiuni.
- Discută cu el și modifică povestea până când este 100% mulțumit.
- NU trece la setările de Voce/Fundal/Muzică până când nu vă puneți de acord asupra unei noi povești!

🚨 REGULĂ DE EXECUȚIE IMEDIATĂ (FĂRĂ CONFIRMĂRI):
- Odată ce aveți o poveste bătută în cuie, iar el ți-a dat setările tehnice (Voce, Fundal, Muzică, Lungime), TRECI DIRECT LA TREABĂ!
- Setează "gata_de_randare": true, scrie textul și termină discuția. Fără "Ești gata?", "Să începem?".

🚨 REGULĂ CRITICĂ - PĂSTRAREA POVEȘTII:
- Subiectul poveștii este SFÂNT. NU devia de la el.
- Fundalurile vizuale (GTA V, Minecraft sau Imagini Pexels Istorice/Misterioase) sunt DOAR VIZUALE MUTE. Nu introduce blocuri, mașini furate sau castele în poveste decât dacă subiectul narativ o cere expres.

🚨 REGULĂ PENTRU CONTINUĂRI (PARTEA A 2-A):
- Dacă cere "partea a 2-a", scrie o poveste NOUĂ care pornește fix de unde s-a terminat video-ul anterior.

🚨 REGULĂ PENTRU LUNGIMEA TIMPULUI:
- "1 minut" -> Scrie OBLIGATORIU ~150-200 de cuvinte.
- "2 minute" sau "mai lung" -> Scrie OBLIGATORIU un text MASIV, de MINIM 350 - 450 de cuvinte.

🚨 LISTĂ VOCE DISPONIBILE (Folosește DOAR ID-ul):
${listaVoci}

🚨 FORMAT JSON OBLIGATORIU:
{
  "gata_de_randare": false,
  "mesaj": "Răspunsul tău natural. (Aici îi scrii noile idei de povești dacă a respins variantele vechi, sau confirmi detaliile tehnice)",
  "config": {
    "voce": "ID_UL_ALES_DIN_LISTA",
    "fundal": "GTA V sau Minecraft sau Documentar Istoric",
    "muzica": "suspans sau actiune sau null",
    "poveste_finala_rescrisa": "Textul final lung în ENGLEZĂ (DOAR dacă gata_de_randare e true)",
    "pexels_query": "Dacă fundalul este Documentar Istoric, scrie aici 1-2 cuvinte cheie ÎN ENGLEZĂ foarte generale pentru Pexels (ex: 'vintage soldier', 'old city', 'dark forest', 'black and white history'). Fii cât mai general ca să existe clipuri stock!"
  }
}`;

  const mesaje = [
    { role: "system", content: sysPrompt },
    ...istoric.map(m => ({ role: m.role || m.rol, content: m.content || m.text })),
    { role: "user", content: mesajNou }
  ];

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: mesaje,
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 4000
    });
    const data = JSON.parse(response.choices[0].message.content);

    if (data && data['gata_de_randare'] === true) {
      return { status: "FINALIZAT", config: data.config };
    } else {
      return { status: "IN_CURS", mesaj: data.mesaj || "Ce modificări mai dorești?" };
    }
  } catch (eroare) {
    console.error("Eroare la parsarea AI-ului:", eroare.message);
    return { status: "IN_CURS", mesaj: "Am înțeles, cum vrei să continuăm?" };
  }
};

module.exports = { genereazaOptiuni, asistentRegizor };
