const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config(); // If you're using .env for token storage

// Replace with your bot token
const token = process.env.BOT_TOKEN || '7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY';
const bot = new TelegramBot(token, { polling: true });

// Channel username to check membership
const channelUsername = '@MYMINEMC';

// Special start command parameter (e.g., "getFIle1")
const specialStartParam = 'getfile'; // Change this to your desired parameter

// File name for the special start command
const fileName = 'pack1.txt'; // Change this to your desired file name

// Function to check if the user is a member of the channel
async function isUserMember(userId) {
  try {
    const chatMember = await bot.getChatMember(channelUsername, userId);
    return ['creator', 'administrator', 'member'].includes(chatMember.status);
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
}

// Handle /start command
bot.onText(/\/start/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;

  // Extract the start parameter if it exists
  const startParam = match[0].split(' ')[1];

  // Check if the user is already a member of the channel
  const isMember = await isUserMember(userId);

  if (!isMember && startParam !== specialStartParam) {
    // User is not a member, prompt them to join
    const message = '⚠️ لطفاً ابتدا در کانال ما عضو شوید تا از خدمات ربات استفاده کنید! ⚠️';

    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'لینک چنل', url: `https://t.me/${channelUsername.slice(1)}` }],
          [{ text: 'چک کردن عضویت ✅', callback_data: 'check_membership' }]
        ]
      })
    };

    bot.sendMessage(chatId, message, options);
  } else if (isMember && startParam !== specialStartParam) {
    // User is a member, proceed with the normal start command
    bot.sendMessage(chatId, `سلام ${username}! 🌟\n\nخوش آمدید به ربات ما. 😊`);
  } else if (startParam === specialStartParam) {
    // Handle the special start command with file sharing
    handleSpecialStart(chatId, fileName);
  }
});

// Handle inline button callback
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;

  if (query.data === 'check_membership') {
    const isMember = await isUserMember(userId);

    if (isMember) {
      // User is now a member, remove the join message
      bot.deleteMessage(chatId, messageId)
        .then(() => {
          bot.sendMessage(chatId, `سلام ${query.from.username}! 🌟\n\nخوش آمدید به ربات ما. 😊`);
        })
        .catch((err) => {
          console.error('Error deleting message:', err);
        });
    } else {
      // User is still not a member, notify them
      bot.editMessageText('❌ لطفاً ابتدا در کانال ما عضو شوید! ❌', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }
});

// Handle special start command with file sharing
function handleSpecialStart(chatId, fileName) {
  try {
    // Path to the file in the bot's directory
    const filePath = `./${fileName}`; // Ensure this file exists in the same directory as the script

    // Send the file to the user
    bot.sendDocument(chatId, filePath, {
      caption: '📦 فایل مورد نظر برای شما آماده شد! 📦'
    });
  } catch (error) {
    console.error('Error sending file:', error);
    bot.sendMessage(chatId, '❌ متاسفانه فایل مورد نظر پیدا نشد. ❌');
  }
}
