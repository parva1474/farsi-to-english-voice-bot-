// ============================================================
// Farsi → English Voice Bot
// Cloudflare Workers
//
// امکانات:
// /start
// پیام متنی
// دریافت Voice فارسی
// تبدیل Voice به متن با OpenAI
// ترجمه فارسی → انگلیسی
// Clone موقت صدا با ElevenLabs
// تولید Voice انگلیسی
// ارسال Voice به Telegram
// حذف Voice موقت
//
// Cloudflare Secrets:
// BOT_TOKEN
// OPENAI_API_KEY
// ELEVENLABS_API_KEY
// ============================================================


export default {

  async fetch(request, env, ctx) {

    // --------------------------------------------------------
    // فقط POST
    // --------------------------------------------------------

    if (request.method !== "POST") {
      return new Response(
        "Farsi → English Voice Bot is running!",
        { status: 200 }
      );
    }


    try {

      // ------------------------------------------------------
      // دریافت Update تلگرام
      // ------------------------------------------------------

      const update = await request.json();

      console.log(
        "TELEGRAM UPDATE:",
        JSON.stringify(update)
      );


      // ------------------------------------------------------
      // بررسی Token
      // ------------------------------------------------------

      if (!env.BOT_TOKEN) {
        throw new Error(
          "BOT_TOKEN secret is missing"
        );
      }


      // ------------------------------------------------------
      // اگر پیام وجود ندارد
      // ------------------------------------------------------

      if (!update.message) {

        console.log(
          "Update has no message"
        );

        return new Response(
          "OK",
          { status: 200 }
        );
      }


      const message = update.message;
      const chatId = message.chat?.id;


      if (!chatId) {

        console.log(
          "Chat ID not found"
        );

        return new Response(
          "OK",
          { status: 200 }
        );
      }


      // ======================================================
      // MESSAGE TEXT
      // ======================================================

      if (typeof message.text === "string") {

        const text = message.text.trim();

        console.log(
          "TEXT RECEIVED:",
          text
        );


        // ----------------------------------------------------
        // /start
        // ----------------------------------------------------

        if (
          text === "/start" ||
          text.startsWith("/start ")
        ) {

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "سلام 👋\n\n" +
            "به ربات تبدیل فارسی به انگلیسی خوش آمدید.\n\n" +

            "🎤 یک ویس فارسی برای من ارسال کنید.\n\n" +

            "من:\n" +
            "1️⃣ صدای شما را به متن تبدیل می‌کنم\n" +
            "2️⃣ متن فارسی را به انگلیسی ترجمه می‌کنم\n" +
            "3️⃣ صدای شما را شبیه‌سازی می‌کنم\n" +
            "4️⃣ ترجمه انگلیسی را با صدای شما برایتان می‌فرستم\n\n" +

            "🎤 حالا یک ویس فارسی بفرستید."
          );

          console.log(
            "START RESPONSE SENT"
          );

          return new Response(
            "OK",
            { status: 200 }
          );
        }


        // ----------------------------------------------------
        // سایر پیام‌های متنی
        // ----------------------------------------------------

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "لطفاً یک ویس فارسی برای من ارسال کنید 🎤"
        );


        return new Response(
          "OK",
          { status: 200 }
        );
      }


      // ======================================================
      // VOICE
      // ======================================================

      if (message.voice) {

        const fileId =
          message.voice.file_id;


        console.log(
          "VOICE RECEIVED:",
          fileId
        );


        // ----------------------------------------------------
        // پیام اولیه
        // ----------------------------------------------------

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "⏳ ویس شما دریافت شد.\n\n" +
          "در حال تبدیل، ترجمه و ساخت صدای انگلیسی..."
        );


        // ====================================================
        // 1. Telegram File
        // ====================================================

        console.log(
          "STEP 1: Getting Telegram file..."
        );


        const fileUrl =
          await getTelegramFileUrl(
            env.BOT_TOKEN,
            fileId
          );


        console.log(
          "Telegram file URL received"
        );


        // ====================================================
        // 2. Download audio
        // ====================================================

        console.log(
          "STEP 2: Downloading audio..."
        );


        const audioBuffer =
          await downloadFile(fileUrl);


        console.log(
          "Audio downloaded:",
          audioBuffer.byteLength,
          "bytes"
        );


        if (!audioBuffer.byteLength) {

          throw new Error(
            "Downloaded audio is empty"
          );
        }


        // ====================================================
        // 3. Speech → Persian Text
        // ====================================================

        console.log(
          "STEP 3: Transcribing audio..."
        );


        const persianText =
          await transcribeAudioWithOpenAI(
            audioBuffer,
            env.OPENAI_API_KEY
          );


        console.log(
          "PERSIAN TEXT:",
          persianText
        );


        if (!persianText) {

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ متأسفانه نتوانستم صدای شما را تشخیص دهم."
          );


          return new Response(
            "OK",
            { status: 200 }
          );
        }


        // ====================================================
        // 4. Persian → English
        // ====================================================

        console.log(
          "STEP 4: Translating..."
        );


        const englishText =
          await translateText(
            persianText,
            env.OPENAI_API_KEY
          );


        console.log(
          "ENGLISH TEXT:",
          englishText
        );


        if (!englishText) {

          throw new Error(
            "Translation returned empty text"
          );
        }


        // ====================================================
        // 5. Clone voice
        // ====================================================

        console.log(
          "STEP 5: Creating temporary voice..."
        );


        const tempVoiceId =
          await createInstantVoice(
            audioBuffer,
            env.ELEVENLABS_API_KEY
          );


        console.log(
          "TEMP VOICE ID:",
          tempVoiceId
        );


        if (!tempVoiceId) {

          throw new Error(
            "ElevenLabs did not return a voice_id"
          );
        }


        // ====================================================
        // 6. Generate English voice
        // ====================================================

        console.log(
          "STEP 6: Generating English voice..."
        );


        const clonedVoiceBuffer =
          await generateClonedVoice(
            englishText,
            env.ELEVENLABS_API_KEY,
            tempVoiceId
          );


        console.log(
          "Generated audio:",
          clonedVoiceBuffer.byteLength,
          "bytes"
        );


        if (!clonedVoiceBuffer.byteLength) {

          throw new Error(
            "Generated audio is empty"
          );
        }


        // ====================================================
        // 7. Send Voice to Telegram
        // ====================================================

        console.log(
          "STEP 7: Sending voice to Telegram..."
        );


        await sendTelegramVoice(
          env.BOT_TOKEN,
          chatId,
          clonedVoiceBuffer
        );


        console.log(
          "VOICE SENT SUCCESSFULLY"
        );


        // ====================================================
        // 8. Delete temporary ElevenLabs voice
        // ====================================================

        ctx.waitUntil(

          deleteInstantVoice(
            tempVoiceId,
            env.ELEVENLABS_API_KEY
          )

        );


        return new Response(
          "OK",
          { status: 200 }
        );
      }


      // ------------------------------------------------------
      // سایر انواع پیام
      // ------------------------------------------------------

      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,

        "🎤 لطفاً یک ویس فارسی برای من ارسال کنید."
      );


      return new Response(
        "OK",
        { status: 200 }
      );


    } catch (error) {

      // ======================================================
      // GLOBAL ERROR
      // ======================================================

      console.error(
        "================================"
      );

      console.error(
        "WORKER ERROR:"
      );

      console.error(
        error?.stack || error?.message || error
      );

      console.error(
        "================================"
      );


      // ------------------------------------------------------
      // اگر Chat ID داریم، خطا را به کاربر اعلام کن
      // ------------------------------------------------------

      try {

        const updateSafe = update;

        const chatId =
          updateSafe?.message?.chat?.id;


        if (chatId && env.BOT_TOKEN) {

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ متأسفانه هنگام پردازش درخواست مشکلی پیش آمد.\n\n" +
            "لطفاً دوباره تلاش کنید."
          );
        }

      } catch (sendError) {

        console.error(
          "ERROR SENDING ERROR MESSAGE:",
          sendError?.message || sendError
        );
      }


      // ------------------------------------------------------
      // همیشه 200 برای Telegram webhook
      // ------------------------------------------------------

      return new Response(
        "OK",
        { status: 200 }
      );
    }
  }
};


