const fs = require('fs').promises;
const path = require('path');

const DATABASE_PATH = path.join(process.cwd(), 'database', 'data', 'globalData.json');
const SNAPSHOT_PATH = path.join(process.cwd(), 'database', 'data', 'dailyAnalytics.json');

async function loadDailyAnalytics() {
    try {
        const data = await fs.readFile(SNAPSHOT_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return { lastReset: Date.now(), data: {} };
    }
}

async function saveDailyAnalytics(analytics) {
    await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(analytics));
}

async function getDailyAnalytics() {
    try {
        const globalData = await fs.readFile(DATABASE_PATH, 'utf8');
        const currentAnalytics = JSON.parse(globalData).find(item => item.key === 'analytics')?.data || {};
        let dailyData = await loadDailyAnalytics();
        const lastReset = dailyData.lastReset;
        const now = Date.now();
        const millisecondsSinceReset = now - lastReset;
        let hasChanges = false;
        const dailyStats = {};

        if (millisecondsSinceReset >= 24 * 60 * 60 * 1000) {
            dailyData = { lastReset: now, data: currentAnalytics };
            await saveDailyAnalytics(dailyData);
        } else {
            for (const [command, count] of Object.entries(currentAnalytics)) {
                const prevCount = dailyData.data[command] || 0;
                if (count > prevCount) {
                    dailyStats[command] = count - prevCount;
                    hasChanges = true;
                }
            }
        }

        if (!hasChanges) return [];
        return Object.entries(dailyStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([command, count]) => `${command}: ${count} times`);
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

async function getTotalAnalytics() {
    try {
        const data = await fs.readFile(DATABASE_PATH, 'utf8');
        const analytics = JSON.parse(data).find(item => item.key === 'analytics')?.data || {};
        return Object.entries(analytics)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([command, count]) => `${command}: ${count} times`);
    } catch {
        return [];
    }
}

module.exports = {
    config: {
        name: "uptime",
        aliases: ["upt", "up"],
        version: "1.0.1",
        author: "Base Code: OtinXSandip | Modified: Shikaki",
        role: 0,
        shortDescription: {
            en: "Shows bot stats and analytics"
        },
        longDescription: {
            en: "Shows uptime, users, threads, and command usage"
        },
        category: "system",
        guide: {
            en: "Use {p}uptime to view stats"
        }
    },
    onStart: async function ({ api, event, args, usersData, threadsData }) {
        try {
            const allUsers = await usersData.getAll();
            const allThreads = await threadsData.getAll();
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            const dailyTop5 = await getDailyAnalytics();
            const totalTop5 = await getTotalAnalytics();
            let message = `Uptime: ${uptimeString}\n`;
            message += `Users: ${allUsers.length}\n`;
            message += `Threads: ${allThreads.length}\n\n`;
            if (dailyTop5.length > 0 && JSON.stringify(dailyTop5) !== JSON.stringify(totalTop5)) {
                message += `Today's Usage:\n${dailyTop5.join('\n')}\n\n`;
            }
            message += `Total Usage:\n${totalTop5.join('\n')}`;
            api.sendMessage(message, event.threadID);
        } catch (error) {
            console.error(error);
            api.sendMessage("Error retrieving data.", event.threadID);
        }
    }
};