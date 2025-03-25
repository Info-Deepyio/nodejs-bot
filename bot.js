const axios = require('axios');
const moment = require('moment-jalaali');
const { MongoClient } = require('mongodb');

// Configuration - replace these with your actual values
const BOT_TOKEN = '1160037511:EQNWiWm1RMmMbCydsXiwOsEdyPbmomAuwu4tX6Xb';
const MONGODB_URI = 'mongodb://mongo:nbEmnyowiInvldFDLwbTSLvskSWWNUTT@nozomi.proxy.rlwy.net:57792';
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;

// MongoDB connection
const client = new MongoClient(MONGODB_URI);
let db;

// Whitelisted user IDs
const whitelistedUsers = new Set([
    // Add your whitelisted user IDs here
    123456789,
    987654321
]);

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        db = client.db();
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

// Initialize the bot
async function initBot() {
    let offset = 0;
    
    while (true) {
        try {
            const response = await axios.get(`${API_URL}/getUpdates`, {
                params: { offset, timeout: 30 }
            });
            
            if (response.data.ok && response.data.result.length > 0) {
                for (const update of response.data.result) {
                    offset = update.update_id + 1;
                    handleUpdate(update);
                }
            }
        } catch (error) {
            console.error('Error fetching updates:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Handle incoming updates
async function handleUpdate(update) {
    if (!update.message) return;
    
    const { message } = update;
    const userId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text || '';
    
    // Check if user is whitelisted
    if (!whitelistedUsers.has(userId)) {
        await sendMessage(chatId, '⛔ شما مجوز استفاده از این ربات را ندارید.');
        return;
    }
    
    // Greet new users
    if (message.new_chat_members) {
        for (const user of message.new_chat_members) {
            await greetUser(chatId, user);
        }
        return;
    }
    
    // Handle commands
    if (text.startsWith('/start')) {
        const startCode = text.split(' ')[1];
        if (startCode) {
            await handleStartCode(chatId, startCode);
        } else {
            await sendWelcomeMessage(chatId, message.from);
        }
    } else if (text === 'پنل') {
        await showPanel(chatId);
    }
}

// Send message helper
async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text,
            reply_markup: replyMarkup,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Greet user
async function greetUser(chatId, user) {
    const persianDate = moment().format('jYYYY/jMM/jDD');
    const greeting = `👋 سلام <b>${user.first_name}</b>! به جمع ما خوش آمدی!\n\n📅 امروز: <b>${persianDate}</b>`;
    await sendMessage(chatId, greeting);
}

// Send welcome message
async function sendWelcomeMessage(chatId, user) {
    const persianDate = moment().format('jYYYY/jMM/jDD');
    const welcomeMsg = `👋 سلام <b>${user.first_name}</b>! به ربات خوش آمدید!\n\n📅 تاریخ امروز: <b>${persianDate}</b>\n\nبرای مشاهده پنل مدیریت، کلمه <code>پنل</code> را ارسال کنید.`;
    await sendMessage(chatId, welcomeMsg);
}

// Show admin panel
async function showPanel(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '📬 مدیریت پیام‌ها', callback_data: 'messaging_panel' }],
            [{ text: '📤 آپلود فایل', callback_data: 'upload_panel' }]
        ]
    };
    
    await sendMessage(chatId, '🔹 <b>پنل مدیریت ربات</b> 🔹\n\nلطفا یکی از گزینه‌ها را انتخاب کنید:', keyboard);
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (data === 'messaging_panel') {
        await showMessagingPanel(chatId);
    } else if (data === 'upload_panel') {
        await showUploadPanel(chatId);
    }
    // Add more callback handlers as needed
}

// Show messaging panel
async function showMessagingPanel(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '📩 ارسال به همه کاربران', callback_data: 'send_to_all' }],
            [{ text: '👥 ارسال به اعضای گروه', callback_data: 'send_to_members' }],
            [{ text: '🚫 ارسال به غیراعضای گروه', callback_data: 'send_to_non_members' }],
            [{ text: '⏰ ارسال خودکار (هر 2 ساعت)', callback_data: 'toggle_auto_send' }],
            [{ text: '🔙 بازگشت', callback_data: 'back_to_main' }]
        ]
    };
    
    await sendMessage(chatId, '📬 <b>پنل مدیریت پیام‌ها</b>\n\nلطفا گزینه مورد نظر را انتخاب کنید:', keyboard);
}

// Show upload panel
async function showUploadPanel(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔒 فایل با رمز', callback_data: 'upload_with_pass' }],
            [{ text: '🔓 فایل بدون رمز', callback_data: 'upload_no_pass' }],
            [{ text: '🔙 بازگشت', callback_data: 'back_to_main' }]
        ]
    };
    
    await sendMessage(chatId, '📤 <b>پنل آپلود فایل</b>\n\nلطفا نوع آپلود را انتخاب کنید:', keyboard);
}

// Handle start code
async function handleStartCode(chatId, code) {
    // Implement file retrieval logic here
    const file = await db.collection('files').findOne({ code });
    if (file) {
        if (file.password) {
            await sendMessage(chatId, '🔒 این فایل با رمز محافظت شده است. لطفا رمز را وارد کنید:');
            // Implement password check logic
        } else {
            // Send the file to user
            await sendFile(chatId, file);
        }
    } else {
        await sendMessage(chatId, '⚠️ فایل مورد نظر یافت نشد.');
    }
}

// Send file to user
async function sendFile(chatId, file) {
    try {
        // Implement file sending logic based on file type
        // This is a simplified example
        await axios.post(`${API_URL}/sendDocument`, {
            chat_id: chatId,
            document: file.fileId,
            caption: file.caption || 'فایل شما آماده دانلود است.'
        });
    } catch (error) {
        console.error('Error sending file:', error);
        await sendMessage(chatId, '⚠️ خطا در ارسال فایل. لطفا دوباره امتحان کنید.');
    }
}

// Main function
async function main() {
    await connectDB();
    await initBot();
}

// Start the bot
main().catch(console.error);
