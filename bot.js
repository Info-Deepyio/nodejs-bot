const fs = require("fs");
const axios = require("axios");
const express = require("express");

// Configuration
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;
const ALLOWED_GROUP_ID = 6190641192; // Replace with your actual group ID
const DATA_FILE = "data.json";
const WARNINGS_FILE = "warnings.json";
const PORT = process.env.PORT || 3000;

// Initialize Express server for webhook
const app = express();
app.use(express.json());

// Initialize data structure
let data = {
  active: false,
  admins: {}
};

// Warnings tracking
let warnings = {};

// Check if data files exist, otherwise create them
function initializeFiles() {
  // Load bot data
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (error) {
      console.error("Error reading data.json:", error);
      data = { active: false, admins: {} }; // Reset data on parse failure
      saveData();
    }
  } else {
    saveData();
  }

  // Load warnings data
  loadWarnings();
}

// Save data to data.json
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving data.json:", error);
  }
}

// Save warnings to a separate file
function saveWarnings() {
  try {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving warnings.json:", error);
  }
}

// Load warnings from a separate file
function loadWarnings() {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      warnings = JSON.parse(fs.readFileSync(WARNINGS_FILE, "utf8"));
    } else {
      warnings = {};
      saveWarnings();
    }
  } catch (error) {
    console.error("Error loading warnings.json:", error);
    warnings = {};
    saveWarnings();
  }
}

// Offensive words list
const badWords = [
  "کیر", "کص", "کون", "سوپر", "باسن", "جند", "الت", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "تخمی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// Function to check if the bot is in the allowed group
function isAllowedGroup(chatId) {
  return chatId === ALLOWED_GROUP_ID;
}

// Send message to chat
async function sendMessage(chatId, text) {
  try {
    const response = await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"  // Enable markdown support
    });
    return response.data;
  } catch (error) {
    console.error("Error sending message:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    return null;
  }
}

// Check if a user is an admin or owner
async function isAdminUser(chatId, userId) {
  try {
    const chatMember = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: userId
      }
    });
    const status = chatMember.data.result.status;
    return status === "creator" || status === "administrator";
  } catch (error) {
    console.error("Error in isAdminUser:", error.message);
    return false;
  }
}

// Handle activation
async function handleActivation(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!isAllowedGroup(chatId)) return;

  try {
    if (text === "روشن") {
      const isOwner = await isAdminUser(chatId, userId);
      if (!isOwner) return sendMessage(chatId, "❌ فقط مالک گروه میتواند ربات را فعال کند.");
      
      if (data.active) {
        return sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
      }
      
      data.active = true;
      saveData();
      return sendMessage(chatId, "✅ ربات با موفقیت فعال شد!\nربات کاستوم + ورژن انتشاری ۱.۱\nبرای شروع از کلمه لیست استفاده کنید\nپیشنهاد و انتقادا: @zonercm 🔔");
    }
  } catch (error) {
    console.error("Error in handleActivation:", error.message);
  }
}

// Handle offensive words
async function handleBadWords(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || "";

  if (!data.active || !isAllowedGroup(chatId)) return;

  try {
    const isAdmin = await isAdminUser(chatId, userId);
    if (isAdmin) return; // Admins are immune

    if (badWords.some(word => text.toLowerCase().includes(word))) {
      try {
        await axios.post(`${API_URL}/deleteMessage`, {
          chat_id: chatId,
          message_id: msg.message_id
        });
      } catch (error) {
        console.error("Error deleting message:", error.message);
        // Continue even if message deletion fails
      }

      if (!warnings[userId]) {
        warnings[userId] = { count: 0, mutedDueToWarnings: false };
      }

      if (warnings[userId].count < 3) {
        warnings[userId].count++;
        saveWarnings();

        await sendMessage(
          chatId,
          `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${warnings[userId].count}/3`
        );

        if (warnings[userId].count >= 3) {
          warnings[userId].mutedDueToWarnings = true;
          try {
            await axios.post(`${API_URL}/restrictChatMember`, {
              chat_id: chatId,
              user_id: userId,
              permissions: {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false
              }
            });
            await sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
          } catch (error) {
            console.error("Error restricting user:", error.message);
          }
        }
      } else {
        await sendMessage(
          chatId,
          `❌ ${msg.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
        );
      }
    }
  } catch (error) {
    console.error("Error in handleBadWords:", error.message);
  }
}

// Handle warnings
async function handleWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    const targetMember = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: targetId
      }
    });
    
    const status = targetMember.data.result.status;
    if (status === "creator" || status === "administrator") {
      return sendMessage(chatId, "❌ شما نمی‌توانید به ادمین‌ها اخطار دهید.");
    }
    
    if (!warnings[targetId]) {
      warnings[targetId] = { count: 0, mutedDueToWarnings: false };
    }

    if (warnings[targetId].count < 3) {
      warnings[targetId].count++;
      saveWarnings();

      await sendMessage(
        chatId,
        `⚠️ ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} اخطار گرفت! \n📌 اخطار ${warnings[targetId].count}/3`
      );

      if (warnings[targetId].count >= 3) {
        warnings[targetId].mutedDueToWarnings = true;
        try {
          await axios.post(`${API_URL}/restrictChatMember`, {
            chat_id: chatId,
            user_id: targetId,
            permissions: {
              can_send_messages: false,
              can_send_media_messages: false,
              can_send_polls: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false
            }
          });
          await sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
        } catch (error) {
          console.error("Error restricting user:", error.message);
        }
      }
    } else {
      await sendMessage(
        chatId,
        `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
      );
    }
  } catch (error) {
    console.error("Error handling warning:", error.message);
    await sendMessage(chatId, "❌ خطایی در اعمال اخطار رخ داد.");
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from)
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    const targetMember = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: targetId
      }
    });
    
    const status = targetMember.data.result.status;
    if (status === "creator" || status === "administrator") {
      return sendMessage(chatId, "❌ شما نمی‌توانید ادمین‌ها را اخراج کنید.");
    }
    
    await axios.post(`${API_URL}/kickChatMember`, {
      chat_id: chatId,
      user_id: targetId
    });
    await sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  } catch (error) {
    console.error("Error kicking user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در اخراج کاربر پیش آمد.");
  }
}

