// ============================================================
// Farsi → English Voice Translator + Voice Cloning Bot
// Cloudflare Workers
//
// Required Cloudflare Secrets:
//
// BOT_TOKEN
// OPENAI_API_KEY
// ELEVENLABS_API_KEY
// ============================================================


export default {

  async fetch(request, env, ctx) {

    // ==========================================================
    // 1. BASIC REQUEST LOG
    // ==========================================================

    console.log("========================================");
    console.log("🔥 FARSİ VOICE BOT STARTED");
    console.log("METHOD:", request.method);
    console.log("URL:", request.url);
    console.log("========================================");


    // ==========================================================
    // 2. SECRET AVAILABILITY TEST
    // IMPORTANT:
    // We NEVER print the actual secret values.
    // Only true / false is logged.
    // ==========================================================

    const hasBotToken =
      typeof env.BOT_TOKEN === "string" &&
      env.BOT_TOKEN.length > 0;

    const hasOpenAIKey =
      typeof env.OPENAI_API_KEY === "string" &&
      env.OPENAI_API_KEY.length > 0;

    const hasElevenLabsKey =
      typeof env.ELEVENLABS_API_KEY === "string" &&
      env.ELEVENLABS_API_KEY.length > 0;


    console.log("🔐 SECRET TEST");
    console.log("BOT_TOKEN:", hasBotToken);
    console.log("OPENAI_API_KEY:", hasOpenAIKey);
    console.log("ELEVENLABS_API_KEY:", hasElevenLabsKey);
    console.log("========================================");


    // ==========================================================
    // 3. GET REQUEST
    // ==========================================================

    if (request.method === "GET") {

      console.log("✅ GET request received");

      return new Response(
        "Farsi Voice Translator Bot is running!",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8"
          }
        }
      );
    }


    // ==========================================================
    // 4. TELEGRAM REQUIRES BOT TOKEN
    // ==========================================================

    if (!hasBotToken) {

      console.error("❌ BOT_TOKEN is NOT available in env");

      return new Response(
        "BOT_TOKEN is missing",
        { status: 500 }
      );
    }


    // ==========================================================
    // 5. ONLY POST IS EXPECTED FROM TELEGRAM
    // ==========================================================

    if (request.method !== "POST") {

      console.log(
        "⚠️ Unsupported HTTP method:",
        request.method
      );

      return new Response("OK", {
        status: 200
      });
    }


    // ==========================================================
    // 6. READ TELEGRAM UPDATE
    // ==========================================================

    let update = null;

    try {

      update = await request.json();

      console.log("📩 TELEGRAM UPDATE RECEIVED");

      console.log(
        JSON.stringify(update)
      );


      // ========================================================
      // 7. MESSAGE CHECK
      // ========================================================

      const message = update?.message;

      if (!message) {

        console.log(
          "⚠️ Telegram update has no message"
        );

        return new Response("OK", {
          status: 200
        });
      }


      const chatId =
        message?.chat?.id;


      if (!chatId) {

        console.error(
          "❌ chat_id not found"
        );

        return new Response("OK", {
          status: 200
        });
      }


      console.log(
        "💬 CHAT ID:",
        chatId
      );


      // ========================================================
      // 8. /start
      // ========================================================

      if (
        typeof message.text === "string" &&
        message.text.trim() === "/start"
      ) {

        console.log("🚀 /start RECEIVED");


        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "سلام 👋\n\n" +
          "ویس فارسی خودت را برای من بفرست.\n\n" +

          "من:\n" +
          "🎤 صدای تو را دریافت می‌کنم\n" +
          "📝 فارسی را به متن تبدیل می‌کنم\n" +
          "🇬🇧 آن را به انگلیسی طبیعی ترجمه می‌کنم\n" +
          "🗣️ با صدای خودت انگلیسی صحبت می‌کنم\n\n" +

          "⏳ لطفاً ویس را ارسال کن."
        );


        console.log(
          "✅ /start RESPONSE SENT"
        );


        return new Response("OK", {
          status: 200
        });
      }


      // ========================================================
      // 9. OTHER TEXT MESSAGES
      // ========================================================

      if (
        typeof message.text === "string"
      ) {

        console.log(
          "📝 TEXT RECEIVED:",
          message.text
        );


        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "🎤 لطفاً یک ویس فارسی برای من بفرست."
        );


        console.log(
          "✅ TEXT RESPONSE SENT"
        );


        return new Response("OK", {
          status: 200
        });
      }


      // ========================================================
      // 10. VOICE
      // ========================================================

      if (message.voice) {

        console.log("========================================");
        console.log("🎤 VOICE RECEIVED");
        console.log("========================================");


        // ------------------------------------------------------
        // Check APIs required for voice processing
        // ------------------------------------------------------

        if (!hasOpenAIKey) {

          console.error(
            "❌ OPENAI_API_KEY is missing"
          );


          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ کلید OpenAI روی سرور تنظیم نشده است."
          );


          return new Response("OK", {
            status: 200
          });
        }


        if (!hasElevenLabsKey) {

          console.error(
            "❌ ELEVENLABS_API_KEY is missing"
          );


          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ کلید ElevenLabs روی سرور تنظیم نشده است."
          );


          return new Response("OK", {
            status: 200
          });
        }


        const fileId =
          message.voice.file_id;


        console.log(
          "Telegram file_id:",
          fileId
        );


        // ------------------------------------------------------
        // Processing message
        // ------------------------------------------------------

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "⏳ ویس شما دریافت شد.\n" +
          "در حال پردازش، ترجمه و ساخت صدای انگلیسی..."
        );


        // ======================================================
        // STEP 1 — Telegram getFile
        // ======================================================

        console.log(
          "1️⃣ Getting Telegram file..."
        );


        const fileUrl =
          await getTelegramFileUrl(
            env.BOT_TOKEN,
            fileId
          );


        console.log(
          "✅ Telegram file URL received"
        );


        // ======================================================
        // STEP 2 — Download voice
        // ======================================================

        console.log(
          "2️⃣ Downloading voice..."
        );


        const audioBuffer =
          await downloadFile(fileUrl);


        console.log(
          "✅ Voice downloaded. Bytes:",
          audioBuffer.byteLength
        );


        // ======================================================
        // STEP 3 — Whisper
        // ======================================================

        console.log(
          "3️⃣ Sending audio to OpenAI Whisper..."
        );


        const persianText =
          await transcribeAudioWithOpenAI(
            audioBuffer,
            env.OPENAI_API_KEY
          );


        console.log(
          "📝 Persian transcription:",
          persianText
        );


        if (!persianText) {

          console.error(
            "❌ Whisper returned empty text"
          );


          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ نتوانستم صدای شما را تشخیص بدهم."
          );


          return new Response("OK", {
            status: 200
          });
        }


        // ======================================================
        // STEP 4 — Persian → English
        // ======================================================

        console.log(
          "4️⃣ Translating Persian → English..."
        );


        const englishText =
          await translateText(
            persianText,
            env.OPENAI_API_KEY
          );


        console.log(
          "🇬🇧 English:",
          englishText
        );


        if (!englishText) {

          throw new Error(
            "Translation returned empty text"
          );
        }


        // ======================================================
        // STEP 5 — Show translation
        // ======================================================

        await sendTelegramMessage(
          env.BOT_TOKEN,
          chatId,

          "🇬🇧 ترجمه:\n\n" +
          englishText
        );


        // ======================================================
        // STEP 6 — Clone voice
        // ======================================================

        console.log(
          "5️⃣ Creating temporary ElevenLabs voice..."
        );


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


        // ======================================================
        // STEP 7 — Generate English speech
        // ======================================================

        console.log(
          "6️⃣ Generating English speech..."
        );


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


        // ======================================================
        // STEP 8 — Send voice to Telegram
        // ======================================================

        console.log(
          "7️⃣ Sending voice to Telegram..."
        );


        await sendTelegramVoice(
          env.BOT_TOKEN,
          chatId,
          clonedVoiceBuffer
        );


        console.log(
          "✅ VOICE SENT SUCCESSFULLY"
        );


        // ======================================================
        // STEP 9 — Delete temporary voice
        // ======================================================

        ctx.waitUntil(
          deleteInstantVoice(
            tempVoiceId,
            env.ELEVENLABS_API_KEY
          )
        );


        console.log(
          "🗑️ Temporary voice deletion scheduled"
        );


        return new Response("OK", {
          status: 200
        });
      }


      // ========================================================
      // 11. UNSUPPORTED MESSAGE TYPE
      // ========================================================

      console.log(
        "⚠️ Unsupported Telegram message type"
      );


      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,

        "🎤 فقط ویس فارسی ارسال کن."
      );


      return new Response("OK", {
        status: 200
      });


    } catch (error) {

      // ========================================================
      // ERROR HANDLER
      // ========================================================

      console.error(
        "========================================"
      );

      console.error(
        "❌ BOT ERROR"
      );

      console.error(
        "ERROR MESSAGE:",
        error?.message
      );

      console.error(
        "ERROR STACK:",
        error?.stack
      );

      console.error(
        "========================================"
      );


      // --------------------------------------------------------
      // Try to notify Telegram user
      // --------------------------------------------------------

      try {

        const chatId =
          update?.message?.chat?.id;


        if (
          chatId &&
          hasBotToken
        ) {

          await sendTelegramMessage(
            env.BOT_TOKEN,
            chatId,

            "❌ متأسفانه هنگام پردازش ویس خطایی رخ داد.\n\n" +
            "لطفاً دوباره امتحان کن."
          );
        }

      } catch (telegramError) {

        console.error(
          "❌ ERROR SENDING ERROR MESSAGE:",
          telegramError?.message
        );
      }


      // Telegram should receive 200
      return new Response("OK", {
        status: 200
      });
    }
  }
};