// ============================================================
// Telegram API
// ============================================================


async function telegramRequest(
  token,
  method,
  body
) {

  const url =
    `https://api.telegram.org/bot${token}/${method}`;


  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(body)
    });


  const text =
    await response.text();


  let data;

  try {

    data = JSON.parse(text);

  } catch {

    throw new Error(
      `Telegram ${method}: invalid JSON response: ${text}`
    );
  }


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      `Telegram ${method} failed: ${text}`
    );
  }


  return data;
}


// ============================================================
// Send Telegram Message
// ============================================================


async function sendTelegramMessage(
  token,
  chatId,
  text
) {

  return await telegramRequest(
    token,
    "sendMessage",
    {
      chat_id: chatId,
      text: text
    }
  );
}


// ============================================================
// Get Telegram File URL
// ============================================================


async function getTelegramFileUrl(
  token,
  fileId
) {

  const data =
    await telegramRequest(
      token,
      "getFile",
      {
        file_id: fileId
      }
    );


  const filePath =
    data.result?.file_path;


  if (!filePath) {

    throw new Error(
      "Telegram getFile returned no file_path"
    );
  }


  return (
    `https://api.telegram.org/file/bot${token}/${filePath}`
  );
}


// ============================================================
// Download Telegram Audio
// ============================================================


async function downloadFile(url) {

  const response =
    await fetch(url);


  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `Audio download failed: ${response.status} ${text}`
    );
  }


  return await response.arrayBuffer();
}


// ============================================================
// OpenAI Whisper
// ============================================================