// Handle muting users
async function handleMute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from)
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    const targetMember = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: targetId
      }
    });
    
    const status = targetMember.data.result.status;
    if (status === "creator" || status === "administrator") {
      return sendMessage(chatId, "❌ شما نمی‌توانید ادمین‌ها را بی‌صدا کنید.");
    }
    
    await axios.post(`${API_URL}/restrictChatMember`, {
      chat_id: chatId,
      user_id: targetId,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      }
    });
    await sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  } catch (error) {
    console.error("Error muting user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در بی‌صدا کردن کاربر پیش آمد.");
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
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      }
    });
    await sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  } catch (error) {
    console.error("Error unmuting user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد.");
  }
}

// Handle removing warnings
async function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (warnings[targetId]) {
    warnings[targetId].count = 0;
    warnings[targetId].mutedDueToWarnings = false;
    saveWarnings();
    await sendMessage(chatId, `✅ اخطارهای ${msg.reply_to_message.from.first_name} حذف شدند.`);
  } else {
    await sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد.`);
  }
}

// Handle command list
async function handleCommandList(chatId) {
  const commands = `💡 **دستورات ربات:**\n
🔊 \`روشن\` : فعال کردن ربات
⚠️ \`اخطار\` : اضافه کردن اخطار به کاربر
🚫 \`کیک\` یا \`صیک\` : اخراج کردن کاربر
🔇 \`سکوت\` : بی‌صدا کردن کاربر
📣 \`سخنگو\` : بازگشت صدای کاربر
❌ \`حذف اخطار\` : حذف اخطارهای کاربر
`;
  await sendMessage(chatId, commands);
}

// Admin actions
async function handleAdminActions(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = msg.reply_to_message?.from?.id;
  const text = msg.text;

  if (!data.active || !isAllowedGroup(chatId)) return;

  try {
    const isAdmin = await isAdminUser(chatId, userId);
    if (!isAdmin) return;

    switch (text) {
      case "اخطار":
        await handleWarning(chatId, targetId, msg);
        break;

      case "کیک":
      case "صیک":
        await handleKick(chatId, targetId, msg);
        break;

      case "سکوت":
        await handleMute(chatId, targetId, msg);
        break;

      case "سخنگو":
        await handleUnmute(chatId, targetId, msg);
        break;

      case "حذف اخطار":
        await handleRemoveWarning(chatId, targetId, msg);
        break;

      case "لیست":
        await handleCommandList(chatId);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("Error in handleAdminActions:", error.message);
  }
}

// Process incoming update
async function processUpdate(update) {
  if (!update || !update.message) return;
  
  const msg = update.message;
  
  // Process bot commands and admin actions
  await handleActivation(msg);
  await handleBadWords(msg);
  await handleAdminActions(msg);
}

// Set up webhook endpoint
app.post(`/webhook/${TOKEN}`, async (req, res) => {
  try {
    await processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    res.sendStatus(500);
  }
});

// Start the server and initialize the bot
async function startBot() {
  // Initialize data files
  initializeFiles();
  
  // Start Express server
  app.listen(PORT, () => {
    console.log(`Bot server running on port ${PORT}`);
  });
  
  try {
    // Set webhook
    const webhookUrl = process.env.WEBHOOK_URL || `https://your-domain.com/webhook/${TOKEN}`;
    await axios.post(`${API_URL}/setWebhook`, {
      url: webhookUrl
    });
    console.log(`Webhook set to: ${webhookUrl}`);
    
    // Get bot info
    const botInfo = await axios.get(`${API_URL}/getMe`);
    console.log(`Bot started: @${botInfo.data.result.username}`);
  } catch (error) {
    console.error("Error setting up webhook:", error.message);
    
    // If webhook fails, use polling as fallback
    console.log("Falling back to polling...");
    startPolling();
  }
}

// Polling fallback if webhook setup fails
async function startPolling() {
  let offset = 0;
  
  const poll = async () => {
    try {
      const response = await axios.get(`${API_URL}/getUpdates`, {
        params: {
          offset: offset,
          timeout: 30
        }
      });
      
      const updates = response.data.result;
      if (updates && updates.length > 0) {
        // Process each update
        for (const update of updates) {
          await processUpdate(update);
          offset = update.update_id + 1;
        }
      }
      
      // Continue polling
      setTimeout(poll, 1000);
    } catch (error) {
      console.error("Polling error:", error.message);
      setTimeout(poll, 5000);  // Retry after 5 seconds on error
    }
  };
  
  // Start the polling loop
  poll();
}

// Start the bot
startBot();
