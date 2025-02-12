const TelegramBot = require('node-telegram-bot-api');

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const token = '7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY';
const bot = new TelegramBot(token, { polling: true });

// Define the password (not case-sensitive)
const PASSWORD = '@MYMINEMC';

// Track users waiting for a password input
const usersAwaitingPassword = {};

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'دوست عزیز';

  bot.sendMessage(chatId, `خوش آمدید ${username}!\n\nبرای دریافت فایل، از دستور /testfile استفاده کنید.`);
});

// Handle /testfile command
bot.onText(/\/testfile/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Send the file
    const filePath = './pack1.txt'; // Ensure this file exists in the same directory
    await bot.sendDocument(chatId, filePath, {
      caption: 'فایل مورد نظر برای شما ارسال شد. 📁\n\nحالا رمز فایل رو وارد کنید.'
    });

    // Ask for the password with a reply keyboard
    const keyboard = {
      reply_markup: JSON.stringify({
        keyboard: [['بازگشت']],
        resize_keyboard: true,
        one_time_keyboard: true
      })
    };

    await bot.sendMessage(chatId, 'رمز فایل رو وارد کنید:', keyboard);

    // Mark the user as awaiting a password
    usersAwaitingPassword[chatId] = true;
  } catch (err) {
    console.error('Error sending file:', err);
    bot.sendMessage(chatId, 'خطایی رخ داد. لطفا دوباره تلاش کنید.');
  }
});

// Handle incoming messages (password input)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase(); // Normalize input to lowercase

  // Check if the user is awaiting a password
  if (usersAwaitingPassword[chatId]) {
    if (text === 'بازگشت') {
      // User chose to go back
      delete usersAwaitingPassword[chatId];
      return bot.sendMessage(chatId, 'عملیات لغو شد. 😊');
    }

    if (text === PASSWORD.toLowerCase()) {
      // Correct password entered
      delete usersAwaitingPassword[chatId];
      return bot.sendMessage(chatId, 'رمز صحیح است! 🎉');
    } else {
      // Incorrect password, ask again
      return bot.sendMessage(chatId, 'رمز اشتباه است. لطفا دوباره وارد کنید:');
    }
  }
});
