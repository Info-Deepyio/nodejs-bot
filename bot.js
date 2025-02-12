const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token (Replace with your actual bot token)
const TOKEN = "7948201057:AAGdjlJ7XGdObnxlIUpXfXqOXUrCILApxKE";
const bot = new TelegramBot(TOKEN, { polling: true });

// Group handle
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

  if (isGroup && msg.chat.username !== ALLOWED_GROUP.replace("@", "")) return;

  const chatMember = await bot.getChatMember(chatId, userId);
  const isOwner = chatMember.status === "creator";
  const isAdmin = isOwner || chatMember.status === "administrator";

  if (isAdmin) data.admins[userId] = true;

  if (!data.active && text !== "روشن") return;

  if (text === "روشن" && isOwner) {
    if (data.active) {
      return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
    }
    data.active = true;
    saveData();
    return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!");
  }

  if (!data.active) return;

  if (badWords.some(word => text.includes(word))) {
    if (isAdmin) return;
    bot.deleteMessage(chatId, msg.message_id);

    if (!data.warnings[userId]) {
      data.warnings[userId] = 1;
    } else {
      data.warnings[userId]++;
    }
    saveData();

    bot.sendMessage(
      chatId,
      `⚠️ ${msg.from.first_name}، پیام شما حذف شد! \n📌 اخطار ${data.warnings[userId]}/3`
    );

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

  if (text === "اخطار") {
    if (!data.warnings[targetId]) {
      data.warnings[targetId] = 1;
    } else {
      data.warnings[targetId]++;
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

  if (text === "کیک" || text === "صیک") {
    bot.kickChatMember(chatId, targetId);
    bot.sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  }

  if (text === "سکوت") {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: false });
    bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  }

  if (text === "سخنگو") {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: true });
    bot.sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  }

  if (text === "حذف اخطار") {
    if (!data.warnings[targetId] || data.warnings[targetId] === 0) {
      return bot.sendMessage(chatId, `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد که حذف شود!`);
    }

    data.warnings[targetId]--;
    saveData();

    bot.sendMessage(chatId, `✅ اخطار از ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} حذف شد! \n📌 اخطار باقی‌مانده: ${data.warnings[targetId]}/3`);
  }
});

// User Report System
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === "گزارش") {
    const admins = await bot.getChatAdministrators(chatId);
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

    admins.forEach((admin) => {
      if (admin.user.id !== userId) {
        bot.sendMessage(admin.user.id, reportMessage);
      }
    });

    bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
  }
});

// Send command list
bot.on("message", (msg) => {
  if (msg.text === "لیست" && msg.chat.type.includes("group")) {
    bot.sendMessage(msg.chat.id, `
📜 **لیست دستورات ربات:**  
🔹 **روشن** - فعال‌سازی ربات  
🔹 **اخطار** - ارسال اخطار به یک کاربر  
🔹 **حذف اخطار** - حذف یک اخطار از کاربر  
🔹 **کیک** - اخراج کاربر  
🔹 **سکوت** - بی‌صدا کردن کاربر  
🔹 **سخنگو** - رفع سکوت کاربر  
🔹 **گزارش** - گزارش پیام کاربر به ادمین‌ها  
`);
  }
});
