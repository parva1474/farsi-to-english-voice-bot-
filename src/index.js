const TELEGRAM_BOT_TOKEN = "8963979934:AAGsJV6J7TaA9ruG6SKYZQiFoHfimTjFfUg";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

      if (update.message && update.message.voice) {
        const chatId = update.message.chat.id;
        const fileId = update.message.voice.file_id;
        
        await sendTelegramMessage(chatId, "⏳ ویس شما دریافت شد. در حال شبیه‌سازی صدا و ترجمه...");

        // ۱. دریافت فایل صوتی از تلگرام
        const fileUrl = await getTelegramFileUrl(fileId);
        const audioBuffer = await downloadFile(fileUrl);

        // ۲. تبدیل صوت فارسی به متن با OpenAI Whisper
        const persianText = await transcribeAudioWithOpenAI(audioBuffer, env.OPENAI_API_KEY);
        
        if (!persianText) {
          await sendTelegramMessage(chatId, "خطا در تشخیص متن ویس.");
          return new Response("OK", { status: 200 });
        }

        // ۳. ترجمه متن فارسی به انگلیسی
        const englishText = await translateText(persianText, env.OPENAI_API_KEY);

        // ۴. ساخت صدای آنی (Instant Voice Cloning) از روی ویس کاربر در ElevenLabs
        const tempVoiceId = await createInstantVoice(audioBuffer, env.ELEVENLABS_API_KEY);

        if (!tempVoiceId) {
          await sendTelegramMessage(chatId, "خطا در شبیه‌سازی صدا.");
          return new Response("OK", { status: 200 });
        }

        // ۵. تولید ویس انگلیسی با همان صدای شبیه‌سازی‌شده
        const clonedVoiceBuffer = await generateClonedVoice(englishText, env.ELEVENLABS_API_KEY, tempVoiceId);

        // ۶. ارسال ویس نهایی به کاربر در تلگرام
        await sendTelegramVoice(chatId, clonedVoiceBuffer);

        // ۷. پاکسازی صدای موقت از ایون‌لبز برای جلوگیری از انباشت صداها (اختیاری)
        ctx.waitUntil(deleteInstantVoice(tempVoiceId, env.ELEVENLABS_API_KEY));
      }

      return new Response("OK", { status: 200 });
    } catch (e) {
      return new Response(e.message, { status: 500 });
    }
  },
};

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
}

async function getTelegramFileUrl(fileId) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await res.json();
  const filePath = data.result.file_path;
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}

async function downloadFile(url) {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

async function transcribeAudioWithOpenAI(audioBuffer, apiKey) {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
  formData.append('file', blob, 'voice.ogg');
  formData.append('model', 'whisper-1');
  formData.append('language', 'fa');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });
  const data = await res.json();
  return data.text;
}

async function translateText(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional translator. Translate the following Persian text into natural English. Output only the translated text.' },
        { role: 'user', content: text }
      ]
    })
  });
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function createInstantVoice(audioBuffer, apiKey) {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
  formData.append('name', `UserVoice_${Date.now()}`);
  formData.append('files', blob, 'sample.ogg');

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });
  const data = await res.json();
  return data.voice_id;
}

async function generateClonedVoice(text, apiKey, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  return await res.arrayBuffer();
}

async function sendTelegramVoice(chatId, audioBuffer) {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  formData.append('chat_id', chatId);
  formData.append('voice', blob, 'translated_voice.mp3');

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
    method: 'POST',
    body: formData,
  });
}

async function deleteInstantVoice(voiceId, apiKey) {
  await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey }
  });
}
