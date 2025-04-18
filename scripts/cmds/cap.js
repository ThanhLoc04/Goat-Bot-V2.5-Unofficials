const { createReadStream, unlinkSync, existsSync } = require('fs-extra');
const puppeteer = require('puppeteer');
const { resolve } = require('path');

module.exports = {
    config: {
        name: 'cap',
        version: '1.0.1',
        author: 'LocDev',
        description: 'Chụp wall hoặc web nào đó',
        usages: [
            'cap : Chụp wall của bạn',
            'cap <reply>: Chụp wall người bạn reply',
            'cap <tag>: Chụp wall người bạn tag',
            'cap <link>: Chụp wall web',
        ],
        countDown: 5,
        role: 2,
        category: 'Tiện ích',
        dependencies: {
            puppeteer: '',
            'fs-extra': '',
        },
    },
    onStart: async function ({ api, event, args }) {
        const path = resolve(__dirname, 'cache', `cap${event.threadID}_${event.senderID}.png`);
        try {
            let uid;
            if (!args[0] || event.type === 'message_reply' || Object.keys(event.mentions).length !== 0) {
                if (!args[0]) uid = event.senderID;
                if (event.type === 'message_reply') uid = event.messageReply.senderID;
                if (Object.keys(event.mentions).length !== 0) uid = Object.keys(event.mentions)[0];

                const userInfo = await api.getUserInfo(uid);
                const userName = userInfo[uid].name || 'Người dùng';

                const browser = await puppeteer.launch({
                    headless: true, // Ensures the browser runs in headless mode, i.e., without showing the tab
                    args: ['--no-sandbox']
                });

                const page = await browser.newPage();
                await page.setViewport({ width: 1920, height: 1080 });
                api.sendMessage('🔄 Đang tải...', event.threadID, event.messageID);

                const getAppState = api.getAppState();
                const cookies = [];
                getAppState.forEach((a) => {
                    cookies.push({
                        name: a.key,
                        value: a.value,
                        domain: `.${a.domain}`,
                        path: a.path,
                        httpOnly: a.hostOnly,
                        sameSite: 'None',
                        secure: true,
                        sameParty: false,
                        sourceScheme: 'Secure',
                        sourcePort: 443,
                    });
                });
                await page.setCookie(...cookies);
                await page.goto(`https://www.facebook.com/profile.php?id=${uid}`, { waitUntil: ['networkidle2'] });
                await page.waitForSelector('body');
                await page.screenshot({ path });

                await browser.close();

                return api.sendMessage(
                    {
                        body: `✅ Đã xong ${userName}`,
                        mentions: [{ tag: userName, id: uid }],
                        attachment: createReadStream(path),
                    },
                    event.threadID,
                    () => existsSync(path) && unlinkSync(path),
                    event.messageID
                );
            }

            if (args[0].indexOf('https://') !== -1) {
                const browser = await puppeteer.launch({
                    headless: true, // Ensure it's in headless mode to prevent UI from appearing
                    args: ['--no-sandbox']
                });
                const page = await browser.newPage();
                page.setViewport({ width: 1920, height: 1080 });
                api.sendMessage('🔄 Đang tải...', event.threadID, event.messageID);

                if (args[0].includes('facebook.com')) {
                    const getAppState = api.getAppState();
                    const cookies = [];
                    getAppState.forEach((a) => {
                        cookies.push({
                            name: a.key,
                            value: a.value,
                            domain: `.${a.domain}`,
                            path: a.path,
                            httpOnly: a.hostOnly,
                            sameSite: 'None',
                            secure: true,
                            sameParty: false,
                            sourceScheme: 'Secure',
                            sourcePort: 443,
                        });
                    });
                    await page.setCookie(...cookies);
                }

                if (args[0]) {
                    await page.goto(args[0], { waitUntil: ['networkidle2'] });
                    await page.waitForSelector('body');
                    await page.screenshot({ path });
                } else {
                    console.log('Không có URL được cung cấp');
                    return api.sendMessage('❌ Không có URL được cung cấp. Vui lòng thử lại với URL hợp lệ.', event.threadID, event.messageID);
                }

                await browser.close();
                if (existsSync(path)) {
                    const senderInfo = await api.getUserInfo(event.senderID);
                    const senderName = senderInfo[event.senderID].name || 'Người dùng';

                    return api.sendMessage(
                        {
                            body: `✅ Đã xong ${senderName}`,
                            mentions: [{ tag: senderName, id: event.senderID }],
                            attachment: createReadStream(path),
                        },
                        event.threadID,
                        () => unlinkSync(path),
                        event.messageID
                    );
                } else {
                    console.log('Không chụp được ảnh màn hình, file không tồn tại.');
                    return api.sendMessage('❌ Không chụp được ảnh màn hình, file không tồn tại. Vui lòng thử lại.', event.threadID, event.messageID);
                }
            }
        } catch (e) {
            console.log(e);
            api.sendMessage('❌ Đã xảy ra lỗi khi thực hiện lệnh.', event.threadID, event.messageID);
        }
    },
};
