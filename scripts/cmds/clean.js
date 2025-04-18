module.exports.config = {
    name: "clean",
    version: "0.0.2",
    author: "Marrcus",
    description: "clean cache bot",
    category: "Admin",
    usages: "Y/N",
    countdown: 5,
};

const fs = require('fs');

// Set the onReply event
global.GoatBot = global.GoatBot || {};
global.GoatBot.onReply = global.GoatBot.onReply || new Map();

module.exports.onStart = async function({ api, event, args, utils, commandName }) {
    api.sendMessage('🗑️ Bạn muốn clean theo AI hay tự chọn Y/N', event.threadID, (e, info) => {
        global.GoatBot.onReply.set(info.messageID, {
            commandName,
            author: event.senderID,
            messageID: info.messageID
        });
    });
};

module.exports.onReply = async function({ api, event, args, Reply, commandName }) {
    const { type } = Reply;

    if (type === 'n') {
        const typesToDelete = event.body.split(' ');
        let success = [];

        for (const type of typesToDelete) {
            const files = fs.readdirSync(__dirname + `/cache`).filter(file => file.endsWith(`.` + type));

            for (const file of files) {
                try {
                    fs.unlinkSync(__dirname + `/cache/` + file);
                    success.push(file);
                } catch {
                    api.sendMessage(`⚠️ Error Clear Storage: ${file}`, event.threadID);
                }
            }
        }

        if (success.length === 0) {
            return api.sendMessage('❎ Bạn đã dọn cache rồi', event.threadID);
        }
        
        return api.sendMessage('✅ Dọn dẹp cache thành công', event.threadID);
    }

    switch (event.args[0].toLowerCase()) {
        case 'y': {
            const typesToDelete = ["png", "jpg", "mp4", "jpeg", "gif", "m4a", "txt", "mp3", "wav"];
            let success = [];

            for (const type of typesToDelete) {
                const files = fs.readdirSync(__dirname + `/cache`).filter(file => file.endsWith(`.` + type));

                for (const file of files) {
                    try {
                        fs.unlinkSync(__dirname + `/cache/` + file);
                        success.push(file);
                    } catch {
                        api.sendMessage(`⚠️ Error Clear Storage: ${file}`, event.threadID);
                    }
                }
            }

            if (success.length === 0) {
                return api.sendMessage('❎ Bạn đã dọn cache rồi', event.threadID);
            }
            
            return api.sendMessage('✅ Dọn dẹp cache thành công', event.threadID);
        }

        case 'n': {
            api.sendMessage('📌 Vui lòng reply những dạng file cần xóa\nVí dụ: mp3 mp4', event.threadID, (e, info) => {
                global.GoatBot.onReply.set(info.messageID, {
                    type: 'n',
                    commandName,
                    author: event.senderID,
                    messageID: info.messageID
                });
            });
            break;
        }
    }
};