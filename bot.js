const axios = require("axios");

// Bot Token (Replace with your actual bot token)
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group ID (Replace with your actual group ID)
const ALLOWED_GROUP_ID = YOUR_GROUP_ID; // Replace with your group ID

// Send message to chat
async function sendMessage(chatId, text) {
  try {
    const response = await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
    return response.data;
  } catch (error) {
    console.error("Error sending message:", error.message);
    return null;
  }
}

// Check if the chat is the allowed group
function isAllowedGroup(chatId) {
  return chatId === ALLOWED_GROUP_ID;
}

// Handle "hi" message
async function handleHiMessage(msg) {
  if (!msg || !msg.chat || !msg.from || !msg.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.toLowerCase(); // Make it case-insensitive

  if (isAllowedGroup(chatId) && text === "hi") {
    await sendMessage(chatId, "hello");
  }
}

// Get updates from Telegram API
let offset = 0;
async function getUpdates() {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset: offset,
        timeout: 30,
      },
    });

    if (response.data && response.data.result) {
      const updates = response.data.result;

      if (updates.length > 0) {
        // Process all updates
        for (const update of updates) {
          if (update.message) {
            await handleHiMessage(update.message); // Handle "hi" messages
          }
          // Update the offset to acknowledge received updates
          offset = update.update_id + 1;
        }
      }
    }
  } catch (error) {
    console.error("Error getting updates:", error.message);
  }
}

// Polling function
function startPolling() {
  // Get updates immediately
  getUpdates();

  // Then set interval for continuous polling
  setInterval(getUpdates, 1000);

  console.log("Polling started...");
}

// Start the bot
startPolling();
