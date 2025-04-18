const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

if (!global.GoatBot) {
    global.GoatBot = {
        onReaction: new Map(),
    };
}

module.exports = {
    config: {
        name: 'note',
        aliases: ['n'],
        version: '0.0.1',
        role: 2,
        author: 'Niio-team (DC-Nam) & LocDev',
        description: 'Upload file to server and get link',
        category: 'Admin',
        guide: [
            'note <file.js>',
        ],
        countDown: 3,
    },
    onStart: async function (o) {
        const commandName = module.exports.config.name;
        const url = o.event?.messageReply?.args?.[0] || o.args[1];
        let path = `${__dirname}/${o.args[0]}`;
        const send = msg => new Promise(r => o.api.sendMessage(msg, o.event.threadID, (err, res) => r(res), o.event.messageID));

        try {
            if (/^https:\/\//.test(url)) {
                const response = await send(`🔗 File: ${path}\n\nThả cảm xúc để xác nhận thay thế nội dung file`);
                const reactionData = {
                    commandName,
                    path,
                    o,
                    url,
                    action: 'confirm_replace_content',
                };
                global.GoatBot.onReaction.set(response.messageID, reactionData);
            } else {
                if (!fs.existsSync(path)) {
                    return send(`❎ Đường dẫn file không tồn tại để export`);
                }

                const uuid_raw = uuidv4();
                const url_raw = `https://thanhloc.onrender.com/note/${uuid_raw}`;
                const url_redirect = `https://thanhloc.onrender.com/note/${uuidv4()}`;

                // Đọc nội dung file và upload
                const fileContent = fs.readFileSync(path, 'utf8');
                await axios.put(url_raw, fileContent);

                const redirectUrlWithRaw = new URL(url_redirect);
                redirectUrlWithRaw.searchParams.append('raw', uuid_raw);
                await axios.put(redirectUrlWithRaw.href);

                redirectUrlWithRaw.searchParams.delete('raw');

                const response = await send(`📝 Raw: ${redirectUrlWithRaw.href}\n\n✏️ Edit: ${url_raw}\n\n🔗 File: ${path}\n\n📌 Thả cảm xúc để upload code`);
                const reactionData = {
                    commandName,
                    path,
                    o,
                    url: redirectUrlWithRaw.href,
                    action: 'confirm_replace_content',
                };
                global.GoatBot.onReaction.set(response.messageID, reactionData);
            }
        } catch (e) {
            console.error('Error:', e);
            const errorMessage = e.response ? e.response.data : e.toString();
            await send(`❌ Đã xảy ra lỗi: ${errorMessage}`);
        }
    },
    onReaction: async function (o) {
        const reactionData = global.GoatBot.onReaction.get(o.event.messageID);
        const send = msg => new Promise(r => o.api.sendMessage(msg, o.event.threadID, (err, res) => r(res), o.event.messageID));

        try {
            if (!reactionData) {
                console.log("No reaction data found for message ID:", o.event.messageID);
                return;
            }

            if (o.event.userID !== reactionData.o.event.senderID) {
                console.log("Reaction from a different user. Expected:", reactionData.o.event.senderID, "Received:", o.event.userID);
                return;
            }

            switch (reactionData.action) {
                case 'confirm_replace_content': {
                    const data = (await axios.get(reactionData.url, {
                        responseType: 'arraybuffer',
                    })).data;

                    fs.writeFileSync(reactionData.path, data);
                    await send(`✅ Đã upload code thành công\n\n🔗 File: ${reactionData.path}`);
                    global.GoatBot.onReaction.delete(o.event.messageID);
                }
                    break;
                default:
                    console.log("Unknown action:", reactionData.action);
                    break;
            }
        } catch (e) {
            console.error('Error in reaction handling:', e);
            const errorMessage = e.response ? e.response.data : e.toString();
            await send(`❌ Đã xảy ra lỗi khi xử lý phản ứng: ${errorMessage}`);
        }
    }
};
