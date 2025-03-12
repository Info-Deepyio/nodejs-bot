const axios = require("axios");

// Bot Token & API URL
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Allowed Group ID
const ALLOWED_GROUP_ID = 6190641192;

// Store processed message IDs to prevent duplicate handling
const processedMessages = new Set();

// Send message function
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${API_URL}/sendMessage`, { chat_id: chatId, text: text });
  } catch (error) {
    console.error("Error sending message:", error.message);
  }
}

// Process messages and prevent duplicates
async function handleMessage(message) {
  if (!message || !message.chat || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim().toLowerCase();
  const messageId = message.message_id; // Unique message ID

  // Ensure message is only processed once
  if (processedMessages.has(messageId)) return;
  processedMessages.add(messageId);

  if (chatId === ALLOWED_GROUP_ID && text === "hi") {
    await sendMessage(chatId, "hello");
  }
}

// Continuous polling function
async function startPolling() {
  let offset = 0;
  console.log("Bot is running...");

  while (true) {
    try {
      const response = await axios.get(`${API_URL}/getUpdates`, {
        params: { offset: offset, timeout: 30 },
      });

      if (response.data?.result?.length > 0) {
        for (const update of response.data.result) {
          if (update.message) await handleMessage(update.message);
          offset = update.update_id + 1; // Correctly update offset after processing
        }
      }
    } catch (error) {
      console.error("Error getting updates:", error.message);
    }
  }
}

// Start the bot
startPolling();
