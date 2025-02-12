const TelegramBot = require('node-telegram-bot-api');

// Replace with your Telegram Bot token
const token = '7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHB>

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.toLowerCase() === 'hello') {
    bot.sendMessage(chatId, 'Hi there! How can I assi>
  } else {
    bot.sendMessage(chatId, `You said: "${text}"`);
  }
});
