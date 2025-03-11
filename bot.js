const axios = require("axios");

const TOKEN = "1691953570:WmL4sHlh1ZFMcGv8ekKGgUdGxlZfforRzuktnweg";
const BALE_API = `https://tapi.bale.ai/bot${TOKEN}`;

// Function to send a message
async function sendMessage(chatId, text) {
    try {
        await axios.post(`${BALE_API}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// Function to handle updates
async function handleUpdate(update) {
    const message = update.message;
    if (message && message.text) {
        const chatId = message.chat.id;
        const username = message.from.username;

        // Check if the user is 'dszone' and if the message starts with 'بگو'
        if (username === "dszone" && message.text.startsWith("بگو ")) {
            const responseText = message.text.slice(4); // Remove 'بگو ' from the message
            await sendMessage(chatId, responseText);
        }
    }
}

// Function to get updates (Polling)
async function getUpdates(offset = 0) {
    try {
        const response = await axios.get(`${BALE_API}/getUpdates`, { params: { offset } });
        const updates = response.data.result;
        
        if (updates.length > 0) {
            const lastUpdateId = updates[updates.length - 1].update_id;
            for (const update of updates) {
                await handleUpdate(update);
            }
            getUpdates(lastUpdateId + 1);
        } else {
            setTimeout(() => getUpdates(offset), 1000);
        }
    } catch (error) {
        console.error("Error fetching updates:", error);
        setTimeout(() => getUpdates(offset), 5000);
    }
}

// Start polling updates
getUpdates();

console.log("Bot is running...");
