const TelegramBot = require('node-telegram-bot-api');

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const token = '7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY';
const bot = new TelegramBot(token, { polling: true });

// Channel username to check membership
const channelUsername = '@MYMINEMC';

// Function to check if the user is a member of the channel
function isUserMember(chatId, userId) {
  return new Promise((resolve, reject) => {
    bot.getChatMember(channelUsername, userId)
      .then(member => {
        const status = member.status;
        resolve(['creator', 'administrator', 'member'].includes(status));
      })
      .catch(err => {
        console.error('Error checking membership:', err);
        resolve(false); // Assume not a member if there's an error
      });
  });
}

// Function to send the join message with inline keyboards
function sendJoinMessage(chatId, messageId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: 'لینک چنل 🔗', url: `https://t.me/${channelUsername.slice(1)}` }],
      [{ text: 'چک کردن عضویت ✅', callback_data: 'check_membership' }]
    ]
  };

  if (messageId) {
    bot.editMessageText('لطفا ابتدا در کانال عضو شوید!', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard
    });
  } else {
    bot.sendMessage(chatId, 'برای استفاده از ربات، لطفا در کانال زیر عضو شوید:\n\n@MYMINEMC', {
      reply_markup: keyboard
    });
  }
}

// Handle /start command
bot.onText(/\/start/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'دوست عزیز';

  // Check if the user is already a member
  const isMember = await isUserMember(chatId, userId);

  if (isMember) {
    // If the user is a member, greet them
    const startParam = match && match[0].split(' ')[1]; // Get the start parameter

    if (startParam === 'getFile1') {
      // Send the file if the special start parameter is provided
      const filePath = './pack1.txt'; // Ensure this file exists in the same directory
      bot.sendDocument(chatId, filePath, {
        caption: `فایل مورد نظر برای شما ارسال شد! 🎁`
      });
    } else {
      // Greet the user
      bot.sendMessage(chatId, `سلام ${username}! 😊\n\nخوش آمدید به ربات ما. امیدواریم از خدمات ما لذت ببرید!`);
    }
  } else {
    // If the user is not a member, send the join message
    const sentMessage = await bot.sendMessage(chatId, 'برای استفاده از ربات، لطفا در کانال زیر عضو شوید:\n\n@MYMINEMC');
    sendJoinMessage(chatId, sentMessage.message_id);
  }
});

// Handle inline keyboard callbacks
bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;

  if (query.data === 'check_membership') {
    const isMember = await isUserMember(chatId, userId);

    if (isMember) {
      // If the user is now a member, delete the join message and re-run the previous command
      bot.deleteMessage(chatId, messageId)
        .then(() => {
          bot.sendMessage(chatId, 'عضویت شما تایید شد! 🎉\n\nحالا می‌توانید از ربات استفاده کنید.');
          bot.sendMessage(chatId, `/start`); // Re-run the start command
        });
    } else {
      // If the user is still not a member, inform them
      bot.answerCallbackQuery(query.id, 'هنوز عضو کانال نشده‌اید! لطفا ابتدا عضو شوید.');
      sendJoinMessage(chatId, messageId);
    }
  }
});
