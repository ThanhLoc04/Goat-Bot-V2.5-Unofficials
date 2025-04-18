const axios = require('axios');

module.exports = {
  config: {
    name: 'gpt',
    version: '1.0',
    author: 'Shikaki',
    countDown: 5,
    role: 0,
    category: 'Ai',
    description: {
      en: 'Chill with the cool Chatgpt-4o-latest.',
    },
    guide: {
      en: '{pn} sup',
    },
  },
  onStart: async function ({ api, message, event, args, commandName }) {
    var prompt = args.join(" ");

    if (prompt.toLowerCase() === "clear") {
      message.reply("Chat history cleared!");
      return;
    }

    var content = (event.type == "message_reply") ? event.messageReply.body : args.join(" ");

    const apiUrl = `https://ai-l9qn.onrender.com/text/chatgpt-4o-latest/uid=${event.senderID}&q=${encodeURIComponent(content)}`;

    try {
      api.setMessageReaction("⌛", event.messageID, () => { }, true);
      const response = await axios.get(apiUrl);
      const assistantResponse = response.data.response;
      message.reply(assistantResponse, (err, info) => {
        if (!err) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName,
            messageID: info.messageID,
            author: event.senderID,
          });
        } else {
          console.error("Error sending message:", err);
        }
      });
    } catch (error) {
      console.error("Error processing request:", error);
      api.sendMessage(`${error.message}`, event.threadID);
      api.setMessageReaction("❌", event.messageID, () => { }, true);
    }
  },
  onReply: async function ({ api, message, event, Reply, args }) {
    var prompt = args.join(" ");
    let { author, commandName } = Reply;

    if (event.senderID !== author) return;

    if (prompt.toLowerCase() === "clear") {
      message.reply("Chat history cleared!", (err, info) => {
        if (!err) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName,
            messageID: info.messageID,
            author: event.senderID,
          });
        } else {
          console.error("Error sending message:", err);
        }
      });
      return;
    }

    const apiUrl = `https://ai-l9qn.onrender.com/text/chatgpt-4o-latest/uid=${event.senderID}&q=${encodeURIComponent(prompt)}`;

    try {
      api.setMessageReaction("⌛", event.messageID, () => { }, true);
      const response = await axios.get(apiUrl);
      const assistantResponse = response.data.response;
      message.reply(assistantResponse, (err, info) => {
        if (!err) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName,
            messageID: info.messageID,
            author: event.senderID,
          });
        } else {
          console.error("Error sending message:", err);
        }
      });
    } catch (error) {
      console.error("Error processing request:", error);
      api.sendMessage(`${error.message}`, event.threadID);
      api.setMessageReaction("❌", event.messageID, () => { }, true);
    }
  }
};