async function transcribeAudioWithOpenAI(
  audioBuffer,
  apiKey
) {

  if (!apiKey) {

    throw new Error(
      "OPENAI_API_KEY secret is missing"
    );
  }


  const formData =
    new FormData();


  const blob =
    new Blob(
      [audioBuffer],
      { type: "audio/ogg" }
    );


  formData.append(
    "file",
    blob,
    "voice.ogg"
  );


  formData.append(
    "model",
    "whisper-1"
  );


  formData.append(
    "language",
    "fa"
  );


  const response =
    await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {

        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${apiKey}`
        },

        body: formData
      }
    );


  const text =
    await response.text();


  let data;

  try {

    data = JSON.parse(text);

  } catch {

    throw new Error(
      `OpenAI transcription invalid response: ${text}`
    );
  }


  if (!response.ok) {

    throw new Error(
      `OpenAI transcription failed: ${text}`
    );
  }


  if (!data.text) {

    throw new Error(
      "OpenAI transcription returned no text"
    );
  }


  return data.text.trim();
}


// ============================================================
// Translate Persian → English
// ============================================================


async function translateText(
  text,
  apiKey
) {

  if (!apiKey) {

    throw new Error(
      "OPENAI_API_KEY secret is missing"
    );
  }


  const response =
    await fetch(
      "https://api.openai.com/v1/chat/completions",
      {

        method: "POST",

        headers: {

          "Authorization":
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          model:
            "gpt-4o-mini",

          messages: [

            {
              role: "system",

              content:
                "You are a professional Persian to English translator. Translate the Persian text into natural, conversational English. Preserve the meaning and tone. Output only the English translation."
            },

            {
              role: "user",

              content: text
            }

          ],

          temperature: 0.2
        })
      }
    );


  const responseText =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(responseText);

  } catch {

    throw new Error(
      `OpenAI translation invalid response: ${responseText}`
    );
  }


  if (!response.ok) {

    throw new Error(
      `OpenAI translation failed: ${responseText}`
    );
  }


  const result =
    data?.choices?.[0]?.message?.content;


  if (!result) {

    throw new Error(
      "OpenAI translation returned empty result"
    );
  }


  return result.trim();
}


// ============================================================
// ElevenLabs Instant Voice Clone
// ============================================================


async function createInstantVoice(
  audioBuffer,
  apiKey
) {

  if (!apiKey) {

    throw new Error(
      "ELEVENLABS_API_KEY secret is missing"
    );
  }


  const formData =
    new FormData();


  const blob =
    new Blob(
      [audioBuffer],
      { type: "audio/ogg" }
    );


  formData.append(
    "name",
    `UserVoice_${Date.now()}`
  );


  formData.append(
    "files",
    blob,
    "sample.ogg"
  );


  const response =
    await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {

        method: "POST",

        headers: {
          "xi-api-key": apiKey
        },

        body: formData
      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `ElevenLabs clone invalid response: ${text}`
    );
  }


  if (!response.ok) {

    throw new Error(
      `ElevenLabs clone failed: ${response.status} ${text}`
    );
  }


  if (!data.voice_id) {

    throw new Error(
      `ElevenLabs clone returned no voice_id: ${text}`
    );
  }


  return data.voice_id;
}


// ============================================================
// Generate English Speech
// ============================================================


async function generateClonedVoice(
  text,
  apiKey,
  voiceId
) {

  const response =
    await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {

        method: "POST",

        headers: {

          "xi-api-key":
            apiKey,

          "Content-Type":
            "application/json",

          "Accept":
            "audio/mpeg"
        },

        body: JSON.stringify({

          text: text,

          model_id:
            "eleven_multilingual_v2",

          voice_settings: {

            stability: 0.5,

            similarity_boost: 0.75
          }
        })
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `ElevenLabs TTS failed: ${response.status} ${errorText}`
    );
  }


  return await response.arrayBuffer();
}


// ============================================================
// Send Voice to Telegram
// ============================================================


async function sendTelegramVoice(
  token,
  chatId,
  audioBuffer
) {

  const formData =
    new FormData();


  const blob =
    new Blob(
      [audioBuffer],
      { type: "audio/mpeg" }
    );


  formData.append(
    "chat_id",
    String(chatId)
  );


  formData.append(
    "voice",
    blob,
    "translated_voice.mp3"
  );


  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendVoice`,
      {

        method: "POST",

        body: formData
      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      `Telegram sendVoice invalid response: ${text}`
    );
  }


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      `Telegram sendVoice failed: ${text}`
    );
  }


  return data;
}


// ============================================================
// Delete Temporary ElevenLabs Voice
// ============================================================


async function deleteInstantVoice(
  voiceId,
  apiKey
) {

  try {

    const response =
      await fetch(
        `https://api.elevenlabs.io/v1/voices/${voiceId}`,
        {

          method: "DELETE",

          headers: {
            "xi-api-key": apiKey
          }
        }
      );


    if (!response.ok) {

      const text =
        await response.text();

      console.error(
        "ElevenLabs voice deletion failed:",
        response.status,
        text
      );

      return;
    }


    console.log(
      "Temporary voice deleted:",
      voiceId
    );

  } catch (error) {

    console.error(
      "Voice deletion error:",
      error?.message || error
    );
  }
          }
