const axios = require("axios");

// Bot Token (Replace with your actual bot token)
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group ID (Replace with your actual group ID)
const ALLOWED_GROUP_ID = 6190641192;

// Send message to chat
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
  } catch (error) {
    console.error("Error sending message:", error.message);
  }
}

// Process incoming messages
async function handleMessage(message) {
  if (!message || !message.chat || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim().toLowerCase(); // Normalize text

  if (chatId === ALLOWED_GROUP_ID && text === "hi") {
    await sendMessage(chatId, "hello");
  }
}

// Polling mechanism
let offset = 0;
async function getUpdates() {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: { offset: offset, timeout: 30 },
    });

    if (response.data && response.data.result.length > 0) {
      for (const update of response.data.result) {
        if (update.message) await handleMessage(update.message);
        offset = update.update_id + 1; // Update offset after processing
      }
    }
  } catch (error) {
    console.error("Error getting updates:", error.message);
  } finally {
    getUpdates(); // Recursively call for instant updates
  }
}

// Start bot
console.log("Bot is running...");
getUpdates();
