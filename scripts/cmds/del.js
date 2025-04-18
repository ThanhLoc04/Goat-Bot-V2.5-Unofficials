const fs = require('fs');
const path = require('path');

// Load config
const config = require('../../config.json'); // Điều chỉnh đường dẫn nếu cần

module.exports = {
  config: {
    name: "del",
    aliases: ["d"],
    version: "1.0",
    author: "LocDev",
    countDown: 5,
    role: 2,
    shortDescription: "Delete file and folders",
    longDescription: "Delete file",
    category: "owner",
    guide: "{pn}"
  },

  onStart: async function ({ args, message, event }) {
    // Lấy danh sách admin từ config
    const permission = config.adminBot;

    if (!permission.includes(event.senderID)) {
      message.reply("You don't have enough permission to use this command. Only authorized admins can do it.");
      return;
    }

    const commandName = args[0];

    if (!commandName) {
      return message.reply("Type the file name.");
    }

    const filePath = path.join(__dirname, '..', 'cmds', `${commandName}`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        message.reply(`✅ | Command file ${commandName} has been deleted.`);
      } else {
        message.reply(`Command file ${commandName} does not exist.`);
      }
    } catch (err) {
      console.error(err);
      message.reply(`Cannot delete ${commandName}: ${err.message}`);
    }
  }
};