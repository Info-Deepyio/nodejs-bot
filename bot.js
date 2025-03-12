const fs = require("fs");
const axios = require("axios");

// Bot Token (Replace with your actual bot token)
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group handle
const ALLOWED_GROUP = "@fortblox";

// Load data from JSON file
const DATA_FILE = "data.json";

// Initialize data structure if data.json doesn't exist
let data = {
  active: false,
  admins: {}
};

// Warnings tracking (separate from data object)
let warnings = {};

// Check if data.json exists, otherwise create it
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Error reading data.json:", error);
    data = { active: false, admins: {} }; // Reset data on parse failure
  }
} else {
  saveData();
}

// Save data to data.json
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving data.json:", error);
  }
}

// Offensive words list
const badWords = [
  "کیر", "کص", "کون", "سوپر", "باسن", "جند", "الت", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "تخمی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// Function to check if the bot is in the allowed group
async function isAllowedGroup(chatId) {
  try {
    const chatInfo = await axios.get(`${API_URL}/getChat?chat_id=${chatId}`);
    return chatInfo.data.result.username === ALLOWED_GROUP.replace("@", "");
  } catch (error) {
    console.error("Error checking group:", error);
    return false;
  }
}

// Send message to chat
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// Handle activation
async function handleActivation(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!await isAllowedGroup(chatId)) return;

  try {
    const chatMember = await axios.get(`${API_URL}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const isOwner = chatMember.data.result.status === "creator";

    if (text === "روشن" && isOwner) {
      if (data.active) {
        return sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
      }
      data.active = true;
      saveData();
      return sendMessage(chatId, "✅ ربات با موفقیت فعال شد!\nربات کاستوم + ورژن انتشاری ۱.۱\nبرای شروع از کلمه لیست استفاده کنید\nپیشنهاد و انتقادا: @zonercm 🔔");
    }
  } catch (error) {
    console.error("Error in handleActivation:", error);
  }
}

// Handle offensive words
async function handleBadWords(msg) {
  if (!msg || !msg.chat || !msg.from) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || !data.active || !await isAllowedGroup(chatId)) return;

  try {
    const isAdmin = await isAdminUser(chatId, userId);
    if (isAdmin) return; // Admins are immune

    if (badWords.some(word => text.includes(word))) {
      await axios.post(`${API_URL}/deleteMessage`, {
        chat_id: chatId,
        message_id: msg.message_id
      });

      if (!warnings[userId]) {
        warnings[userId] = { count: 0, mutedDueToWarnings: false };
      }

      if (warnings[userId].count < 3) {
        warnings[userId].count++;
        saveWarnings();

        sendMessage(
          chatId,
          `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${warnings[userId].count}/3`
        );

        if (warnings[userId].count >= 3) {
          warnings[userId].mutedDueToWarnings = true;
          await axios.post(`${API_URL}/restrictChatMember`, {
            chat_id: chatId,
            user_id: userId,
            can_send_messages: false
          });
          sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
        }
      } else {
        sendMessage(
          chatId,
          `❌ ${msg.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
        );
      }
    }
  } catch (error) {
    console.error("Error in handleBadWords:", error);
  }
}

// Save warnings to a separate file
function saveWarnings() {
  try {
    fs.writeFileSync("warnings.json", JSON.stringify(warnings, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving warnings.json:", error);
  }
}

// Load warnings from a separate file
function loadWarnings() {
  try {
    if (fs.existsSync("warnings.json")) {
      warnings = JSON.parse(fs.readFileSync("warnings.json", "utf8"));
    } else {
      warnings = {};
    }
  } catch (error) {
    console.error("Error loading warnings.json:", error);
    warnings = {};
  }
}

// Check if a user is an admin or owner
async function isAdminUser(chatId, userId) {
  try {
    const chatMember = await axios.get(`${API_URL}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    return chatMember.data.result.status === "creator" || chatMember.data.result.status === "administrator";
  } catch (error) {
    console.error("Error in isAdminUser:", error);
    return false;
  }
}

// Admin actions
async function handleAdminActions(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = msg.reply_to_message?.from?.id;
  const text = msg.text;

  if (!data.active || !await isAllowedGroup(chatId)) return;

  try {
    const isAdmin = await isAdminUser(chatId, userId);
    if (!isAdmin) return;

    switch (text) {
      case "اخطار":
        handleWarning(chatId, targetId, msg);
        break;

      case "کیک":
      case "صیک":
        handleKick(chatId, targetId, msg);
        break;

      case "سکوت":
        handleMute(chatId, targetId, msg);
        break;

      case "سخنگو":
        handleUnmute(chatId, targetId, msg);
        break;

      case "حذف اخطار":
        handleRemoveWarning(chatId, targetId, msg);
        break;

      case "لیست":
        handleCommandList(chatId);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("Error in handleAdminActions:", error);
  }
}

// Handle warnings
function handleWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (!warnings[targetId]) {
    warnings[targetId] = { count: 0, mutedDueToWarnings: false };
  }

  if (warnings[targetId].count < 3) {
    warnings[targetId].count++;
    saveWarnings();

    sendMessage(
      chatId,
      `⚠️ ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} اخطار گرفت! \n📌 اخطار ${warnings[targetId].count}/3`
    );

    if (warnings[targetId].count >= 3) {
      warnings[targetId].mutedDueToWarnings = true;
      axios.post(`${API_URL}/restrictChatMember`, {
        chat_id: chatId,
        user_id: targetId,
        can_send_messages: false
      });
      sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
    }
  } else {
    sendMessage(
      chatId,
      `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
    );
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from)
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await axios.post(`${API_URL}/kickChatMember`, {
      chat_id: chatId,
      user_id: targetId
    });
    sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  } catch (error) {
    console.error("Error kicking user:", error);
    sendMessage(chatId, "❌ مشکلی در اخراج کاربر پیش آمد.");
  }
}

// Handle muting users
async function handleMute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from)
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await axios.post(`${API_URL}/restrictChatMember`, {
      chat_id: chatId,
      user_id: targetId,
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    });
    sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  } catch (error) {
    console.error("Error muting user:", error);
    sendMessage(chatId, "❌ مشکلی در بی‌صدا کردن کاربر پیش آمد.");
  }
}

// Handle unmuting users
async function handleUnmute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from)
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await axios.post(`${API_URL}/restrictChatMember`, {
      chat_id: chatId,
      user_id: targetId,
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });
    sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  } catch (error) {
    console.error("Error unmuting user:", error);
    sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد.");
  }
}

// Handle removing warnings
function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (warnings[targetId]) {
    warnings[targetId].count = 0;
    warnings[targetId].mutedDueToWarnings = false;
    saveWarnings();
    sendMessage(chatId, `✅ اخطارهای ${msg.reply_to_message.from.first_name} حذف شدند.`);
  } else {
    sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد.`);
  }
}

// Handle command list
function handleCommandList(chatId) {
  const commands = `💡 **دستورات ربات:**\n
🔊 \`روشن\` : فعال کردن ربات
⚠️ \`اخطار\` : اضافه کردن اخطار به کاربر
🚫 \`کیک\` : اخراج کردن کاربر
🔇 \`سکوت\` : بی‌صدا کردن کاربر
📣 \`سخنگو\` : بازگشت صدای کاربر
❌ \`حذف اخطار\` : حذف اخطارهای کاربر
`;
  sendMessage(chatId, commands);
}

// Load warnings on startup
loadWarnings();
