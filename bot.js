const axios = require('axios');
const moment = require('moment-jalaali');
const { MongoClient } = require('mongodb');

// Configuration
const BOT_TOKEN = '1160037511:EQNWiWm1RMmMbCydsXiwOsEdyPbmomAuwu4tX6Xb';
const MONGODB_URI = 'mongodb://mongo:nbEmnyowiInvldFDLwbTSLvskSWWNUTT@nozomi.proxy.rlwy.net:57792';
const GROUP_ID = 5272323810; // Replace with your group ID (negative for supergroups)
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;

// MongoDB connection
const client = new MongoClient(MONGODB_URI);
let db;

// Whitelisted usernames (without @)
const whitelistedUsernames = new Set([
    'zonercm',
    'admin2'
    // Add more usernames here
]);

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        db = client.db();
        await db.collection('files').createIndex({ code: 1 }, { unique: true });
        await db.collection('autoMessages').createIndex({ userId: 1 }, { unique: true });
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
    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
    }

    if (!update.message) return;
    
    const { message } = update;
    const chatId = message.chat.id;
    const user = message.from;
    
    // Check if user is whitelisted by username
    if (!user.username || !whitelistedUsernames.has(user.username)) {
        await sendMessage(chatId, '⛔ شما مجوز استفاده از این ربات را ندارید.');
        return;
    }
    
    // Greet new users
    if (message.new_chat_members) {
        for (const newUser of message.new_chat_members) {
            await greetUser(chatId, newUser);
        }
        return;
    }
    
    // Handle commands
    if (message.text) {
        const text = message.text;
        
        if (text.startsWith('/start')) {
            const startCode = text.split(' ')[1];
            if (startCode) {
                await handleStartCode(chatId, startCode, user);
            } else {
                await sendWelcomeMessage(chatId, user);
            }
        } else if (text === 'پنل') {
            await showPanel(chatId);
        } else if (message.reply_to_message && message.reply_to_message.text === '🔒 لطفا رمز فایل را وارد کنید:') {
            await handleFilePassword(chatId, user, text);
        }
    } else if (message.document) {
        await handleFileUpload(chatId, user, message.document);
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

// Edit message helper
async function editMessage(chatId, messageId, text, replyMarkup = null) {
    try {
        await axios.post(`${API_URL}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: replyMarkup,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error editing message:', error);
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
    const messageId = callbackQuery.message.message_id;
    const user = callbackQuery.from;
    const data = callbackQuery.data;
    
    if (!user.username || !whitelistedUsernames.has(user.username)) {
        await sendMessage(chatId, '⛔ شما مجوز استفاده از این ربات را ندارید.');
        return;
    }
    
    if (data === 'messaging_panel') {
        await showMessagingPanel(chatId, messageId);
    } else if (data === 'upload_panel') {
        await showUploadPanel(chatId, messageId);
    } else if (data === 'back_to_main') {
        await showPanel(chatId);
    } else if (data.startsWith('send_')) {
        await handleSendMessageOption(chatId, messageId, data);
    } else if (data === 'toggle_auto_send') {
        await toggleAutoSend(chatId, messageId, user);
    } else if (data.startsWith('upload_')) {
        await handleUploadOption(chatId, messageId, data);
    }
}

// Show messaging panel
async function showMessagingPanel(chatId, messageId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '📩 ارسال به همه کاربران', callback_data: 'send_all' }],
            [{ text: '👥 ارسال به اعضای گروه', callback_data: 'send_members' }],
            [{ text: '🚫 ارسال به غیراعضای گروه', callback_data: 'send_non_members' }],
            [{ text: '⏰ ارسال خودکار (هر 2 ساعت)', callback_data: 'toggle_auto_send' }],
            [{ text: '🔙 بازگشت', callback_data: 'back_to_main' }]
        ]
    };
    
    await editMessage(chatId, messageId, '📬 <b>پنل مدیریت پیام‌ها</b>\n\nلطفا گزینه مورد نظر را انتخاب کنید:', keyboard);
}

// Show upload panel
async function showUploadPanel(chatId, messageId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔒 فایل با رمز', callback_data: 'upload_with_pass' }],
            [{ text: '🔓 فایل بدون رمز', callback_data: 'upload_no_pass' }],
            [{ text: '🔙 بازگشت', callback_data: 'back_to_main' }]
        ]
    };
    
    await editMessage(chatId, messageId, '📤 <b>پنل آپلود فایل</b>\n\nلطفا نوع آپلود را انتخاب کنید:', keyboard);
}

// Handle send message options
async function handleSendMessageOption(chatId, messageId, option) {
    let target = '';
    
    switch (option) {
        case 'send_all':
            target = 'همه کاربران';
            break;
        case 'send_members':
            target = 'اعضای گروه';
            break;
        case 'send_non_members':
            target = 'غیراعضای گروه';
            break;
    }
    
    await editMessage(chatId, messageId, `✉️ <b>ارسال پیام به ${target}</b>\n\nلطفا پیام خود را ارسال کنید:`);
    // Store state in database to handle the next message
    await db.collection('userStates').updateOne(
        { userId: chatId },
        { $set: { state: `awaiting_message_${option}` } },
        { upsert: true }
    );
}

// Toggle auto send
async function toggleAutoSend(chatId, messageId, user) {
    const autoSend = await db.collection('autoMessages').findOne({ userId: user.id });
    const newStatus = !autoSend || !autoSend.enabled;
    
    await db.collection('autoMessages').updateOne(
        { userId: user.id },
        { $set: { enabled: newStatus, lastSent: null } },
        { upsert: true }
    );
    
    const statusText = newStatus ? 'فعال ✅' : 'غیرفعال ❌';
    await editMessage(chatId, messageId, `⏰ <b>ارسال خودکار پیام</b>\n\nوضعیت: ${statusText}\n\nاین ویژگی هر 2 ساعت به کاربرانی که در گروه نیستند پیام ارسال می‌کند.`);
}

// Handle upload options
async function handleUploadOption(chatId, messageId, option) {
    if (option === 'upload_with_pass') {
        await editMessage(chatId, messageId, '🔒 <b>آپلود فایل با رمز</b>\n\nلطفا رمز مورد نظر خود را ارسال کنید:');
        await db.collection('userStates').updateOne(
            { userId: chatId },
            { $set: { state: 'awaiting_password' } },
            { upsert: true }
        );
    } else if (option === 'upload_no_pass') {
        await editMessage(chatId, messageId, '📤 <b>آپلود فایل بدون رمز</b>\n\nلطفا فایل خود را ارسال کنید:');
        await db.collection('userStates').updateOne(
            { userId: chatId },
            { $set: { state: 'awaiting_file' } },
            { upsert: true }
        );
    }
}

// Handle file password
async function handleFilePassword(chatId, user, password) {
    await db.collection('userStates').updateOne(
        { userId: chatId },
        { $set: { state: 'awaiting_file', password } }
    );
    await sendMessage(chatId, '🔑 رمز ذخیره شد. لطفا فایل خود را ارسال کنید:');
}

// Handle file upload
async function handleFileUpload(chatId, user, document) {
    const userState = await db.collection('userStates').findOne({ userId: chatId });
    
    if (!userState || !userState.state.startsWith('awaiting_file')) {
        return;
    }
    
    const fileId = document.file_id;
    const fileName = document.file_name;
    const fileSize = (document.file_size / 1024 / 1024).toFixed(2); // MB
    
    // Generate random code
    const code = Math.random().toString(36).substring(2, 10);
    
    // Save to database
    await db.collection('files').insertOne({
        code,
        fileId,
        fileName,
        fileSize,
        password: userState.password || null,
        uploader: user.username,
        uploadDate: new Date()
    });
    
    // Clear user state
    await db.collection('userStates').deleteOne({ userId: chatId });
    
    // Send confirmation
    const message = `✅ فایل با موفقیت آپلود شد!\n\n📁 نام فایل: <b>${fileName}</b>\n📦 حجم فایل: <b>${fileSize} MB</b>\n🔗 لینک دسترسی: <code>/start ${code}</code>`;
    
    if (userState.password) {
        await sendMessage(chatId, message + '\n\n🔒 این فایل با رمز محافظت شده است.');
    } else {
        await sendMessage(chatId, message);
    }
}

// Handle start code
async function handleStartCode(chatId, code, user) {
    const file = await db.collection('files').findOne({ code });
    
    if (!file) {
        await sendMessage(chatId, '⚠️ فایل مورد نظر یافت نشد.');
        return;
    }
    
    if (file.password) {
        await db.collection('userStates').updateOne(
            { userId: chatId },
            { $set: { state: 'awaiting_file_password', fileCode: code } },
            { upsert: true }
        );
        await sendMessage(chatId, '🔒 لطفا رمز فایل را وارد کنید:');
    } else {
        await sendFile(chatId, file);
    }
}

// Send file to user
async function sendFile(chatId, file) {
    try {
        await axios.post(`${API_URL}/sendDocument`, {
            chat_id: chatId,
            document: file.fileId,
            caption: `📁 ${file.fileName}\n📦 حجم: ${file.fileSize} MB`
        });
    } catch (error) {
        console.error('Error sending file:', error);
        await sendMessage(chatId, '⚠️ خطا در ارسال فایل. لطفا دوباره امتحان کنید.');
    }
}

// Check if user is in group
async function isUserInGroup(userId) {
    try {
        const response = await axios.get(`${API_URL}/getChatMember`, {
            params: { chat_id: GROUP_ID, user_id: userId }
        });
        return ['member', 'administrator', 'creator'].includes(response.data.result.status);
    } catch (error) {
        console.error('Error checking group membership:', error);
        return false;
    }
}

// Main function
async function main() {
    await connectDB();
    await initBot();
}

// Start the bot
main().catch(console.error);
