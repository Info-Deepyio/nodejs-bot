const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token (Replace with your actual bot token)
const TOKEN = "7948201057:AAGdjlJ7XGdObnxlIUpXfXqOXUrCILApxKE";
const bot = new TelegramBot(TOKEN, { polling: true });

// Group handle
const ALLOWED_GROUP = "@Roblocksx";

// Load data from JSON file
const DATA_FILE = "data.json";

// Initialize data structure if `data.json` doesn't exist
let data = {
  active: false,
  warnings: {},
  admins: {}
};

// Check if data.json exists, otherwise create it
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Error reading data.json:", error);
    data = { active: false, warnings: {}, admins: {} }; // Reset data on parse failure
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
  "کیر", "کص", "کون", "کونده", "کصده", "جند", "کصمادر", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "حرومی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// Function to check if the bot is in the allowed group
function isAllowedGroup(chat) {
  return chat.type === "supergroup" && chat.username === ALLOWED_GROUP.replace("@", "");
}

// Handle activation
async function handleActivation(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!isAllowedGroup(msg.chat)) return;

  const chatMember = await bot.getChatMember(chatId, userId);
  const isOwner = chatMember.status === "creator";

  if (text === "روشن" && isOwner) {
    if (data.active) {
      return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
    }
    data.active = true;
    saveData();
    return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!");
  }
}

// Handle offensive words
async function handleBadWords(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!data.active || !isAllowedGroup(msg.chat)) return;

  const isAdmin = await isAdminUser(chatId, userId);
  if (isAdmin) return; // Admins are immune

  if (badWords.some(word => text.includes(word))) {
    bot.deleteMessage(chatId, msg.message_id);

    if (!data.warnings[userId]) {
      data.warnings[userId] = 1;
    } else {
      // Cap warnings at 3
      data.warnings[userId] = Math.min(data.warnings[userId] + 1, 3);
    }

    saveData();

    bot.sendMessage(
      chatId,
      `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${data.warnings[userId]}/3`
    );

    if (data.warnings[userId] >= 3) {
      await bot.restrictChatMember(chatId, userId, { can_send_messages: false });
      bot.sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
    }
  }
}

// Check if a user is an admin or owner
async function isAdminUser(chatId, userId) {
  const chatMember = await bot.getChatMember(chatId, userId);
  return chatMember.status === "creator" || chatMember.status === "administrator";
}

// Admin actions
async function handleAdminActions(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = msg.reply_to_message?.from.id;
  const text = msg.text;

  if (!data.active || !isAllowedGroup(msg.chat)) return;

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
}

// Handle warnings
function handleWarning(chatId, targetId, msg) {
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (!data.warnings[targetId]) {
    data.warnings[targetId] = 1;
  } else {
    // Cap warnings at 3
    data.warnings[targetId] = Math.min(data.warnings[targetId] + 1, 3);
  }

  saveData();

  bot.sendMessage(
    chatId,
    `⚠️ ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} اخطار گرفت! \n📌 اخطار ${data.warnings[targetId]}/3`
  );

  if (data.warnings[targetId] >= 3) {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: false });
    bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
  }
}

// Handle kicking users
async function handleKick(chatId, targetId, msg) {
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

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
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

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
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

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
  if (!targetId) return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");

  if (!data.warnings[targetId]) {
    return bot.sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد!`);
  }

  data.warnings[targetId]--;
  if (data.warnings[targetId] <= 0) {
    delete data.warnings[targetId];

    // Automatically unmute if user was muted due to warnings
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

  saveData();

  bot.sendMessage(
    chatId,
    `✅ اخطار ${msg.reply_to_message.from.first_name} حذف شد! \n📌 اخطار باقی‌مانده: ${data.warnings[targetId] || 0}`
  );
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
  if (!msg.reply_to_message || !data.active || !isAllowedGroup(msg.chat)) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === "گزارش") {
    try {
      const admins = await bot.getChatAdministrators(chatId);
      const reportedUser = msg.reply_to_message.from.first_name;
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
  handleActivation(msg);
  handleBadWords(msg);

  // Allow admins and owners to use commands
  if (await isAdminUser(msg.chat.id, msg.from.id)) {
    handleAdminActions(msg);
  }
});
