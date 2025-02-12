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

// ✅ **Bot Activation**
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
    if (data.active) return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
    data.active = true;
    saveData();
    return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!");
  }

  if (!data.active) return;

  // ✅ **Anti-Swear System**
  if (badWords.some(word => text.includes(word))) {
    if (isAdmin) return;
    bot.deleteMessage(chatId, msg.message_id);
    data.warnings[userId] = (data.warnings[userId] || 0) + 1;
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

// ✅ **Report System**
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (text === "گزارش") {
    const admins = await bot.getChatAdministrators(chatId);
    const reportedUser = msg.reply_to_message.from;
    const reportedBy = msg.from;

    if (data.admins[reportedUser.id]) {
      return bot.sendMessage(chatId, "❌ شما نمی‌توانید یک ادمین را گزارش کنید!");
    }

    const reportText = msg.reply_to_message.text || "📷 [رسانه ارسال شده]";
    const reportMessage = `
🚨 **گزارش جدید**
📌 **گزارش دهنده**: ${reportedBy.first_name}
📝 **پیام گزارش شده**: ${reportText}
👤 **کاربر گزارش شده**: ${reportedUser.first_name}
⚠️ این پیام به تمامی ادمین‌ها و صاحب گروه ارسال شد.
    `;

    let sentToAdmins = 0;
    for (const admin of admins) {
      try {
        if (admin.user.id !== userId) {
          await bot.sendMessage(admin.user.id, reportMessage);
          sentToAdmins++;
        }
      } catch (err) {
        console.error(`⚠️ نمی‌توان پیام را برای ${admin.user.id} ارسال کرد.`);
      }
    }

    if (sentToAdmins > 0) {
      bot.sendMessage(chatId, "📩 گزارش شما ارسال شد!");
    } else {
      bot.sendMessage(chatId, "❌ امکان ارسال گزارش به ادمین‌ها وجود ندارد.");
    }
  }
});

// ✅ **Admin Commands**
bot.on("message", async (msg) => {
  if (!msg.reply_to_message || !data.active) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetId = msg.reply_to_message.from.id;
  const text = msg.text;

  const chatMember = await bot.getChatMember(chatId, userId);
  const isAdmin = chatMember.status === "creator" || chatMember.status === "administrator";

  if (!isAdmin) return;

  // **Warn User**
  if (text === "اخطار") {
    data.warnings[targetId] = (data.warnings[targetId] || 0) + 1;
    saveData();
    bot.sendMessage(chatId, `⚠️ ${msg.reply_to_message.from.first_name} اخطار گرفت! (${data.warnings[targetId]}/3)`);
  }

  // **Remove Warning**
  if (text === "حذف اخطار") {
    if (data.warnings[targetId] && data.warnings[targetId] > 0) {
      data.warnings[targetId]--;
      saveData();
      bot.sendMessage(chatId, `✅ یک اخطار از ${msg.reply_to_message.from.first_name} حذف شد!`);
    } else {
      bot.sendMessage(chatId, "❌ این کاربر هیچ اخطاری ندارد!");
    }
  }

  // **Mute & Unmute**
  if (text === "سکوت") {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: false });
    bot.sendMessage(chatId, `🔇 ${msg.reply_to_message.from.first_name} بی‌صدا شد!`);
  }

  if (text === "سخنگو") {
    bot.restrictChatMember(chatId, targetId, { can_send_messages: true });
    bot.sendMessage(chatId, `📣 ${msg.reply_to_message.from.first_name} دوباره قادر به صحبت کردن شد! 🎉`);
  }

  // **Kick User (صیک / کیک)**
  if (text === "کیک" || text === "صیک") {
    bot.kickChatMember(chatId, targetId);
    bot.sendMessage(chatId, `🚫 ${msg.reply_to_message.from.first_name} از گروه اخراج شد!`);
  }
});

// ✅ **Help Command**
bot.onText(/لیست/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📜 **دستورات ربات:**
🔹 روشن – فعال‌سازی ربات
🔹 اخطار – دادن اخطار
🔹 حذف اخطار – حذف اخطار
🔹 سکوت – بی‌صدا کردن
🔹 سخنگو – رفع سکوت
🔹 کیک / صیک – اخراج کاربر
🔹 گزارش – گزارش کاربر
🔹 لیست – نمایش این لیست
⚠️ **این ربات پیام‌های توهین‌آمیز را حذف و متخلفین را جریمه می‌کند.**
  `);
});
