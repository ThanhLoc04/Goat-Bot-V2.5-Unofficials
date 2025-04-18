const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
    config: {
        name: "autodown",
		version: "1.0",
		author: "LocDev",
		countDown: 5,
		role: 0,
		shortDescription: "Tự động tải media",
		longDescription: "Tự động tải media từ Facebook, Instagram, TikTok",
		category: "media",
		guide: "{prefix}autodown help",
    },

    onStart: async function ({ api, event, args }) {
        if (args[0] === 'help') {
            return api.sendMessage(
                'Hỗ trợ tải video, hình ảnh được chia sẻ từ Tiktok, Douyin, Capcut, Threads, Instagram, Facebook, Espn, Kuaishou, Pinterest, Imdb, Imgur, iFunny, Izlesene, Reddit, Youtube, Twitter, Vimeo, Snapchat, Bilibili, Dailymotion, Sharechat, Linkedin, Tumblr, Hipi, Telegram, Getstickerpack, Bitchute, Febspot, 9GAG, Oke.ru, Rumble, Streamable, Ted, SohuTv, Xvideos, Xnxx, Xiaohongshu, Weibo, Miaopai, Meipai, Xiaoying, National Video, Yingke, Soundcloud, Mixcloud, Spotify, Zingmp3, Bandcamp.',
                event.threadID,
                event.messageID
            );
        }
    },

    onChat: async function ({ api, event }) {
        if (!event.body) return;

        const url = event.body;
        const isURL = /^http(s)?:\/\//.test(url);

        if (!isURL) return;

        const patterns = [
            /instagram\.com/,
            /facebook\.com/,
            /pinterest\.com/,
            /soundcloud\.com/,
            /capcut\.com/,
            /spotify\.com/,
            /x\.com/,
            /tiktok\.com/,
            /youtube\.com/,
            /threads\.net/,
            /capcut\.com/,
            /zingmp3\.vn/
        ];

        const matches = patterns.find(pattern => pattern.test(url));
        if (!matches) return;

        let data;
        try {
            const down = await axios.get(`https://j2down.vercel.app/download?url=${url}`);
            data = down.data; // Lấy dữ liệu từ API
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
            return api.sendMessage(error.message, event.threadID, event.messageID);
        }
        // Kiểm tra nếu data hoặc data.medias không tồn tại hoặc không phải là mảng
        if (!data || !Array.isArray(data.medias)) {
            return api.sendMessage('Không tìm thấy media nào.', event.threadID, event.messageID);
        }

        let fileContent = [];
        const findImg = data.medias.find(item => item.type === 'image');

        if (findImg) {
            fileContent = data.medias
                .filter(item => item.type === 'image' || item.type === 'video')
                .map((item, index) => ({
                    path: path.join(__dirname, '..', '..', 'img', `${Date.now() + index}.${item.type === 'video' ? 'mp4' : 'jpg'}`),
                    url: item.url
                }));
        } else {
            fileContent.push({
                path: path.join(__dirname, '..', '..', 'img', `${Date.now()}.${data.medias[0].type === 'video' ? 'mp4' : data.medias[0].type === 'audio' ? 'mp3' : 'jpg'}`),
                url: data.medias[0].url
            });
        }

        console.log(fileContent);
        let attachments = [];
        for (const content of fileContent) {
            const attachment = await download(content.url, content.path);
            if (attachment.err) return;
            attachments.push(attachment);
        }

        let messageBody = `🎦 ${data.title || "AUTODOWN"}`;

        api.sendMessage({
            body: messageBody,
            attachment: attachments
        }, event.threadID, event.messageID);
    }
};

async function download(url, savePath) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        fs.writeFileSync(savePath, response.data);
        setTimeout(() => {
            fs.unlink(savePath, (err) => {
                if (err) {
                    console.error('Lỗi khi xóa tệp:', err);
                    return;
                }
                console.log('Đã xóa tệp thành công:', savePath);
            });
        }, 1000 * 60);
        console.log(`Đã được tải và lưu tại ${savePath}`);
        return fs.createReadStream(savePath);
    } catch (error) {
        console.error('Lỗi khi tải:', error.message);
        return { err: true };
    }
}
