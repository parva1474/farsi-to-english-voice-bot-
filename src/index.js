// ============================================================
// Farsi → English Voice Translator + Voice Cloning Bot
// Cloudflare Workers
//
// Secrets required in Cloudflare:
//
// BOT_TOKEN
// OPENAI_API_KEY
// ELEVENLABS_API_KEY
// ============================================================


export default {

  async fetch(request, env, ctx) {

    console.log("========================================");
    console.log("🔥 WORKER STARTED");
    console.log("METHOD:", request.method);
    console.log("URL:", request.url);
    console.log("========================================");


    // ----------------------------------------------------------
    // Check required secrets
    // ----------------------------------------------------------

    if (!env.BOT_TOKEN) {
      console.error("❌ BOT_TOKEN is missing");
      return new Response("BOT_TOKEN is missing", { status: 500 });
    }

    if (!env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY is missing");
      return new Response("OPENAI_API_KEY is missing", { status: 500 });
    }

    if (!env.ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY is missing");
      return new Response("ELEVENLABS_API_KEY is missing", { status: 500 });
    }


    // ----------------------------------------------------------
    // GET request
    // ----------------------------------------------------------

    if (request.method === "GET") {

      console.log("✅ GET request received");

      return new Response(
        "Farsi Voice Translator Bot is running!",
        { status: 200 }
      );
    }


    // ----------------------------------------------------------
    // Only POST is accepted from Telegram
    // ----------------------------------------------------------

    if (request.method !== "POST") {

      console.log("⚠️ Unsupported method:", request.method);

      return new Response("OK", { status: 200 });
    }


    let update = null;

    try {

      // --------------------------------------------------------
      // Read Telegram update
      // --------------------------------------------------------

      update = await request.json();

      console.log("========================================");
      console.log("📩 TELEGRAM UPDATE:");
      console.log(JSON.stringify(update));
      console.log("========================================");


      const message = update?.message;

      if (!message) {

        console.log("⚠️ No message inside update");

        return new Response("OK", { status: 200 });
      }


      const chatId = message.chat?.id;

      if (!chatId) {

        console.error("❌ chat_id not found");

        return new Response("OK", { status: 200 });
      }


      // ========================================================
      // /start
      // ========================================================

      if (message.text === "/start") {

        console.log("🚀 /start received");

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,
          "سلام 👋\n\nویس فارسی خودت را برای من بفرست.\n\nمن:\n🎤 صدای تو را دریافت می‌کنم\n📝 فارسی را به متن تبدیل می‌کنم\n🇬🇧 آن را به انگلیسی طبیعی ترجمه می‌کنم\n🗣️ با صدای خودت انگلیسی صحبت می‌کنم\n\n⏳ لطفاً ویس را ارسال کن."
        );

        console.log("✅ /start response sent");

        return new Response("OK", { status: 200 });
      }


      // ========================================================
      // Text messages
      // ========================================================

      if (message.text) {

        console.log("📝 TEXT RECEIVED:", message.text);

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,
          "🎤 لطفاً یک ویس فارسی برای من بفرست."
        );

        return new Response("OK", { status: 200 });
      }


      // ========================================================
      // Voice
      // ========================================================

      if (message.voice) {

        console.log("🎤 VOICE RECEIVED");

        const fileId = message.voice.file_id;

        console.log("Telegram file_id:", fileId);


        // ------------------------------------------------------
        // Tell user that processing started
        // ------------------------------------------------------

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,
          "⏳ ویس شما دریافت شد.\nدر حال پردازش، ترجمه و ساخت صدای انگلیسی..."
        );


        // ------------------------------------------------------
        // Get Telegram file URL
        // ------------------------------------------------------

        console.log("1️⃣ Getting Telegram file...");

        const fileUrl = await getTelegramFileUrl(
          env.BOT_TOKEN,
          fileId
        );

        console.log("✅ Telegram file URL received");


        // ------------------------------------------------------
        // Download voice
        // ------------------------------------------------------

        console.log("2️⃣ Downloading voice...");

        const audioBuffer = await downloadFile(fileUrl);

        console.log(
          "✅ Voice downloaded. Bytes:",
          audioBuffer.byteLength
        );


        // ------------------------------------------------------
        // Whisper
        // ------------------------------------------------------

        console.log("3️⃣ Sending audio to OpenAI Whisper...");

        const persianText =
          await transcribeAudioWithOpenAI(
            audioBuffer,
            env.OPENAI_API_KEY
          );

        console.log("📝 Persian transcription:", persianText);


        if (!persianText) {

          console.error("❌ Whisper returned empty text");

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,
            "❌ نتوانستم صدای شما را تشخیص بدهم."
          );

          return new Response("OK", { status: 200 });
        }


        // ------------------------------------------------------
        // Translate Persian → English
        // ------------------------------------------------------

        console.log("4️⃣ Translating Persian → English...");

        const englishText =
          await translateText(
            persianText,
            env.OPENAI_API_KEY
          );

        console.log("🇬🇧 English:", englishText);


        if (!englishText) {

          throw new Error(
            "Translation returned empty text"
          );
        }


        // ------------------------------------------------------
        // Show translation to user
        // ------------------------------------------------------

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,
          "🇬🇧 ترجمه:\n\n" + englishText
        );


        // ------------------------------------------------------
        // Clone user's voice
        // ------------------------------------------------------

        console.log("5️⃣ Creating temporary ElevenLabs voice...");

        const tempVoiceId =
          await createInstantVoice(
            audioBuffer,
            env.ELEVENLABS_API_KEY
          );

        console.log(
          "✅ Temporary voice created:",
          tempVoiceId
        );


        if (!tempVoiceId) {

          throw new Error(
            "ElevenLabs did not return a voice_id"
          );
        }


        // ------------------------------------------------------
        // Generate English voice
        // ------------------------------------------------------

        console.log("6️⃣ Generating English speech...");

        const clonedVoiceBuffer =
          await generateClonedVoice(
            englishText,
            env.ELEVENLABS_API_KEY,
            tempVoiceId
          );

        console.log(
          "✅ English audio generated. Bytes:",
          clonedVoiceBuffer.byteLength
        );


        // ------------------------------------------------------
        // Send voice to Telegram
        // ------------------------------------------------------

        console.log("7️⃣ Sending voice to Telegram...");

        await sendTelegramVoice(
          env.BOT_TOKEN,
          chatId,
          clonedVoiceBuffer
        );

        console.log("✅ Voice sent successfully");


        // ------------------------------------------------------
        // Delete temporary ElevenLabs voice
        // ------------------------------------------------------

        ctx.waitUntil(
          deleteInstantVoice(
            tempVoiceId,
            env.ELEVENLABS_API_KEY
          )
        );

        console.log(
          "🗑️ Temporary ElevenLabs voice deletion scheduled"
        );


        return new Response("OK", { status: 200 });
      }


      // ========================================================
      // Unsupported Telegram message
      // ========================================================

      console.log("⚠️ Unsupported Telegram message type");

      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,
        "🎤 فقط ویس فارسی ارسال کن."
      );


      return new Response("OK", { status: 200 });


    } catch (error) {

      console.error("========================================");
      console.error("❌ WORKER ERROR");
      console.error(error);
      console.error("MESSAGE:", error?.message);
      console.error("STACK:", error?.stack);
      console.error("========================================");


      // --------------------------------------------------------
      // Try to notify user
      // --------------------------------------------------------

      try {

        const chatId =
          update?.message?.chat?.id;

        if (chatId) {

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,
            "❌ متأسفانه هنگام پردازش ویس خطایی رخ داد.\n\nلطفاً دوباره امتحان کن."
          );

        }

      } catch (telegramError) {

        console.error(
          "❌ ERROR SENDING ERROR MESSAGE:",
          telegramError
        );
      }


      // Telegram should receive 200
      return new Response("OK", { status: 200 });
    }
  }
};


