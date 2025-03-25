const axios = require('axios');
const moment = require('moment-jalaali');
const { MongoClient } = require('mongodb');

// Configuration
const BOT_TOKEN = '1160037511:EQNWiWm1RMmMbCydsXiwOsEdyPbmomAuwu4tX6Xb';
const MONGODB_URI = 'mongodb://mongo:nbEmnyowiInvldFDLwbTSLvskSWWNUTT@nozomi.proxy.rlwy.net:57792';
const GROUP_ID = 5272323810;
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;

// MongoDB connection
const client = new MongoClient(MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

let db;

// Whitelisted usernames (without @)
const whitelistedUsernames = new Set([
    'zonercm',
    'admin2'
    // Add more usernames here
]);

// Connect to MongoDB with improved error handling
async function connectDB() {
    try {
        await client.connect();
        db = client.db();
        
        // Create indexes with error handling
        await Promise.all([
            db.collection('files').createIndex({ code: 1 }, { unique: true }),
            db.collection('autoMessages').createIndex({ userId: 1 }, { unique: true })
        ]);
        
        console.log('Connected to MongoDB successfully');
        return db;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        
        // Wait and retry or exit
        await new Promise(resolve => setTimeout(resolve, 5000));
        process.exit(1);
    }
}

// Centralized error handler
function handleError(context, error) {
    console.error(`Error in ${context}:`, error);
    // Optional: Add more robust error logging
}

// Send message with improved error handling
async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text,
            reply_markup: replyMarkup,
            parse_mode: 'HTML'
        });
    } catch (error) {
        handleError('sendMessage', error);
        
        // Log detailed error info
        if (error.response) {
            console.error('Response error details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
    }
}

// Edit message with improved error handling
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
        handleError('editMessage', error);
        
        // Log detailed error info
        if (error.response) {
            console.error('Response error details:', {
                status: error.response.status,
                data: error.response.data
            });
        }
    }
}

// Initialize the bot with more robust error handling
async function initBot() {
    let offset = 0;
    const MAX_RETRY_DELAY = 30000; // 30 seconds max delay
    let retryDelay = 1000; // Start with 1 second
    
    while (true) {
        try {
            const response = await axios.get(`${API_URL}/getUpdates`, {
                params: { offset, timeout: 30 }
            });
            
            // Reset retry delay on successful connection
            retryDelay = 1000;
            
            if (response.data.ok && response.data.result.length > 0) {
                for (const update of response.data.result) {
                    offset = update.update_id + 1;
                    try {
                        await handleUpdate(update);
                    } catch (updateError) {
                        console.error('Error processing update:', updateError);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching updates:', error);
            
            // Exponential backoff with max delay
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
        }
    }
}

// Rest of the original functions remain the same...

// Main function
async function main() {
    await connectDB();
    await initBot();
}

// Start the bot
main().catch(console.error);
