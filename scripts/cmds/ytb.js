const axios = require('axios');
const { createWriteStream, createReadStream, unlinkSync, existsSync, mkdirSync, statSync } = require('fs-extra');
const moment = require('moment-timezone');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const mediaSavePath = __dirname + '/cache/Youtube/';
const key = "AIzaSyAygWrPYHFVzL0zblaZPkRcgIFZkBNAW9g";

module.exports.config = {
    name: 'ytb',
    version: '1.0.0',
    author: 'LocDev',
    role: 0,
    aliases: ['youtube', 'yt'],
    description: 'Play music or video through YouTube link or search keyword',
    category: 'Utility',
    usage: 'ytb <link or keyword>',
    countDown: 5
};

module.exports.onReply = async function ({ api, event, Reply, commandName }) {
    const { threadID, messageID, body, senderID } = event;
    const { author, videoID, IDs, type: reply_type } = Reply;

    // Check if the reply comes from the original author
    if (author != senderID) return;

    // Helper function to download media (either video or audio)
    const downloadMedia = async (videoID, type) => {
        const filePath = `${mediaSavePath}${Date.now()}${senderID}.${type === 'video' ? 'mp4' : 'm4a'}`;
        const errObj = { filePath, error: 1 };

        try {
            const mediaObj = { filePath, error: 0 };
            if (!existsSync(mediaSavePath)) mkdirSync(mediaSavePath, { recursive: true });

            const ytdlOptions = type === 'video' ? { quality: '18' } : { filter: 'audioonly' };
            await new Promise((resolve, reject) => {
                const stream = ytdl('https://www.youtube.com/watch?v=' + videoID, ytdlOptions);

                if (type === 'video') {
                    stream.pipe(createWriteStream(filePath))
                        .on('error', reject)
                        .on('close', resolve);
                } else {
                    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
                    ffmpeg(stream).audioCodec("aac").save(filePath)
                        .on('error', reject)
                        .on('end', resolve);
                }
            });

            return mediaObj;
        } catch (e) {
            console.log(e);
            return errObj;
        }
    };

    // Handling different reply types
    switch (reply_type) {
        case 'download': {
            const { filePath, error } = await downloadMedia(videoID, body === '1' ? 'video' : 'audio');
            const mediaData = {
                title: (await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoID}&key=${key}`)).data.items[0].snippet.title,
                duration: prettyTime((await axios.get(encodeURI(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoID}&key=${key}`))).data.items[0].contentDetails.duration)
            }
            if (error) {
                api.sendMessage('❎ An error occurred', threadID, messageID);
                if (existsSync(filePath)) unlinkSync(filePath);
            } else {
                api.unsendMessage(Reply.messageID);
                if (statSync(filePath).size > (body === '1' ? 50331648 : 26214400)) {
                    api.sendMessage('⚠️ File size is too large', threadID, messageID);
                    unlinkSync(filePath);
                } else {
                    api.sendMessage({
                        body: `[ YOUTUBE DOWNLOAD ]\n📝 Title: ${mediaData.title}\n⏳ Duration: ${mediaData.duration}\n⏰ Time: ${moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss')}`,
                        attachment: createReadStream(filePath)
                    }, threadID, (err) => {
                        if (err) api.sendMessage('❎ An error occurred', threadID, messageID);
                        if (existsSync(filePath)) unlinkSync(filePath);
                    }, messageID);
                }
            }
            break;
        }
        case 'list': {
            if (isNaN(body) || body < 1 || body > IDs.length) {
                api.sendMessage('⚠️ Choose a number from 1 to ' + IDs.length, threadID, messageID);
            } else {
                api.unsendMessage(Reply.messageID);
                const chosenID = IDs[parseInt(body) - 1];
                api.sendMessage('[ YOUTUBE SELECT ]\n1. Download video\n2. Download audio\n\n📌 Reply with the number', threadID, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName,
                            messageID: info.messageID,
                            author: senderID,
                            videoID: chosenID,
                            type: 'download'  // Set the type to 'download'
                        });
                    }
                }, messageID);
            }
            break;
        }
    }
};

module.exports.onStart = async function ({ api, event, args, commandName }) {
    const { threadID, messageID, senderID } = event;
    if (args.length === 0) return api.sendMessage('❎ Please provide a search query', threadID, messageID);

    const input = args.join(' ');
    const isValidUrl = /^(http(s)?:\/\/)?(www\.)?youtu(be|\.be)?(\.com)?\/.+/gm.test(input);

    // Helper function to get basic information from a YouTube search
    const getBasicInfo = async (keyword) => {
        try {
            const mediaData = (await axios.get(encodeURI(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${keyword}&type=video&key=${key}`))).data.items;
            return mediaData;
        } catch (e) {
            throw e;
        }
    }

    try {
        if (isValidUrl) {
            let videoID = input.split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/)[2] || input.split(/[^0-9a-z_\-]/i)[0];
            api.sendMessage('[ YOUTUBE SELECT ]\n1. Download video\n2. Download audio\n\n📌 Reply with the number', threadID, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName,
                        messageID: info.messageID,
                        author: senderID,
                        videoID,
                        type: 'download'  // Set the type to 'download'
                    });
                }
            }, messageID);
        } else {
            const result = await getBasicInfo(input);
            let IDs = [], msg = `[ YOUTUBE SEARCH ]\n📝 Results for keyword:`;
            for (let i = 0; i < result.length; i++) {
                const id = result[i].id.videoId;
                if (id) {
                    IDs.push(id);
                    const duration = (await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${key}`)).data.items[0].contentDetails.duration;
                    msg += `\n\n${i + 1}. ${result[i].snippet.title}\n⏳ Duration: ${prettyTime(duration)}\n`;
                }
            }
            msg += `\n\n📌 Reply with the number of the video you want to download`;
            api.sendMessage(msg, threadID, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName,
                        messageID: info.messageID,
                        author: senderID,
                        IDs,
                        type: 'list'  // Set the type to 'list'
                    });
                }
            }, messageID);
        }
    } catch (e) {
        api.sendMessage('❎ Error:\n' + e, threadID, messageID);
    }
};

// Helper function to prettify the YouTube video duration format
const prettyTime = (time) => {
    let totalSeconds = 0;
    const timeArray = time.slice(2).match(/\d+[HMS]/g); // Tìm các phần tử chứa số và ký tự H, M, S

    // Chuyển đổi giờ, phút, giây thành tổng số giây
    timeArray.forEach(part => {
        const unit = part.slice(-1); // Lấy ký tự H, M, S
        const value = parseInt(part.slice(0, -1)); // Lấy số trước ký tự

        if (unit === 'H') totalSeconds += value * 3600;
        else if (unit === 'M') totalSeconds += value * 60;
        else if (unit === 'S') totalSeconds += value;
    });

    // Chuyển đổi tổng số giây về định dạng HH:mm:ss
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return hours !== '00' ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
};