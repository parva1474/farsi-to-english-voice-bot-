export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Bot is running!", { status: 200 });
    }

    try {
      const update = await request.json();

      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        // پاسخ تستی به پیام متنی کاربر
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `پیام شما دریافت شد: ${text}`);
      }

      return new Response("OK", { status: 200 });
    } catch (e) {
      return new Response(e.message, { status: 500 });
    }
  },
};

async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_path: chatId, chat_id: chatId, text: text }),
  });
}
