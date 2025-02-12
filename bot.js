const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// --- Bot Token (Replace with your bot token) ---
const TOKEN = "7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY";
const bot = new TelegramBot(TOKEN, { polling: true });

// --- Group handle ---
const ALLOWED_GROUP = "@Roblocksx";

// --- Load Data from JSON ---
const DATA_FILE = "data.json";
let data = { active: false, warnings: {}, admins: {} };

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} else {
  saveData();
}

// --- Save Data Function ---
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Offensive Words List ---
const badWords = [
  "کیر", "کص", "کون", "کونده", "کصده", "جند", "کصمادر", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "حرومی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// --- Bot Activation by Owner ---
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const isGroup = msg.chat.type.includes("group");

  // Ensure bot is working only in the specified group
  if (isGroup && msg.chat.username !== ALLOWED_GROUP.replace("@", "")) return;

  // Check if user is the owner
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
    
    // Warning System
    data.warnings[userId] = (data.warnings[userId] || 0) + 1;
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

// --- Admin Actions ---
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
    data.warnings[targetId] = (data.warnings[targetId] || 0) + 1;
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

  // Mute User
  if (text === "سکوت") {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: false });
    bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  }
});

// --- User Report System ---
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
