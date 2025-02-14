const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token (Replace with your actual bot token)
const TOKEN = "7948201057:AAGdjlJ7XGdObnxlIUpXfXqOXUrCILApxKE";
const bot = new TelegramBot(TOKEN, { polling: true });

// Group handle
const ALLOWED_GROUP = "@McGapGroup";

// Load data from JSON file
const DATA_FILE = "data.json";

// Initialize data structure if `data.json` doesn't exist
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

// Save data to `data.json`
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
function isAllowedGroup(chat) {
  return chat && chat.type === "supergroup" && chat.username === ALLOWED_GROUP.replace("@", "");
}

// Handle activation
async function handleActivation(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!isAllowedGroup(msg.chat)) return;

  try {
    const chatMember = await bot.getChatMember(chatId, userId);
    const isOwner = chatMember.status === "creator";

    if (text === "روشن" && isOwner) {
      if (data.active) {
        return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
      }
      data.active = true;
      saveData();
      return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!\nربات کاستوم + ورژن انتشاری ۱.۱\nبرای شروع از کلمه لیست استفاده کنید\nپیشنهاد و انتقادا: @zonercm 🔔");
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

  if (!text || !data.active || !isAllowedGroup(msg.chat)) return;

  try {
    const isAdmin = await isAdminUser(chatId, userId);
    if (isAdmin) return; // Admins are immune

    if (badWords.some(word => text.includes(word))) {
      bot.deleteMessage(chatId, msg.message_id);

      if (!warnings[userId]) {
        warnings[userId] = { count: 0, mutedDueToWarnings: false };
      }

      if (warnings[userId].count <3) {
        warnings[userId].count++;
        saveWarnings();

        bot.sendMessage(
          chatId,
          `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${warnings[userId].count}/3`
        );

        if (warnings[userId].count >= 3) {
          warnings[userId].mutedDueToWarnings = true;
          await bot.restrictChatMember(chatId, userId, { can_send_messages: false });
          bot.sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
        }
      } else {
        bot.sendMessage(
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
    const chatMember = await bot.getChatMember(chatId, userId);
    return chatMember.status === "creator" || chatMember.status === "administrator";
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

  if (!data.active || !isAllowedGroup(msg.chat)) return;

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
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  if (!msg.reply_to_message || !msg.reply_to_message.from) return;

  if (!warnings[targetId]) {
    warnings[targetId] = { count: 0, mutedDueToWarnings: false };
  }

  if (warnings[targetId].count < 3) {
    warnings[targetId].count++;
    saveWarnings();

    bot.sendMessage(
      chatId,
      `⚠️ ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} اخطار گرفت! \n📌 اخطار ${warnings[targetId].count}/3`
    );

    if (warnings[targetId].count >= 3) {
      warnings[targetId].mutedDueToWarnings = true;
      bot.restrictChatMember(chatId, targetId, { can_send_messages: false })
        .catch(error => console.error("Error restricting user:", error));
      bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
    }
  } else {
    bot.sendMessage(
      chatId,
      `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده و بی‌صدا شده است!`
    );
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await bot.kickChatMember(chatId, targetId);
    bot.sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  } catch (error) {
    console.error("Error kicking user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در اخراج کاربر پیش آمد.");
  }
}

// Handle muting users
async function handleMute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await bot.restrictChatMember(chatId, targetId, {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    });
    bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  } catch (error) {
    console.error("Error muting user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در بی‌صدا کردن کاربر پیش آمد.");
  }
}

// Handle unmuting users
async function handleUnmute(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  try {
    await bot.restrictChatMember(chatId, targetId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });
    bot.sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  } catch (error) {
    console.error("Error unmuting user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد.");
  }
}

// Handle removing warnings
function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId || !msg.reply_to_message || !msg.reply_to_message.from) 
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (!warnings[targetId]) {
    return bot.sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد!`);
  }

  if (warnings[targetId].count > 0) {
    warnings[targetId].count--;

    if (warnings[targetId].count === 0 && warnings[targetId].mutedDueToWarnings) {
      // Unmute the user if they were muted due to warnings and now have 0 warnings
      warnings[targetId].mutedDueToWarnings = false;

      bot.restrictChatMember(chatId, targetId, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      }).then(() => {
        bot.sendMessage(
          chatId,
          `🎉 ${msg.reply_to_message.from.first_name} از سکوت خارج شد و مجدد قادر به صحبت کردن است!`
        );
      }).catch((error) => {
        console.error("Error auto-unmuting user:", error);
      });
    }

    saveWarnings();

    bot.sendMessage(
      chatId,
      `✅ اخطار ${msg.reply_to_message.from.first_name} حذف شد! \n📌 اخطار باقی‌مانده: ${warnings[targetId].count || 0}`
    );
  } else {
    bot.sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد!`);
  }
}

// Handle command list
function handleCommandList(chatId) {
  bot.sendMessage(
    chatId,
    `
    📜 **لیست دستورات ربات**:

    1️⃣ **روشن** - فعال‌سازی ربات توسط صاحب گروه.
    2️⃣ **اخطار** - اخطار دادن به کاربر.
    3️⃣ **کیک/صیک** - اخراج کاربر از گروه.
    4️⃣ **سکوت** - بی‌صدا کردن کاربر.
    5️⃣ **سخنگو** - بازگرداندن صدای کاربر.
    6️⃣ **حذف اخطار** - حذف یک اخطار از کاربر.
    7️⃣ **گزارش** - گزارش دادن پیام به ادمین‌ها و صاحب گروه.
    `
  );
}

// User report system
bot.on("message", async (msg) => {
  if (!msg || !msg.chat || !msg.from || !msg.text || !msg.reply_to_message) return;
  if (!data.active || !isAllowedGroup(msg.chat)) return;

  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "گزارش") {
    try {
      const admins = await bot.getChatAdministrators(chatId);
      const reportedUser = msg.reply_to_message.from?.first_name || "کاربر نامشخص";
      const reportText = msg.reply_to_message.text || "بدون متن";
      const reportedBy = msg.from.first_name;

      const reportMessage = `
        🚨 **گزارش جدید**
        📌 **گزارش دهنده**: ${reportedBy}
        📝 **گزارش شده**: ${reportedUser}
        📄 **متن گزارش**: ${reportText}
      `;

      let reportSent = false;

      for (const admin of admins) {
        try {
          await bot.sendMessage(admin.user.id, reportMessage);
          reportSent = true;
        } catch (error) {
          console.error(`Failed to send report to admin ${admin.user.id}:`, error);
        }
      }

      if (reportSent) {
        bot.sendMessage(chatId, `✅ گزارش شما با موفقیت ارسال شد.`);
      } else {
        bot.sendMessage(chatId, `❌ گزارش شما ارسال نشد. مطمئن شوید که ادمین‌ها با ربات چت کرده‌اند.`);
      }
    } catch (error) {
      console.error("Error sending report:", error);
      bot.sendMessage(chatId, "❌ مشکلی در ارسال گزارش پیش آمد.");
    }
  }
});

// Main message handler
bot.on("message", async (msg) => {
  try {
    await handleActivation(msg);
    await handleBadWords(msg);

    // Allow admins and owners to use commands
    if (msg && msg.chat && msg.from && await isAdminUser(msg.chat.id, msg.from.id)) {
      await handleAdminActions(msg);
    }
  } catch (error) {
    console.error("Error in main message handler:", error);
  }
});

// Load warnings on startup
loadWarnings();

// Error handler
bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
});

// Log bot startup
console.log("Bot has been started...");
