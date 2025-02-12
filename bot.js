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
  }
} else {
  saveData();
}

// Save data to `data.json`
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Offensive words list
const badWords = [
  "کیر", "کص", "کون", "کونده", "کصده", "جند", "کصمادر", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "حرومی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// Bot Activation by Owner
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const isGroup = msg.chat.type.includes("group");

  // Ensure bot is working only in the specified group
  if (isGroup && msg.chat.username !== ALLOWED_GROUP.replace("@", "")) return;

  // Check if the user is the owner or an admin
  const chatMember = await bot.getChatMember(chatId, userId);
  const isOwner = chatMember.status === "creator";
  const isAdmin = isOwner || chatMember.status === "administrator";

  // Store admins in JSON for immunity
  if (isAdmin) data.admins[userId] = true;

  // Ensure activation first
  if (!data.active && text !== "روشن") return;

  // Activation Logic
  if (text === "روشن" && isOwner) {
    if (data.active) {
      return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
    }
    data.active = true;
    saveData();
    return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!");
  }

  // Ignore non-active bot for everyone
  if (!data.active) return;

  // Check for offensive words
  if (badWords.some(word => text.includes(word))) {
    if (isAdmin) return; // Admin immunity
    bot.deleteMessage(chatId, msg.message_id);

    // Warning System: Update the user's warning count
    if (!data.warnings[userId]) {
      data.warnings[userId] = 1; // First warning for the user
    } else {
      data.warnings[userId]++; // Increment warning count
    }
    saveData();

    bot.sendMessage(
      chatId,
      `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${data.warnings[userId]}/3`
    );

    // Mute User if 3 warnings
    if (data.warnings[userId] >= 3) {
      bot.restrictChatMember(chatId, userId, { can_send_messages: false });
      bot.sendMessage(chatId, `🔇 ${msg.from.first_name} به دلیل 3 اخطار، بی‌صدا شد!`);
    }
  }
});

// Admin Actions
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = msg.reply_to_message.from.id;
  const text = msg.text;

  const chatMember = await bot.getChatMember(chatId, userId);
  const isAdmin = chatMember.status === "creator" || chatMember.status === "administrator";

  if (!isAdmin) return;

  // Warning System by Admin
  if (text === "اخطار") {
    if (!data.warnings[targetId]) {
      data.warnings[targetId] = 1; // First warning for the user
    } else {
      data.warnings[targetId]++; // Increment warning count
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

  // Kick User
  if (text === "کیک" || text === "صیک") {
    bot.kickChatMember(chatId, targetId);
    bot.sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  }

  // Mute User (سکوت)
  if (text === "سکوت") {
    try {
      // Restrict the user from sending messages, media, gifs, etc.
      bot.restrictChatMember(chatId, targetId, {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_send_gifs: false,
        can_send_stickers: false
      });
      bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
    } catch (err) {
      console.error("Error muting user:", err);
    }
  }

  // Unmute User (سخنگو)
  if (text === "سخنگو") {
    try {
      // Unmute the user (restore all permissions to send messages, media, etc.)
      await bot.restrictChatMember(chatId, targetId, {
        can_send_messages: true,          // Allow sending messages
        can_send_media_messages: true,    // Allow sending media
        can_send_other_messages: true,    // Allow sending other messages
        can_send_gifs: true,              // Allow sending GIFs
        can_send_stickers: true           // Allow sending stickers
      });

      bot.sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
    } catch (err) {
      console.error("Error unmuting user:", err);
      bot.sendMessage(chatId, "❌ مشکلی در انجام درخواست پیش آمد.");
    }
  }

  // Remove warning
  if (text === "حذف اخطار") {
    if (!data.warnings[targetId]) {
      return bot.sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد!`);
    }

    data.warnings[targetId]--;
    if (data.warnings[targetId] <= 0) {
      delete data.warnings[targetId];
    }
    saveData();
    
    bot.sendMessage(
      chatId,
      `✅ اخطار ${msg.reply_to_message.from.first_name} حذف شد! \n📌 اخطار باقی‌مانده: ${data.warnings[targetId] || 0}`
    );
  }

  // List of Commands (لیست)
  if (text === "لیست") {
    bot.sendMessage(
      chatId,
      `
      📜 **لیست دستورات ربات**:
      
      1️⃣ **روشن** - فعال‌سازی ربات توسط صاحب گروه.
      2️⃣ **اخطار** - اخطار دادن به کاربر.
      3️⃣ **کیک/صیک** - اخراج کاربر از گروه.
      4️⃣ **سکوت** - بی‌صدا کردن کاربر (ممنوعیت ارسال پیام‌ها و رسانه‌ها).
      5️⃣ **سخنگو** - بازگرداندن صحبت کردن به کاربر.
      6️⃣ **حذف اخطار** - حذف یک اخطار از کاربر.
      7️⃣ **گزارش** - گزارش دادن پیام به ادمین‌ها و صاحب گروه.
      `
    );
  }
});

// User Report System
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === "گزارش") {
    // Get all admins
    const admins = await bot.getChatAdministrators(chatId);

    // Prepare the report message
    const reportedUser = msg.reply_to_message.from.first_name;
    const reportText = msg.reply_to_message.text || "بدون متن";
    const reportedBy = msg.from.first_name;

    const reportMessage = `
      🚨 **گزارش جدید**
      📌 **گزارش دهنده**: ${reportedBy}
      📝 **پیام گزارش شده**: ${reportText}
      👤 **کاربر گزارش شده**: ${reportedUser}

      ⚠️ این پیام به تمامی ادمین‌ها و صاحب گروه ارسال شد.
    `;

    // Forward the report to all admins in their DMs
    admins.forEach((admin) => {
      if (admin.user.id !== userId) {
        bot.sendMessage(admin.user.id, reportMessage);
      }
    });

    // Acknowledge the report to the user
    bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
  }
});
