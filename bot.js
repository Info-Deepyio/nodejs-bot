const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Bot Token
const TOKEN = "7948201057:AAGdjlJ7XGdObnxlIUpXfXqOXUrCILApxKE";
const bot = new TelegramBot(TOKEN, { polling: true });

// Group handle
const ALLOWED_GROUP = "@Roblocksx";

// File paths
const DATA_FILE = "data.json";
const WARNINGS_FILE = "warnings.json";
const MUTE_STATUS_FILE = "mute_status.json";

// Data structures
let data = { active: false, admins: {} };
let warnings = {};
let muteStatus = {};

// Offensive words list
const badWords = [
  "کیر", "کص", "کون", "کونده", "کصده", "جند", "کصمادر", "اوبی", "اوبنه ای",
  "تاقال", "تاقار", "حروم", "جاکش", "حرومی", "پدرسگ", "مادرجنده", "تخم سگ"
];

// File operations
function loadFile(filePath, defaultValue) {
  try {
    return fs.existsSync(filePath) 
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : defaultValue;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return defaultValue;
  }
}

function saveFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
  }
}

// Initialize data
function initializeData() {
  data = loadFile(DATA_FILE, { active: false, admins: {} });
  warnings = loadFile(WARNINGS_FILE, {});
  muteStatus = loadFile(MUTE_STATUS_FILE, {});
}

// Save functions
const saveData = () => saveFile(DATA_FILE, data);
const saveWarnings = () => saveFile(WARNINGS_FILE, warnings);
const saveMuteStatus = () => saveFile(MUTE_STATUS_FILE, muteStatus);

// Helper functions
function isAllowedGroup(chat) {
  return chat.type === "supergroup" && chat.username === ALLOWED_GROUP.replace("@", "");
}

