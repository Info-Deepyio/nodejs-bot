const fs = require("fs");
const axios = require("axios");

// Bot Token (Replace with your actual bot token)
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group ID (Replace with your actual group ID)
const ALLOWED_GROUP_ID = 6190641192; // Example: Replace with your group ID

// File paths
const DATA_FILE = "data.json";
const WARNINGS_FILE = "warnings.json";

// Initialize data structure
let data = {
  active: false,
  admins: {}
};

// Warnings tracking
let warnings = {};

// Offensive words list
const badWords = [
  "کیر", "کص", "کون", "سوپر", "باسن", "جند", "الت", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "تخمی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// Initialize bot and load data
function initializeBot() {
  loadData();
  loadWarnings();
  startPolling();
  console.log("Bot started successfully!");
}

// Load data from data.json
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, "utf8");
      data = JSON.parse(fileData);
    } else {
      saveData();
    }
  } catch (error) {
    console.error("Error loading data.json:", error);
    data = { active: false, admins: {} };
    saveData();
  }
}

// Save data to data.json
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving data.json:", error);
  }
}

// Load warnings from warnings.json
function loadWarnings() {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      const warningsData = fs.readFileSync(WARNINGS_FILE, "utf8");
      warnings = JSON.parse(warningsData);
    } else {
      saveWarnings();
    }
  } catch (error) {
    console.error("Error loading warnings.json:", error);
    warnings = {};
    saveWarnings();
  }
}

// Save warnings to warnings.json
function saveWarnings() {
  try {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving warnings.json:", error);
  }
}

// Check if the chat is the allowed group
function isAllowedGroup(chatId) {
  return chatId === ALLOWED_GROUP_ID;
}

// Send message to chat
async function sendMessage(chatId, text) {
  try {
    const response = await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    });
    return response.data;
  } catch (error) {
    console.error("Error sending message:", error.message);
    return null;
  }
}

// Check if a user is an admin or owner
async function isAdminUser(chatId, userId) {
  try {
    const response = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: userId
      }
    });
    const status = response.data.result.status;
    return status === "creator" || status === "administrator";
  } catch (error) {
    console.error("Error checking admin status:", error.message);
    return false;
  }
}

// Handle bot activation
async function handleActivation(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!isAllowedGroup(chatId)) return;

  try {
    const response = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: userId
      }
    });
    const isOwner = response.data.result.status === "creator";

    if (text === "روشن" && isOwner) {
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

    if (badWords.some(word => text.includes(word))) {
      try {
        await axios.post(`${API_URL}/deleteMessage`, {
          chat_id: chatId,
          message_id: msg.message_id
        });
        
        // Initialize warnings for this user if not exist
        if (!warnings[userId]) {
          warnings[userId] = { count: 0, mutedDueToWarnings: false };
        }

        // Handle warning count
        if (warnings[userId].count < 3) {
          warnings[userId].count++;
          saveWarnings();

          await sendMessage(
            chatId,
            `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${warnings[userId].count}/3`
          );

          if (warnings[userId].count >= 3) {
            warnings[userId].mutedDueToWarnings = true;
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
          }
        } else {
          await sendMessage(
            chatId,
            `❌ ${msg.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
          );
        }
      } catch (deleteError) {
        console.error("Error deleting message:", deleteError.message);
      }
    }
  } catch (error) {
    console.error("Error in handleBadWords:", error.message);
  }
}

// Process admin commands
async function handleAdminActions(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  
  if (!msg.reply_to_message) {
    if (text === "لیست" && isAllowedGroup(chatId) && data.active) {
      return handleCommandList(chatId);
    }
    return;
  }
  
  const targetId = msg.reply_to_message.from.id;

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
    }
  } catch (error) {
    console.error("Error in handleAdminActions:", error.message);
  }
}

// Handle warnings
async function handleWarning(chatId, targetId, msg) {
  if (!targetId) {
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  try {
    // Check if target is an admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "❌ نمی‌توانید به ادمین‌ها اخطار دهید.");
    }

    // Initialize warnings for this user if not exist
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
      }
    } else {
      await sendMessage(
        chatId,
        `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
      );
    }
  } catch (error) {
    console.error("Error in handleWarning:", error.message);
    await sendMessage(chatId, "❌ مشکلی در ثبت اخطار پیش آمد.");
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId) {
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  try {
    // Check if target is an admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "❌ نمی‌توانید ادمین‌ها را اخراج کنید.");
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
  if (!targetId) {
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  try {
    // Check if target is an admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "❌ نمی‌توانید ادمین‌ها را بی‌صدا کنید.");
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
  if (!targetId) {
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

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
    
    // Reset the muted status if it was due to warnings
    if (warnings[targetId] && warnings[targetId].mutedDueToWarnings) {
      warnings[targetId].mutedDueToWarnings = false;
      saveWarnings();
    }
    
    await sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  } catch (error) {
    console.error("Error unmuting user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد.");
  }
}

// Handle removing warnings
async function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId) {
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  try {
    if (warnings[targetId]) {
      const wasMuted = warnings[targetId].mutedDueToWarnings;
      warnings[targetId].count = 0;
      warnings[targetId].mutedDueToWarnings = false;
      saveWarnings();
      
      // Unmute the user if they were muted due to warnings
      if (wasMuted) {
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
      }
      
      await sendMessage(chatId, `✅ اخطارهای ${msg.reply_to_message.from.first_name} حذف شدند.`);
    } else {
      await sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد.`);
    }
  } catch (error) {
    console.error("Error removing warning:", error.message);
    await sendMessage(chatId, "❌ مشکلی در حذف اخطارها پیش آمد.");
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

// Get updates from Telegram API
let offset = 0;
async function getUpdates() {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset: offset,
        timeout: 30
      }
    });

    if (response.data && response.data.result) {
      const updates = response.data.result;
      
      if (updates.length > 0) {
        // Process all updates
        for (const update of updates) {
          if (update.message) {
            await processMessage(update.message);
          }
          // Update the offset to acknowledge received updates
          offset = update.update_id + 1;
        }
      }
    }
  } catch (error) {
    console.error("Error getting updates:", error.message);
  }
}

// Process incoming messages
async function processMessage(msg) {
  // Check if this is a text message
  if (!msg || !msg.text) return;
  
  // Process the message with our handlers
  await handleActivation(msg);
  
  if (data.active && isAllowedGroup(msg.chat.id)) {
    await handleBadWords(msg);
    await handleAdminActions(msg);
  }
}

// Polling function
function startPolling() {
  // Get updates immediately
  getUpdates();
  
  // Then set interval for continuous polling
  setInterval(getUpdates, 1000);
  
  console.log("Polling started...");
}

// Start the bot
initializeBot();
