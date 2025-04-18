const axios = require('axios');

async function getTopTikWmResult(options) {
  const defaultOptions = {
    keywords: '',
    count: 1,  // We only need the top result
    hd: 1,
    region: 'ne'
  };

  const payload = { ...defaultOptions, ...options };

  try {
    const response = await axios.post('https://tikwm.com/api/feed/search', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000, // Set a timeout for 10 seconds
    });

    const data = response.data;

    if (data.code !== 0 || !data.data.videos.length) {
      throw new Error(data.msg || 'No videos found');
    }

    const video = data.data.videos[0];

    return {
      region: video.region,
      title: video.title,
      duration: video.duration,
      play: video.play,
      music: video.music,
      play_count: video.play_count,
      digg_count: video.digg_count,
      comment_count: video.comment_count,
      share_count: video.share_count,
      download_count: video.download_count,
      author: {
        unique_id: video.author.unique_id,
        nickname: video.author.nickname,
      }
    };
  } catch (error) {
    console.error('Error fetching top TikTok search result:', error.message);
    throw error;
  }
}

module.exports = {
  config: {
    name: 'tiksr',
    aliases: ['tiksearch', 'tiktoksearch', 'tiktoksr'],
    version: '1.2.0',
    author: 'Samir Thakuri',
    role: 0, // Adjust role as needed
    cooldowns: 5,
    category: 'media',
    description: 'Search TikTok trending videos based on keywords',
    usage: 'tiksr <keywords>'
  },

  onStart: async function({ message, event, args, api }) {
    const keywords = args.join(' ');

    if (!keywords) {
      return api.sendMessage('Please provide keywords to search for TikTok videos.', event.threadID, event.messageID);
    }

    // Set reaction to ⏳ while fetching
    api.setMessageReaction("☑️", event.messageID, () => {}, true);

    try {
      const videoData = await getTopTikWmResult({ keywords });

      const caption = `
🌟 Top TikTok Search Result 🌟
🎬 Title: ${videoData.title}
🌍 Region: ${videoData.region}
⏱ Duration: ${videoData.duration} seconds
▶️ Play Count: ${videoData.play_count}
👍 Likes: ${videoData.digg_count}
💬 Comments: ${videoData.comment_count}
🔗 Shares: ${videoData.share_count}
📥 Downloads: ${videoData.download_count}
👤 Author: ${videoData.author.nickname} (@${videoData.author.unique_id})`;

      // Send video with the fetched details
      await api.sendMessage({
        body: caption,
        attachment: await global.utils.getStreamFromURL(videoData.play),
      }, event.threadID, () => {
        // Reaction to indicate completion removed
      }, event.messageID);
    } catch (error) {
      console.error('Error in tiksr command:', error);
      return api.sendMessage('Error occurred while searching for TikTok videos.', event.threadID, event.messageID);
    }
  },
};