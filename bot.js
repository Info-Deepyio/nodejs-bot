const fs = require("fs");
const axios = require("axios");

// Bot Token (Replace with your actual bot token)
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group handle (without @ for consistency)
const ALLOWED_GROUP = "chatblox";

// Data files
const DATA_FILE = "data.json";
const WARNINGS_FILE = "warnings.json";

// Initialize data structure
let data = {
  active: false,
  admins: {}
};

// Warnings tracking (separate from data object)
let warnings = {};

// Last processed update ID to avoid duplicate processing
let lastUpdateId = 0;

// Load data from JSON file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, "utf8");
      data = JSON.parse(fileContent);
      console.log("Data loaded successfully");
    } else {
      saveData(); // Create the file if it doesn't exist
      console.log("Created new data file");
    }
  } catch (error) {
    console.error("Error loading data.json:", error.message);
    data = { active: false, admins: {} }; // Reset data on parse failure
    saveData();
  }
}

// Save data to `data.json`
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving data.json:", error.message);
  }
}

// Load warnings from a separate file
function loadWarnings() {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      const fileContent = fs.readFileSync(WARNINGS_FILE, "utf8");
      warnings = JSON.parse(fileContent);
      console.log("Warnings loaded successfully");
    } else {
      warnings = {};
      saveWarnings(); // Create the file if it doesn't exist
      console.log("Created new warnings file");
    }
  } catch (error) {
    console.error("Error loading warnings.json:", error.message);
    warnings = {};
    saveWarnings();
  }
}

// Save warnings to a separate file
function saveWarnings() {
  try {
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving warnings.json:", error.message);
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
    const response = await axios.get(`${API_URL}/getChat`, {
      params: { chat_id: chatId }
    });
    
    if (response.data && response.data.ok && response.data.result) {
      const username = response.data.result.username || "";
      return username.toLowerCase() === ALLOWED_GROUP.toLowerCase();
    }
    return false;
  } catch (error) {
    console.error("Error checking group:", error.message);
    return false;
  }
}

// Send message to chat with retry mechanism
async function sendMessage(chatId, text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown"
      });
      
      if (response.data && response.data.ok) {
        return response.data.result;
      }
    } catch (error) {
      console.error(`Error sending message (attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) return null;
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  return null;
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
    
    if (response.data && response.data.ok && response.data.result) {
      const status = response.data.result.status;
      return status === "creator" || status === "administrator";
    }
    return false;
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

  try {
    // Skip if not in allowed group
    if (!await isAllowedGroup(chatId)) return;

    const isOwner = await isCreator(chatId, userId);

    if (text === "روشن" && isOwner) {
      if (data.active) {
        return sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
      }
      data.active = true;
      saveData();
      return sendMessage(chatId, "✅ ربات با موفقیت فعال شد!\nربات کاستوم + ورژن انتشاری ۱.۱\nبرای شروع از کلمه لیست استفاده کنید\nپیشنهاد و انتقادا: @zonercm 🔔");
    } else if (text === "خاموش" && isOwner) {
      if (!data.active) {
        return sendMessage(chatId, "⚠️ ربات قبلا غیرفعال شده است.");
      }
      data.active = false;
      saveData();
      return sendMessage(chatId, "🔴 ربات با موفقیت غیرفعال شد!");
    }
  } catch (error) {
    console.error("Error in handleActivation:", error.message);
  }
}

// Check if user is the group creator
async function isCreator(chatId, userId) {
  try {
    const response = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: chatId,
        user_id: userId
      }
    });
    
    if (response.data && response.data.ok && response.data.result) {
      return response.data.result.status === "creator";
    }
    return false;
  } catch (error) {
    console.error("Error checking creator status:", error.message);
    return false;
  }
}

// Handle offensive words
async function handleBadWords(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // Skip if bot is inactive, message has no text, or not in allowed group
  if (!text || !data.active || !await isAllowedGroup(chatId)) return;

  try {
    // Skip if user is admin
    const isAdmin = await isAdminUser(chatId, userId);
    if (isAdmin) return;

    // Check if message contains bad words
    if (badWords.some(word => text.toLowerCase().includes(word.toLowerCase()))) {
      // Try to delete the message
      try {
        await axios.post(`${API_URL}/deleteMessage`, {
          chat_id: chatId,
          message_id: msg.message_id
        });
      } catch (deleteError) {
        console.error("Failed to delete message:", deleteError.message);
        // Continue with warning even if delete fails
      }

      // Initialize user warnings if not exists
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
          } catch (restrictError) {
            console.error("Failed to mute user:", restrictError.message);
            await sendMessage(chatId, `⚠️ نتوانستم ${msg.from.first_name} را بی‌صدا کنم. لطفا دسترسی‌های ربات را بررسی کنید.`);
          }
        }
      } else if (!warnings[userId].mutedDueToWarnings) {
        // User has 3+ warnings but wasn't muted yet (could happen if bot was restarted)
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
          await sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل داشتن ${warnings[userId].count} اخطار، بی‌صدا شد!`);
        } catch (restrictError) {
          console.error("Failed to mute user:", restrictError.message);
        }
      }
    }
  } catch (error) {
    console.error("Error in handleBadWords:", error.message);
  }
}

