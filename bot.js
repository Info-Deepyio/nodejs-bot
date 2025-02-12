const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token (Replace with your actual bot token)
const TOKEN = "7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY";
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

    // Send inline keyboard with the report
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "ارسال اخطار به گزارش‌دهنده",
            callback_data: `warning_reporter_${userId}_${reportedBy}_${reportedUser}`
          },
          {
            text: "ارسال اخطار به کاربر گزارش شده",
            callback_data: `warning_reported_${targetId}_${reportedBy}_${reportedUser}`
          }
        ]
      ]
    };

    // Forward the report to all admins in their DMs
    admins.forEach((admin) => {
      if (admin.user.id !== userId) {
        bot.sendMessage(admin.user.id, reportMessage, { reply_markup: inlineKeyboard });
      }
    });

    // Acknowledge the report to the user
    bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
  }
});

// Handle Inline Keyboard Button Press (ارسال اخطار)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  // Split the callback data to get the action and the user
  const parts = data.split('_');
  const action = parts[0];
  const targetUserId = parts[1];
  const reportedBy = parts[2];
  const reportedUser = parts[3];

  if (action === "warning_reporter") {
    // Handle warning for the reporter
    if (!data.warnings[targetUserId]) {
      data.warnings[targetUserId] = 1; // First warning for the user
    } else {
      data.warnings[targetUserId]++; // Increment warning count
    }
    saveData();

    // Send the warning message to the chat
    bot.sendMessage(chatId, `⚠️ کاربر ${reportedBy} به دلیل ارسال گزارش اخطار گرفت!`);

    // Update the report message with warning status
    bot.editMessageText(
      query.message.text + `\n📌 کاربر ${reportedBy} اخطار گرفت و در گپ پیام اخطار ارسال شد. 🚨`,
      { chat_id: chatId, message_id: query.message.message_id }
    );

    // Acknowledge the action to the admin
    bot.answerCallbackQuery(query.id, { text: "اخطار ارسال شد!", show_alert: false });
  }

  if (action === "warning_reported") {
    // Handle warning for the reported user
    if (!data.warnings[targetUserId]) {
      data.warnings[targetUserId] = 1; // First warning for the user
    } else {
      data.warnings[targetUserId]++; // Increment warning count
    }
    saveData();

    // Send the warning message to the chat
    bot.sendMessage(chatId, `⚠️ کاربر ${reportedUser} به دلیل گزارش اخطار گرفت!`);

    // Update the report message with warning status
    bot.editMessageText(
      query.message.text + `\n📌 کاربر ${reportedUser} اخطار گرفت و در گپ پیام اخطار ارسال شد. 🚨`,
      { chat_id: chatId, message_id: query.message.message_id }
    );

    // Acknowledge the action to the admin
    bot.answerCallbackQuery(query.id, { text: "اخطار ارسال شد!", show_alert: false });
  }
});
