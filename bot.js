const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token (Replace with your actual bot token)
const TOKEN = "7948201057:AAGdjlJ7XGdObnxlIUpXfXqOXUrCILApxKE";
const bot = new TelegramBot(TOKEN, { polling: true });

// Group handle (Change this to your group username)
const ALLOWED_GROUP = "@Deepeyo";

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
});

// **Report System (Fixes Included)**
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const reportedId = msg.reply_to_message.from.id;
  const text = msg.text;

  // Check if user is reporting
  if (text === "گزارش") {
    const chatAdmins = await bot.getChatAdministrators(chatId);
    const reportedMember = await bot.getChatMember(chatId, reportedId);
    const reporterMember = await bot.getChatMember(chatId, userId);

    const isReportedAdmin = reportedMember.status === "creator" || reportedMember.status === "administrator";
    const isReporterAdmin = reporterMember.status === "creator" || reporterMember.status === "administrator";

    // Prevent normal users from reporting admins
    if (!isReporterAdmin && isReportedAdmin) {
      return bot.sendMessage(chatId, "❌ شما نمی‌توانید یک مدیر را گزارش کنید.");
    }

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

    // Forward the report to all admins
    chatAdmins.forEach((admin) => {
      if (admin.user.id !== userId) {
        bot.sendMessage(admin.user.id, reportMessage);
      }
    });

    // Acknowledge the report to the user
    bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
  }
});