// ============================================================
// Telegram — sendMessage
// ============================================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {

  console.log(
    "📨 Telegram sendMessage"
  );


  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          chat_id: chatId,
          text: text
        })
      }
    );


  const data =
    await response.json();


  console.log(
    "Telegram sendMessage status:",
    response.status
  );


  console.log(
    "Telegram sendMessage ok:",
    data?.ok
  );


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      "Telegram sendMessage failed: " +
      JSON.stringify(data)
    );
  }


  return data;
}


// ============================================================
// Telegram — getFile
// ============================================================

async function getTelegramFileUrl(
  token,
  fileId
) {

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
    );


  const data =
    await response.json();


  console.log(
    "Telegram getFile status:",
    response.status
  );


  console.log(
    "Telegram getFile ok:",
    data?.ok
  );


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      "Telegram getFile failed: " +
      JSON.stringify(data)
    );
  }


  const filePath =
    data.result.file_path;


  return (
    `https://api.telegram.org/file/bot${token}/${filePath}`
  );
}


// ============================================================
// Download Telegram voice
// ============================================================

async function downloadFile(url) {

  const response =
    await fetch(url);


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
// OpenAI — Whisper
// ============================================================

async function transcribeAudioWithOpenAI(
  audioBuffer,
  apiKey
) {

  const formData =
    new FormData();


  const blob =
    new Blob(
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


  const data =
    await response.json();


  console.log(
    "OpenAI Whisper status:",
    response.status
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
// OpenAI — Translation
// ============================================================

async function translateText(
  text,
  apiKey
) {

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


  const data =
    await response.json();


  console.log(
    "OpenAI translation status:",
    response.status
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
// ElevenLabs — Create temporary voice clone
// ============================================================

async function createInstantVoice(
  audioBuffer,
  apiKey
) {

  const formData =
    new FormData();


  const blob =
    new Blob(
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


  const response =
    await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        method: "POST",

        headers: {
          "xi-api-key":
            apiKey
        },

        body: formData
      }
    );


  const data =
    await response.json();


  console.log(
    "ElevenLabs voice creation status:",
    response.status
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
// ElevenLabs — Text → Speech
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

            stability:
              0.5,

            similarity_boost:
              0.75
          }

        })
      }
    );


  if (!response.ok) {

    const errorText =
      await response.text();


    console.error(
      "ElevenLabs TTS status:",
      response.status
    );


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
// Telegram — sendVoice
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
    "Telegram sendVoice status:",
    response.status
  );


  console.log(
    "Telegram sendVoice ok:",
    data?.ok
  );


  if (
    !response.ok ||
    !data.ok
  ) {

    throw new Error(
      "Telegram sendVoice failed: " +
      JSON.stringify(data)
    );
  }


  return data;
}


// ============================================================
// ElevenLabs — Delete temporary voice
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
            "xi-api-key":
              apiKey
          }
        }
      );


    const text =
      await response.text();


    console.log(
      "ElevenLabs delete status:",
      response.status
    );


    console.log(
      "ElevenLabs delete response:",
      text
    );

  } catch (error) {

    console.error(
      "❌ Temporary voice deletion failed:",
      error?.message
    );
  }
}
