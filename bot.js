const axios = require("axios");

// Bot Token and API URL
const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const API_URL = `https://tapi.bale.ai/bot${TOKEN}`;

// Group ID
const ALLOWED_GROUP_ID = 6190641192;

// Track the last update ID
let lastUpdateId = 0;

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

// Get updates from Bale API
async function getUpdates() {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1, // Start from the next update
        timeout: 10, // Shorter timeout for faster polling
      },
    });

    if (response.data && response.data.result) {
      const updates = response.data.result;

      if (updates.length > 0) {
        for (const update of updates) {
          if (update.message) {
            await handleHiMessage(update.message); // Handle "hi" messages
          }
          // Update the last processed update ID
          lastUpdateId = update.update_id;
        }
      }
    }
  } catch (error) {
    console.error("Error getting updates:", error.message);
  }
}

// Polling function with faster interval
function startPolling() {
  // Get updates immediately
  getUpdates();

  // Set a faster polling interval (e.g., 500ms)
  setInterval(getUpdates, 500);

  console.log("Polling started...");
}

// Start the bot
startPolling();
