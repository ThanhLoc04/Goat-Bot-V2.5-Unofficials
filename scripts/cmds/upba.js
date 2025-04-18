const os = require("os");
const process = require("process");

const startTime = new Date();

function getCPUUsage() {
  try {
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) =>
      acc + Object.values(cpu.times).reduce((a, b) => a + b), 0);

    const avgIdle = totalIdle / cpuCount;
    const avgTotal = totalTick / cpuCount;
    return (100 - (avgIdle / avgTotal * 100)).toFixed(1);
  } catch {
    return "N/A";
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
  config: {
    name: "upba",
    aliases: ["stats", "info"],
    author: "Priyanshi Kaur (modified)",
    countDown: 0,
    role: 0,
    category: "system",
    longDescription: { en: "Get comprehensive System Information with detailed metrics!" },
    guide: { en: "Use .uptime [option]\nOptions: full, cute, mini" },
  },

  onStart: async function ({ api, event, args, threadsData, usersData }) {
    try {
      // Tính thời gian uptime
      const uptimeInSeconds = process.uptime();
      const days = Math.floor(uptimeInSeconds / (3600 * 24));
      const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
      const seconds = Math.floor(uptimeInSeconds % 60);
      const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      // Lấy thông tin hệ thống
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

      // Lấy số lượng người dùng & nhóm
      const allUsers = await usersData.getAll() || [];
      const allThreads = await threadsData.getAll() || [];
      const userCount = allUsers.length;
      const threadCount = allThreads.length;

      // Ping
      const ping = Date.now() - event.timestamp;
      const pingStatus = ping < 100 ? "🟢" : ping < 300 ? "🟡" : "🔴";

      // Thời gian hiện tại
      const currentDate = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      let systemInfo;

      if (!args[0] || args[0] === "full") {
        systemInfo = `
╭───────── SYSTEM INFO ─────────╮
💻 System Stats
❯ CPU: ${getCPUUsage()}% Usage
❯ RAM: ${memoryUsagePercent}% Used
❯ Total: ${formatBytes(totalMem)}
❯ Used: ${formatBytes(usedMem)}
❯ Free: ${formatBytes(freeMem)}

⚙️ Bot Info
❯ Prefix: .
❯ Uptime: ${uptimeFormatted}
❯ Platform: ${os.platform()}
❯ NodeJS: ${process.version}

📊 Usage Stats
❯ Users: ${userCount}
❯ Threads: ${threadCount}
❯ Ping: ${ping}ms ${pingStatus}

🕒 Current Time
❯ ${currentDate}
╰────────────────────────────╯`;
      } else if (args[0] === "cute") {
        const pets = ["🐱", "🐶", "🐰", "🐼", "🐨", "🦊"];
        const pet = pets[Math.floor(Math.random() * pets.length)];
        systemInfo = `
${pet} Hewwo! Here's my stats:
• I've been awake for ${uptimeFormatted}
• Taking care of ${userCount} users
• In ${threadCount} chats
• My ping is ${ping}ms ${pingStatus}
• Using ${memoryUsagePercent}% of my brain
${pet} Have a paw-some day!`;
      } else if (args[0] === "mini") {
        systemInfo = `📊 Up: ${uptimeFormatted} | Users: ${userCount} | Threads: ${threadCount} | Ping: ${ping}ms ${pingStatus}`;
      }

      // Gửi tin nhắn với thông tin hệ thống
      api.sendMessage(systemInfo, event.threadID);
    } catch (error) {
      console.error("Uptime Error:", error);
      api.sendMessage("⚠️ Error while getting system info:\n" + error.message, event.threadID);
    }
  }
};
