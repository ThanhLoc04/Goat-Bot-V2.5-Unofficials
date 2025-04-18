const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');

module.exports.config = {
    name: "4k",
    version: "1.0.2",
    hasPermssion: 0,
    credits: "Satoru",
    description: "Làm nét ảnh bằng AI",
    category: "Box",
    cooldowns: 5, 
    usePrefix: true
};

module.exports.onStart = async function ({ api, event }) {
    let imgFile;
    if (event.messageReply) {
        imgFile = event.messageReply.attachments.find(attachment => attachment.type == "photo");
    }
    else {
        imgFile = event.attachments.find(attachment => attachment.type == "photo");
    }

    if (!imgFile)
        return api.sendMessage("Bạn phải reply hoặc gửi ảnh kèm theo tin nhắn để làm nét", event.threadID, event.messageID);

    const getStream = (await axios.get(imgFile.url, { responseType: 'stream' })).data;

    api.sendMessage("⏳ Đang làm nét ảnh...", event.threadID, async (err, info) => {
        try {
            const buffer = await lamNetAnh(getStream);

            const pathSaveImg = __dirname + `/cache/lamnetanh_${event.senderID}_${Date.now()}.png`;
            fs.writeFileSync(pathSaveImg, buffer);

            return api.sendMessage({ body: `✅ Thành công!\n🖼️ Đây là ảnh đã được làm nét!`,
                attachment: fs.createReadStream(pathSaveImg)
            }, event.threadID, () => {
                fs.unlinkSync(pathSaveImg);
                api.unsendMessage(info.messageID);
            }, event.messageID);
        } catch (error) {
            return api.sendMessage(`Đã xảy ra lỗi: ${error.message}`, event.threadID, event.messageID);
        }
    }, event.messageID);
};

async function lamNetAnh(fileStream) {
    try {

        const form = new FormData();
        form.append('image', '{}');
        form.append('image', fileStream, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });

        const postUploadResponse = await axios.post('https://api.imggen.ai/guest-upload', form, {
            headers: {
                ...form.getHeaders(),
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                'Origin': 'https://imggen.ai',
                'Referer': 'https://imggen.ai/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            }
        });

        let uploadedImageData = postUploadResponse.data.image;
        uploadedImageData.url = `https://api.imggen.ai${uploadedImageData.url}`;

        const postUpscaleResponse = await axios.post('https://api.imggen.ai/guest-upscale-image', 
            {
                image: uploadedImageData
            },
            {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'Origin': 'https://imggen.ai',
                    'Referer': 'https://imggen.ai/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
                }
            }
        );

        if (postUpscaleResponse.data.message !== 'Image upscaled successfully') {
            throw new Error('Upscale không thành công');
        }

        const upscaledImageUrl = `https://api.imggen.ai${postUpscaleResponse.data.upscaled_image}`;

        const { data: imgBuffer } = await axios.get(upscaledImageUrl, { responseType: 'arraybuffer' });
        return imgBuffer;

    } catch (error) {
        console.error('Lỗi trong quá trình làm nét ảnh:', error);
        throw new Error('Không thể làm nét ảnh. Vui lòng thử lại sau.');
    }
}