// Admin actions
async function handleAdminActions(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();

  // Skip if bot is inactive or not in allowed group
  if (!data.active || !await isAllowedGroup(chatId)) return;

  try {
    // Skip if user is not an admin
    const isAdmin = await isAdminUser(chatId, userId);
    if (!isAdmin) return;

    // Get target user ID from reply
    const targetId = msg.reply_to_message?.from?.id;

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

// Handle warnings
async function handleWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    // Check if target is admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "⛔ نمی‌توانید به ادمین اخطار دهید.");
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
        } catch (restrictError) {
          console.error("Failed to mute user:", restrictError.message);
          await sendMessage(chatId, `⚠️ نتوانستم ${msg.reply_to_message.from.first_name} را بی‌صدا کنم. لطفا دسترسی‌های ربات را بررسی کنید.`);
        }
      }
    } else {
      await sendMessage(
        chatId,
        `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
      );
    }
  } catch (error) {
    console.error("Error in handleWarning:", error.message);
    await sendMessage(chatId, "❌ خطایی در اعمال اخطار رخ داد.");
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    // Check if target is admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "⛔ نمی‌توانید ادمین را اخراج کنید.");
    }

    await axios.post(`${API_URL}/kickChatMember`, {
      chat_id: chatId,
      user_id: targetId
    });
    
    await sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
    
    // Clear warnings for kicked user
    if (warnings[targetId]) {
      delete warnings[targetId];
      saveWarnings();
    }
  } catch (error) {
    console.error("Error kicking user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در اخراج کاربر پیش آمد. ممکن است ربات دسترسی کافی نداشته باشد.");
  }
}

// Handle muting users
async function handleMute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    // Check if target is admin
    const isTargetAdmin = await isAdminUser(chatId, targetId);
    if (isTargetAdmin) {
      return sendMessage(chatId, "⛔ نمی‌توانید ادمین را بی‌صدا کنید.");
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
    await sendMessage(chatId, "❌ مشکلی در بی‌صدا کردن کاربر پیش آمد. ممکن است ربات دسترسی کافی نداشته باشد.");
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
    
    // If user was muted due to warnings, update that status
    if (warnings[targetId] && warnings[targetId].mutedDueToWarnings) {
      warnings[targetId].mutedDueToWarnings = false;
      saveWarnings();
    }
  } catch (error) {
    console.error("Error unmuting user:", error.message);
    await sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد. ممکن است ربات دسترسی کافی نداشته باشد.");
  }
}

// Handle removing warnings
async function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId) return sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    if (warnings[targetId]) {
      const hadWarnings = warnings[targetId].count > 0;
      warnings[targetId].count = 0;
      warnings[targetId].mutedDueToWarnings = false;
      saveWarnings();
      
      await sendMessage(chatId, `✅ اخطارهای ${msg.reply_to_message.from.first_name} حذف شدند.`);
      
      // If user was muted due to warnings, unmute them
      if (hadWarnings) {
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
        } catch (restrictError) {
          console.error("Error unmuting user after warning removal:", restrictError.message);
          await sendMessage(chatId, "⚠️ اخطارها حذف شدند اما نتوانستم محدودیت کاربر را بردارم.");
        }
      }
    } else {
      await sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد.`);
    }
  } catch (error) {
    console.error("Error removing warnings:", error.message);
    await sendMessage(chatId, "❌ خطایی در حذف اخطارها رخ داد.");
  }
}

// Handle command list
async function handleCommandList(chatId) {
  const commands = `
*📋 دستورات ربات:*
🔊 \`روشن\` : فعال کردن ربات (فقط مالک)
🔴 \`خاموش\` : غیرفعال کردن ربات (فقط مالک)
⚠️ \`اخطار\` : اضافه کردن اخطار به کاربر
🚫 \`کیک\` یا \`صیک\` : اخراج کردن کاربر
🔇 \`سکوت\` : بی‌صدا کردن کاربر
📣 \`سخنگو\` : بازگشت صدای کاربر
❌ \`حذف اخطار\` : حذف اخطارهای کاربر

*🔍 توضیحات:*
- برای استفاده از دستورات مدیریتی، روی پیام کاربر ریپلای کنید.
- بعد از 3 اخطار، کاربر به صورت خودکار بی‌صدا می‌شود.
- کلمات نامناسب به صورت خودکار حذف می‌شوند.
`;
  await sendMessage(chatId, commands);
}

// Process a single update
async function processUpdate(update) {
  if (!update || !update.update_id) return;
  
  // Skip already processed updates
  if (update.update_id <= lastUpdateId) return;
  
  lastUpdateId = update.update_id;
  
  if (update.message) {
    await handleActivation(update.message);
    await handleBadWords(update.message);
    await handleAdminActions(update.message);
  }
}

// Get updates with long polling
async function getUpdates(offset = 0, timeout = 30) {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset,
        timeout,
        allowed_updates: JSON.stringify(["message"])
      }
    });
    
    if (response.data && response.data.ok && Array.isArray(response.data.result)) {
      const updates = response.data.result;
      
      if (updates.length > 0) {
        // Process updates in sequence
        for (const update of updates) {
          await processUpdate(update);
        }
        
        // Use the ID of the last update + 1 for the next poll
        const newOffset = updates[updates.length - 1].update_id + 1;
        setTimeout(() => getUpdates(newOffset, timeout), 100);
      } else {
        // No updates, poll again after a short delay
        setTimeout(() => getUpdates(offset, timeout), 100);
      }
    } else {
      // Invalid response, retry after a delay
      console.error("Invalid response from getUpdates:", response.data);
      setTimeout(() => getUpdates(offset, timeout), 5000);
    }
  } catch (error) {
    console.error("Error in getUpdates:", error.message);
    // Exponential backoff for API errors
    setTimeout(() => getUpdates(offset, timeout), 5000);
  }
}

// Initialize and run the bot
async function runBot() {
  try {
    // Load saved data
    loadData();
    loadWarnings();
    
    // Start getting updates
    getUpdates();
    
    console.log("Bot is running...");
  } catch (error) {
    console.error("Error starting bot:", error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Bot is shutting down...');
  saveData();
  saveWarnings();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  saveData();
  saveWarnings();
  // Let the process continue instead of crashing
});

// Start the bot
runBot();
