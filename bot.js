const axios = require('axios');

// Configuration
const BOT_TOKEN = '1160037511:1K8GGcq7N14gngAo6e9apfT2yVYPCSI9xmRsHVCe';
const GROUP_ID = 5272323810; // The group ID you want to check
const API_URL = `https://tapi.bale.ai/bot${BOT_TOKEN}`;
let lastUpdateId = 0; // To keep track of processed updates

// Function to handle /start command
async function handleStartCommand(chatId, userId) {
  try {
    // Check if user is a member of the group
    const response = await axios.get(`${API_URL}/getChatMember`, {
      params: {
        chat_id: GROUP_ID,
        user_id: userId
      }
    });
    
    const status = response.data.result.status;
    const isMember = status === 'member' || status === 'administrator' || status === 'creator';
    
    // Send appropriate message
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: isMember ? "You're in the group! ✅" : "You're not in the group. ❌"
    });
    
  } catch (error) {
    console.error('Error handling /start command:', error.response?.data || error.message);
    
    // Send error message if user is not in group or bot can't check
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: "I couldn't verify your group status. Make sure I'm added to the group and have the right permissions."
    });
  }
}

// Function to process updates
async function processUpdates(updates) {
  for (const update of updates) {
    // Skip already processed updates
    if (update.update_id <= lastUpdateId) continue;
    
    lastUpdateId = update.update_id;
    
    // Check if the update contains a message with /start command
    if (update.message && update.message.text === '/start') {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      
      await handleStartCommand(chatId, userId);
    }
  }
}

// Long polling function
async function longPoll() {
  try {
    const response = await axios.get(`${API_URL}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 30 // Wait up to 30 seconds for new updates
      }
    });
    
    if (response.data.result.length > 0) {
      await processUpdates(response.data.result);
    }
  } catch (error) {
    console.error('Error in long polling:', error.message);
    // Wait before retrying in case of error
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Continue polling
  setImmediate(longPoll);
}

// Start the bot
console.log('Bot is running...');
longPoll().catch(err => console.error('Bot failed to start:', err));
