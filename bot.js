const TelegramBot = require('node-telegram-bot-api');
const token = '7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY';
const bot = new TelegramBot(token, { polling: true });

// Test file sending
bot.onText(/\/testfile/, (msg) => {
  const filePath = './pack1.txt';
  bot.sendDocument(msg.chat.id, filePath, {
    caption: 'فایل آزمایشی ارسال شد! 📁'
  });
});

// Test membership check
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const member = await bot.getChatMember('@MYMINEMC', userId);
    const isMember = ['creator', 'administrator', 'member'].includes(member.status);

    if (isMember) {
      bot.sendMessage(chatId, 'شما عضو کانال هستید! 😊');
    } else {
      bot.sendMessage(chatId, 'شما عضو کانال نیستید. لطفا عضو شوید:\n\n@MYMINEMC');
    }
  } catch (err) {
    console.error('Error checking membership:', err);
    bot.sendMessage(chatId, 'خطایی رخ داد. لطفا دوباره تلاش کنید.');
  }
});
