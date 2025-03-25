const axios = require('axios');
const moment = require('moment-jalaali');
const redis = require('redis');

moment.loadPersian({ usePersianDigits: true });

const BOT_TOKEN = '1160037511:EQNWiWm1RMmMbCydsXiwOsEdyPbmomAuwu4tX6Xb';
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;
const WHITELISTED_USERS = [844843541]; // Replace with actual user IDs
const GROUP_ID = 5272323810; // Replace with your group ID

const redisClient = redis.createClient();
redisClient.connect();

let autoMessageEnabled = false;
let autoMessageText = '🔔 پیام خودکار برای کاربران غیرگروهی!';

// Persian date function
function getPersianDate() {
  return moment().format('jYYYY/jMM/jDD HH:mm');
}

// Custom UID generator
function generateUID() {
  return Math.random().toString(36).substr(2, 10);
}

// Send a message via Telegram API
async function sendMessage(chatId, text, replyMarkup = null) {
  await axios.post(`${API_URL}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: replyMarkup
  }).catch(console.error);
}

// Long polling for updates
async function getUpdates(offset = 0) {
  try {
    const res = await axios.post(`${API_URL}/getUpdates`, { offset, timeout: 30 });
    const updates = res.data.result;
    
    for (let update of updates) {
      if (update.message) handleMessage(update.message);
      if (update.callback_query) handleCallback(update.callback_query);
      offset = update.update_id + 1;
    }
    
    getUpdates(offset);
  } catch (error) {
    console.error(error);
    setTimeout(() => getUpdates(offset), 5000);
  }
}

// Handle messages
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const firstName = msg.from.first_name || 'کاربر';
  const text = msg.text;

  if (!await redisClient.exists(`user:${userId}`)) {
    await redisClient.set(`user:${userId}`, 'true');
  }

  if (text === '/start') {
    const response = `👋 سلام ${firstName}!\n📅 تاریخ: ${getPersianDate()}\n\n🔘 برای دسترسی به امکانات ربات، دستور «پنل» را ارسال کنید.`;
    await sendMessage(chatId, response);
  } else if (text === 'پنل' && WHITELISTED_USERS.includes(userId)) {
    await sendMessage(chatId, '⚙️ منو مدیریت:', {
      inline_keyboard: [
        [{ text: '📩 پیام‌رسانی', callback_data: 'messaging' }],
        [{ text: '📂 ارسال فایل', callback_data: 'upload_file' }]
      ]
    });
  } else if (await redisClient.exists(`awaiting_file:${chatId}`)) {
    if (msg.document) {
      const fileId = msg.document.file_id;
      const fileUID = generateUID();
      const password = await redisClient.get(`awaiting_file:${chatId}`);

      await redisClient.set(fileUID, JSON.stringify({ fileId, password }));
      await redisClient.del(`awaiting_file:${chatId}`);

      await sendMessage(chatId, `📂 فایل ذخیره شد!\n🔗 لینک دریافت فایل:\n\`\`\`/start ${fileUID}\`\`\``);
    }
  }
}

// Handle callback queries
async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'messaging') {
    await sendMessage(chatId, '📩 گزینه‌های پیام‌رسانی:', {
      inline_keyboard: [
        [{ text: '📢 ارسال به همه', callback_data: 'send_all' }],
        [{ text: '👥 ارسال به گروه', callback_data: 'send_group' }],
        [{ text: '🚫 ارسال به غیرگروه', callback_data: 'send_non_group' }],
        [{ text: autoMessageEnabled ? '❌ غیرفعال‌سازی پیام خودکار' : '✅ فعال‌سازی پیام خودکار', callback_data: 'toggle_auto' }]
      ]
    });
  } else if (data === 'toggle_auto') {
    autoMessageEnabled = !autoMessageEnabled;
    await sendMessage(chatId, autoMessageEnabled ? '✅ پیام خودکار فعال شد.' : '❌ پیام خودکار غیرفعال شد.');
  } else if (data === 'upload_file') {
    await sendMessage(chatId, '❓ آیا فایل رمز عبور دارد؟', {
      inline_keyboard: [
        [{ text: '🔐 بله', callback_data: 'file_with_pass' }],
        [{ text: '📁 خیر', callback_data: 'file_no_pass' }]
      ]
    });
  } else if (data === 'file_with_pass') {
    await redisClient.set(`awaiting_password:${chatId}`, 'true');
    await sendMessage(chatId, '🔑 لطفاً رمز عبور را ارسال کنید.');
  } else if (data === 'file_no_pass') {
    await redisClient.set(`awaiting_file:${chatId}`, '');
    await sendMessage(chatId, '📎 لطفاً فایل را ارسال کنید.');
  }
}

// Sending messages
async function sendMessagesToUsers(conditionFn, text) {
  const keys = await redisClient.keys('user:*');
  for (let key of keys) {
    const userId = key.split(':')[1];
    if (conditionFn(userId)) {
      await sendMessage(userId, `📢 پیام جدید:\n\n${text}`);
    }
  }
}

async function autoMessage() {
  if (autoMessageEnabled) {
    await sendMessagesToUsers(userId => userId !== GROUP_ID, autoMessageText);
  }
}

setInterval(autoMessage, 7200000); // 2 hours

// Handle start links for file retrieval
async function handleFileRetrieval(chatId, fileUID) {
  const fileData = await redisClient.get(fileUID);
  if (!fileData) {
    return await sendMessage(chatId, '❌ فایل مورد نظر یافت نشد.');
  }

  const { fileId, password } = JSON.parse(fileData);
  if (password) {
    await redisClient.set(`awaiting_password_check:${chatId}`, fileUID);
    await sendMessage(chatId, '🔐 لطفاً رمز عبور را ارسال کنید.');
  } else {
    await axios.post(`${API_URL}/sendDocument`, { chat_id: chatId, document: fileId }).catch(console.error);
  }
}

// Check for password input
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;

  if (await redisClient.exists(`awaiting_password:${chatId}`)) {
    await redisClient.set(`awaiting_file:${chatId}`, text);
    await redisClient.del(`awaiting_password:${chatId}`);
    await sendMessage(chatId, '✅ رمز عبور ذخیره شد. حالا فایل را ارسال کنید.');
  } else if (await redisClient.exists(`awaiting_password_check:${chatId}`)) {
    const fileUID = await redisClient.get(`awaiting_password_check:${chatId}`);
    const fileData = JSON.parse(await redisClient.get(fileUID));

    if (text === fileData.password) {
      await axios.post(`${API_URL}/sendDocument`, { chat_id: chatId, document: fileData.fileId }).catch(console.error);
      await redisClient.del(`awaiting_password_check:${chatId}`);
    } else {
      await sendMessage(chatId, '❌ رمز اشتباه است.');
    }
  }
});

// Start polling
getUpdates();
