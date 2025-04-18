const fs = require('fs').promises;
const os = require('os');
const moment = require('moment-timezone');
const nodeDiskInfo = require('node-disk-info');

module.exports = {
    config: {
        name: "upt",
        version: "0.0.3",
        author: "LocDev",
        countDown: 5,
        role: 0,
        description: {
            en: "Show system uptime and information.",
            vi: ""
        },
        category: "upt bot",
        guide: {
            en: "",
            vi: ""
        }
    },

    langs: {
        en: {},
        vi: {}
    },

    onStart: async function ({ api, event }) {
        const startTime = Date.now();

        async function getDependencyCount() {
            try {
                const packageJsonString = await fs.readFile('package.json', 'utf8');
                const packageJson = JSON.parse(packageJsonString);
                return Object.keys(packageJson.dependencies).length;
            } catch (error) {
                console.error('❎ Error reading package.json:', error);
                return -1;
            }
        }

        function getStatusByPing(ping) {
            if (ping < 200) return 'smooth';
            if (ping < 800) return 'average';
            return 'slow';
        }

        function getPrimaryIP() {
            const interfaces = os.networkInterfaces();
            for (const iface of Object.values(interfaces)) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
            return '127.0.0.1';
        }

        function formatUptime(uptime) {
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        function convertToGB(bytes) {
            if (bytes === undefined) return 'N/A';
            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
        }

        try {
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const uptime = formatUptime(process.uptime());

            const dependencyCount = await getDependencyCount();
            const pingReal = Date.now() - startTime;
            const botStatus = getStatusByPing(pingReal);
            const primaryIp = getPrimaryIP();

            const disks = await nodeDiskInfo.getDiskInfo();
            const firstDisk = disks[0] || { blocks: 0, available: 0, used: 0 };

            // Get user information using the provided getUserInfo method
            const userInfo = await api.getUserInfo(event.senderID);
            const userName = userInfo[event.senderID].name;

            const replyMsg = `
⏰ Current time: ${moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss')} | ${moment().tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY')}
⏱️ Uptime: ${uptime}
🗂️ Number of packages: ${dependencyCount >= 0 ? dependencyCount : "Unknown"}
🔣 Bot status: ${botStatus}
📋 OS: ${os.type()} ${os.release()} (${os.arch()})
💾 CPU: ${os.cpus().length} core(s) - ${os.cpus()[0].model} @ ${Math.round(os.cpus()[0].speed)}MHz
📊 RAM: ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)}GB / ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB (used)
🛢️ Free RAM: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB
🗄️ Storage: ${convertToGB(firstDisk.used)} / ${convertToGB(firstDisk.blocks)} (used)
📑 Free Storage: ${convertToGB(firstDisk.available)}
🛜 Ping: ${pingReal}ms
👤 Requested by: ${userName}
            `.trim();

            // Send the message
            await api.sendMessage(replyMsg, event.threadID, event.messageID);
        } catch (error) {
            console.error('❎ Error occurred:', error.message);
            // Send error response to the user
            api.sendMessage(`❎ An error occurred: ${error.message}`, event.threadID, event.messageID);
        }
    }
};