// ============================================================
// Telegram: sendMessage
// ============================================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {

  console.log("📨 Telegram sendMessage");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    }
  );


  const data = await response.json();

  console.log(
    "Telegram sendMessage response:",
    JSON.stringify(data)
  );


  if (!response.ok || !data.ok) {

    throw new Error(
      "Telegram sendMessage failed: " +
      JSON.stringify(data)
    );
  }

  return data;
}


// ============================================================
// Telegram: getFile
// ============================================================

async function getTelegramFileUrl(
  token,
  fileId
) {

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
  );


  const data = await response.json();

  console.log(
    "Telegram getFile response:",
    JSON.stringify(data)
  );


  if (!response.ok || !data.ok) {

    throw new Error(
      "Telegram getFile failed: " +
      JSON.stringify(data)
    );
  }


  const filePath = data.result.file_path;


  return (
    `https://api.telegram.org/file/bot${token}/${filePath}`
  );
}


// ============================================================
// Download Telegram voice
// ============================================================

async function downloadFile(url) {

  const response = await fetch(url);

  console.log(
    "Telegram download status:",
    response.status
  );


  if (!response.ok) {

    throw new Error(
      `Telegram audio download failed: ${response.status}`
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

  const formData = new FormData();


  const blob = new Blob(
    [audioBuffer],
    {
      type: "audio/ogg"
    }
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


  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${apiKey}`
      },

      body: formData
    }
  );


  const data = await response.json();


  console.log(
    "OpenAI Whisper response:",
    JSON.stringify(data)
  );


  if (!response.ok) {

    throw new Error(
      "OpenAI Whisper failed: " +
      JSON.stringify(data)
    );
  }


  return data.text || "";
}


// ============================================================
// OpenAI Translation
// ============================================================

async function translateText(
  text,
  apiKey
) {

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",

            content:
              "You are a professional Persian to English translator. " +
              "Translate the Persian text into natural, fluent, spoken English. " +
              "Preserve the meaning and emotion. " +
              "Do not explain anything. " +
              "Output only the English translation."
          },

          {
            role: "user",
            content: text
          }

        ]

      })
    }
  );


  const data = await response.json();


  console.log(
    "OpenAI translation response:",
    JSON.stringify(data)
  );


  if (!response.ok) {

    throw new Error(
      "OpenAI translation failed: " +
      JSON.stringify(data)
    );
  }


  return (
    data?.choices?.[0]?.message?.content?.trim() ||
    ""
  );
}


// ============================================================
// ElevenLabs: Create temporary voice clone
// ============================================================

async function createInstantVoice(
  audioBuffer,
  apiKey
) {

  const formData = new FormData();


  const blob = new Blob(
    [audioBuffer],
    {
      type: "audio/ogg"
    }
  );


  formData.append(
    "name",
    `TemporaryUserVoice_${Date.now()}`
  );


  formData.append(
    "files",
    blob,
    "voice.ogg"
  );


  const response = await fetch(
    "https://api.elevenlabs.io/v1/voices/add",
    {
      method: "POST",

      headers: {
        "xi-api-key": apiKey
      },

      body: formData
    }
  );


  const data = await response.json();


  console.log(
    "ElevenLabs voice creation response:",
    JSON.stringify(data)
  );


  if (!response.ok) {

    throw new Error(
      "ElevenLabs voice creation failed: " +
      JSON.stringify(data)
    );
  }


  return data.voice_id;
}


// ============================================================
// ElevenLabs: Text → Speech
// ============================================================

async function generateClonedVoice(
  text,
  apiKey,
  voiceId
) {

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",

      headers: {

        "xi-api-key": apiKey,

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

    console.error(
      "ElevenLabs TTS error:",
      errorText
    );


    throw new Error(
      "ElevenLabs TTS failed: " +
      errorText
    );
  }


  return await response.arrayBuffer();
}


// ============================================================
// Telegram: sendVoice
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
      {
        type: "audio/mpeg"
      }
    );


  formData.append(
    "chat_id",
    chatId
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


  const data =
    await response.json();


  console.log(
    "Telegram sendVoice response:",
    JSON.stringify(data)
  );


  if (!response.ok || !data.ok) {

    throw new Error(
      "Telegram sendVoice failed: " +
      JSON.stringify(data)
    );
  }


  return data;
}


// ============================================================
// ElevenLabs: Delete temporary voice
// ============================================================

async function deleteInstantVoice(
  voiceId,
  apiKey
) {

  try {

    console.log(
      "🗑️ Deleting temporary voice:",
      voiceId
    );


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


    const text =
      await response.text();


    console.log(
      "ElevenLabs delete response:",
      response.status,
      text
    );


  } catch (error) {

    console.error(
      "❌ Temporary voice deletion failed:",
      error
    );
  }
  }
