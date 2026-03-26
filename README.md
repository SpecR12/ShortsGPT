# 🎬 ShortsGPT - Automated Viral Short Video Generator

ShortsGPT is a powerful, full-stack web application designed to completely automate the creation of viral short-form videos (TikTok, YouTube Shorts, Instagram Reels). It combines state-of-the-art LLMs, AI Voice generation, Audio Transcription, and dynamic Video Rendering to produce ready-to-publish content in minutes.

---

## ✨ Key Features

* 🎮 **AI Storyteller (GTA V Background):** Generates engaging, Reddit-style stories (horror, funny, true off my chest) using AI, narrates them with realistic voices, and overlays dynamic, word-by-word subtitles over GTA V gameplay.
* 📜 **Historical Documentaries:** AI writes captivating historical scripts, automatically fetches context-aware stock videos from Pexels, and renders a professional mini-documentary.
* ✂️ **Split-Screen / Rage Bait Generator:** Upload your own video! The app instantly processes it in the background, stacks it perfectly above GTA V gameplay, extracts your audio, uses AI to transcribe it, and places highly engaging, animated subtitles directly on your video.
* 💬 **Interactive "AI Director" Chat:** Don't like the script? Chat with the AI Director to tweak the story, change the tone, or pick different background music and voice actors before rendering.
* ☁️ **Cloud Storage:** Automatically uploads final rendered videos to Amazon S3 for fast and reliable content delivery.

---

## 🛠️ Tech Stack

**Frontend:**
* [Angular 21](https://angular.dev/) - Modern, fast, and scalable framework.
* [Tailwind CSS](https://tailwindcss.com/) - For a sleek, responsive, and dark-mode-optimized UI.
* RxJS - For reactive state management and background polling.

**Backend:**
* [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) - Robust API architecture.
* [MongoDB](https://www.mongodb.com/) & Mongoose - Database for storing user chat history, project status, and scripts.
* [Multer](https://github.com/expressjs/multer) - Handling heavy video uploads seamlessly.

**Video & Audio Processing Engine:**
* [FFmpeg](https://ffmpeg.org/) (via `fluent-ffmpeg`) - Core engine for cropping, stacking, looping, and burning subtitles into video files.
* [AWS S3 SDK](https://aws.amazon.com/s3/) - Cloud storage for final MP4 outputs.

**AI Models & APIs:**
* **DeepSeek / Qwen (via OpenRouter):** Core LLMs for scriptwriting and directing.
* **ElevenLabs API:** Ultra-realistic Text-to-Speech (TTS) with word-level timestamp generation.
* **Groq Whisper (whisper-large-v3):** Blazing fast Speech-to-Text (STT) for extracting subtitles from uploaded user videos.
* **Pexels API:** Dynamic fetching of b-roll footage.

---

## 🚀 Getting Started

### Prerequisites

1.  **Node.js** (v18+ recommended)
2.  **MongoDB** (Local instance or MongoDB Atlas URI)
3.  **FFmpeg:** You **must** have FFmpeg installed on your operating system and added to your system's PATH.
  * *Windows:* `winget install ffmpeg`
  * *Mac:* `brew install ffmpeg`
  * *Linux:* `sudo apt install ffmpeg`

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/SpecR12/ShortsGPT.git
cd ShortsAI
```
**2. Setup the Backend**

```bash
cd backend
npm install
```
Create a .env file in the backend directory (do NOT commit this file to Git) and add your API Keys:

```bash
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# AI APIs
DEEPSEEK_API_KEY=your_deepseek_key
OPENROUTER_API_KEY=your_openrouter_key
GROQ_API_KEY=your_groq_whisper_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# External APIs
PEXELS_API_KEY=your_pexels_key

# AWS S3 Storage
AWS_REGION=your_region_here
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your_bucket_name
```
Run the backend server:
```bash
npm run dev
```

**3. Setup the Frontend**
```bash
npm install
ng serve
```
Navigate to http://localhost:4200/ in your browser. The application will automatically reload if you change any of the source files.

**🛡️ Security Note**

This project handles sensitive API keys (AWS, ElevenLabs, OpenAI). Never commit your backend/.env file to public repositories. The repository is configured with a .gitignore to prevent this, but always double-check before pushing.

**📝 License**

This project is licensed under the MIT License.

