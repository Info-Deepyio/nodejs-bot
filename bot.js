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
});

// User Report System
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === "گزارش") {
    // Fetch an admin
    const admins = await bot.getChatAdministrators(chatId);
    const admin = admins.find(admin => admin.user.id !== userId);

    if (admin) {
      bot.sendMessage(
        admin.user.id,
        `🚨 گزارش جدید:\n📌 فرستنده: ${msg.reply_to_message.from.first_name}\n📝 متن: ${msg.reply_to_message.text || "بدون متن"}\n👤 گزارش دهنده: ${msg.from.first_name}`
      );
      bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
    } else {
      bot.sendMessage(chatId, "⚠️ هیچ ادمینی در گروه نیست!");
    }
  }
});
