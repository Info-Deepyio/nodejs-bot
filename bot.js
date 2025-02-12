const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");

// Replace with your bot's token
const TOKEN = "7953627451:AAFPvdnqE7GPQbmVlFNys7GvrHBARWuXAWY";
const CHANNEL_USERNAME = "@MYMINEMC";

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start (.*)?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = msg.from.first_name || "دوست عزیز";
    const commandArg = match[1];

    try {
        // Check if user is a member of the channel
        const res = await bot.getChatMember(CHANNEL_USERNAME, chatId);
        const isMember = ["member", "administrator", "creator"].includes(res.status);

        if (!isMember) {
            return askToJoin(chatId);
        }

        // User is a member, handle special commands
        if (commandArg) {
            return handleSpecialStart(chatId, commandArg);
        }

        // Normal /start response
        bot.sendMessage(chatId, `سلام ${username}! 👋✨`);
    } catch (error) {
        console.error("Error checking membership:", error);
        askToJoin(chatId);
    }
});

// Function to ask user to join the channel
function askToJoin(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📢 لینک چنل", url: "https://t.me/MYMINEMC" }],
                [{ text: "🔄 چک کردن عضویت", callback_data: "check_membership" }]
            ]
        }
    };

    bot.sendMessage(chatId, "🔔 لطفا اول عضو کانال شوید:", options)
        .then(sentMessage => {
            bot.once("callback_query", async query => {
                if (query.data === "check_membership") {
                    try {
                        const res = await bot.getChatMember(CHANNEL_USERNAME, chatId);
                        const isMember = ["member", "administrator", "creator"].includes(res.status);

                        if (!isMember) {
                            bot.editMessageText("❌ لطفا اول عضو کانال شوید!", {
                                chat_id: chatId,
                                message_id: sentMessage.message_id,
                                reply_markup: options.reply_markup
                            });
                        } else {
                            bot.deleteMessage(chatId, sentMessage.message_id);
                            bot.sendMessage(chatId, "✅ عضویت تایید شد!");
                            bot.sendMessage(chatId, "سلام! 👋✨");
                        }
                    } catch (error) {
                        console.error("Error checking membership:", error);
                    }
                }
            });
        });
}

// Function to handle special start arguments
function handleSpecialStart(chatId, argument) {
    if (argument.startsWith("getFile")) {
        const fileName = argument.replace("getFile", "") + ".txt";
        const filePath = `./files/${fileName}`;

        if (fs.existsSync(filePath)) {
            bot.sendDocument(chatId, filePath, { caption: "📁 فایل شما:" });
        } else {
            bot.sendMessage(chatId, "❌ فایل مورد نظر یافت نشد!");
        }
    } else {
        bot.sendMessage(chatId, "❌ دستور نامعتبر است!");
    }
}

console.log("✅ Bot is running...");