async function isAdminUser(chatId, userId) {
  try {
    const chatMember = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(chatMember.status);
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

async function canModerateUser(chatId, moderatorId, targetId) {
  if (!targetId || moderatorId === targetId) return false;
  
  const [moderatorIsAdmin, targetIsAdmin] = await Promise.all([
    isAdminUser(chatId, moderatorId),
    isAdminUser(chatId, targetId)
  ]);
  
  return moderatorIsAdmin && !targetIsAdmin;
}

async function checkMuteStatus(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return !member.can_send_messages;
  } catch (error) {
    console.error("Error checking mute status:", error);
    return false;
  }
}

// Command handlers
async function handleActivation(msg) {
  const { chat: { id: chatId }, from: { id: userId }, text } = msg;

  if (!isAllowedGroup(msg.chat)) return;

  const isOwner = (await bot.getChatMember(chatId, userId)).status === "creator";
  
  if (text === "روشن" && isOwner) {
    if (data.active) {
      return bot.sendMessage(chatId, "⚠️ ربات قبلا فعال شده است.");
    }
    data.active = true;
    saveData();
    return bot.sendMessage(chatId, "✅ ربات با موفقیت فعال شد!");
  }
}

async function handleBadWords(msg) {
  const { chat: { id: chatId }, from: { id: userId, first_name }, text } = msg;

  if (!data.active || !isAllowedGroup(msg.chat)) return;

  const isAdmin = await isAdminUser(chatId, userId);
  if (isAdmin) return;

  if (badWords.some(word => text.includes(word))) {
    try {
      await bot.deleteMessage(chatId, msg.message_id);
      
      if (!warnings[userId]) {
        warnings[userId] = { count: 0, mutedDueToWarnings: false };
      }

      if (warnings[userId].count < 3) {
        warnings[userId].count++;
        saveWarnings();

        await bot.sendMessage(
          chatId,
          `⚠️ ${first_name}، پیام شما حذف شد! \n📌 اخطار ${warnings[userId].count}/3`
        );

        if (warnings[userId].count >= 3 && !warnings[userId].mutedDueToWarnings) {
          warnings[userId].mutedDueToWarnings = true;
          await handleMute(chatId, userId, msg, true);
        }
      }
    } catch (error) {
      console.error("Error handling bad words:", error);
    }
  }
}

async function handleMute(chatId, targetId, msg, isAutoMute = false) {
  if (!targetId) {
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  if (!isAutoMute) {
    const canModerate = await canModerateUser(chatId, msg.from.id, targetId);
    if (!canModerate) {
      return bot.sendMessage(chatId, "⚠️ شما نمی‌توانید ادمین‌ها را بی‌صدا کنید.");
    }
  }

  const isMuted = await checkMuteStatus(chatId, targetId);
  if (isMuted) {
    return bot.sendMessage(chatId, "⚠️ این کاربر در حال حاضر بی‌صدا است.");
  }

  try {
    await bot.restrictChatMember(chatId, targetId, {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false
    });

    muteStatus[targetId] = true;
    saveMuteStatus();

    const targetName = msg.reply_to_message?.from.first_name || "کاربر";
    await bot.sendMessage(chatId, `🔇 ${targetName} بی‌صدا شد!`);
  } catch (error) {
    console.error("Error muting user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در بی‌صدا کردن کاربر پیش آمد.");
  }
}

async function handleUnmute(chatId, targetId, msg) {
  if (!targetId) {
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  const canModerate = await canModerateUser(chatId, msg.from.id, targetId);
  if (!canModerate) {
    return bot.sendMessage(chatId, "⚠️ شما نمی‌توانید این دستور را برای ادمین‌ها استفاده کنید.");
  }

  const isMuted = await checkMuteStatus(chatId, targetId);
  if (!isMuted) {
    return bot.sendMessage(chatId, "⚠️ این کاربر در حال حاضر می‌تواند صحبت کند.");
  }

  try {
    await bot.restrictChatMember(chatId, targetId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });

    delete muteStatus[targetId];
    saveMuteStatus();

    const targetName = msg.reply_to_message?.from.first_name || "کاربر";
    await bot.sendMessage(chatId, `📣 ${targetName} دوباره قادر به صحبت کردن شد! 🎉`);
  } catch (error) {
    console.error("Error unmuting user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در بازگرداندن صدای کاربر پیش آمد.");
  }
}

async function handleWarning(chatId, targetId, msg) {
  if (!targetId) {
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  const canModerate = await canModerateUser(chatId, msg.from.id, targetId);
  if (!canModerate) {
    return bot.sendMessage(chatId, "⚠️ شما نمی‌توانید به ادمین‌ها اخطار دهید.");
  }

  if (!warnings[targetId]) {
    warnings[targetId] = { count: 0, mutedDueToWarnings: false };
  }

  if (warnings[targetId].count >= 3) {
    return bot.sendMessage(
      chatId,
      `❌ ${msg.reply_to_message.from.first_name} قبلاً 3 اخطار دریافت کرده است!`
    );
  }

  warnings[targetId].count++;
  saveWarnings();

  await bot.sendMessage(
    chatId,
    `⚠️ ${msg.reply_to_message.from.first_name} توسط ${msg.from.first_name} اخطار گرفت! \n📌 اخطار ${warnings[targetId].count}/3`
  );

  if (warnings[targetId].count >= 3) {
    warnings[targetId].mutedDueToWarnings = true;
    await handleMute(chatId, targetId, msg, true);
  }
}

async function handleKick(chatId, targetId, msg) {
  if (!targetId) {
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  const canModerate = await canModerateUser(chatId, msg.from.id, targetId);
  if (!canModerate) {
    return bot.sendMessage(chatId, "⚠️ شما نمی‌توانید ادمین‌ها را اخراج کنید.");
  }

  try {
    await bot.kickChatMember(chatId, targetId);
    const targetName = msg.reply_to_message?.from.first_name || "کاربر";
    await bot.sendMessage(chatId, `🚫 ${targetName} از گروه اخراج شد!`);
  } catch (error) {
    console.error("Error kicking user:", error);
    bot.sendMessage(chatId, "❌ مشکلی در اخراج کاربر پیش آمد.");
  }
}

async function handleRemoveWarning(chatId, targetId, msg) {
  if (!targetId) {
    return bot.sendMessage(chatId, "❌ لطفا به یک پیام پاسخ دهید.");
  }

  const canModerate = await canModerateUser(chatId, msg.from.id, targetId);
  if (!canModerate) {
    return bot.sendMessage(chatId, "⚠️ شما نمی‌توانید اخطار ادمین‌ها را حذف کنید.");
  }

  if (!warnings[targetId] || warnings[targetId].count === 0) {
    return bot.sendMessage(
      chatId,
      `❌ ${msg.reply_to_message.from.first_name} هیچ اخطاری ندارد!`
    );
  }

  warnings[targetId].count--;
  
  if (warnings[targetId].count === 0 && warnings[targetId].mutedDueToWarnings) {
    warnings[targetId].mutedDueToWarnings = false;
    await handleUnmute(chatId, targetId, msg);
  }

  saveWarnings();

  await bot.sendMessage(
    chatId,
    `✅ اخطار ${msg.reply_to_message.from.first_name} حذف شد! \n📌 اخطار باقی‌مانده: ${warnings[targetId].count}`
  );
}

// Main message handlers
bot.on("message", async (msg) => {
  try {
    if (!msg || !msg.chat) return;

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!text) return;

    await handleActivation(msg);

    if (!data.active || !isAllowedGroup(msg.chat)) return;

    const isAdmin = await isAdminUser(chatId, userId);

    if (!isAdmin) {
      await handleBadWords(msg);
    }

    if (isAdmin) {
      switch (text) {
        case "اخطار":
          await handleWarning(chatId, msg.reply_to_message?.from.id, msg);
          break;
        case "کیک":
        case "صیک":
          await handleKick(chatId, msg.reply_to_message?.from.id, msg);
          break;
        case "سکوت":
          await handleMute(chatId, msg.reply_to_message?.from.id, msg);
          break;
        case "سخنگو":
          await handleUnmute(chatId, msg.reply_to_message?.from.id, msg);
          break;
        case "حذف اخطار":
          await handleRemoveWarning(chatId, msg.reply_to_message?.from.id, msg);
          break;
        case "لیست":
          await handleCommandList(chatId);
          break;
      }
    }
  } catch (error) {
    console.error("Error in message handler:", error);
  }
});

// Initialize on startup
initializeData();
