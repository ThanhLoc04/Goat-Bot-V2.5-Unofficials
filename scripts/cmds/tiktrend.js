const axios = require('axios');

async function getFeedList(region = 'np') {
  const url = 'https://tikwm.com/api/feed/list';
  const data = {
    count: 1,
    hd: 1,
    region: region || 'np',
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // Set a timeout for 10 seconds
    });

    if (response.data.code !== 0) {
      throw new Error('API request failed with message: ' + response.data.msg);
    }

    const topData = response.data.data[0];
    const formattedData = {
      region: topData.region,
      title: topData.title,
      duration: topData.duration,
      play: topData.play,
      play_count: topData.play_count,
      digg_count: topData.digg_count,
      comment_count: topData.comment_count,
      share_count: topData.share_count,
      download_count: topData.download_count,
      author: {
        id: topData.author.id,
        unique_id: topData.author.unique_id,
        nickname: topData.author.nickname,
      },
    };

    return formattedData;
  } catch (error) {
    console.error('Error making the POST request:', error);
    throw error;
  }
}

module.exports = {
  config: {
    name: 'tiktrend',
    aliases: ['tiktoktrend', 'tiktok'],
    role: 0, // Adjust role as needed
    cooldowns: 5,
    version: '1.2.0',
    author: 'Samir Thakuri',
    category: 'media',
    description: 'Fetch trending TikTok videos',
    usage: 'tiktrend <region> (Default: NP)',
  },

  onStart: async function ({ args, event, api }) {
    const region = args[0] || 'np'; // Default region to 'np' if not provided

    // Add a reaction to the user's message to indicate processing
    api.setMessageReaction("☑️", event.messageID, () => {}, true);

    try {
      const videoData = await getFeedList(region);

      // Check if videoData.play is a valid URL
      if (!videoData.play) {
        throw new Error('No video URL found in the response.');
      }

      const caption = `
🌟 Trending TikTok Video 🌟
🎬 Title: ${videoData.title}
🌍 Region: ${videoData.region}
⏱ Duration: ${videoData.duration} seconds
▶️ Play Count: ${videoData.play_count}
👍 Likes: ${videoData.digg_count}
💬 Comments: ${videoData.comment_count}
🔗 Shares: ${videoData.share_count}
📥 Downloads: ${videoData.download_count}
👤 Author: ${videoData.author.nickname} (@${videoData.author.unique_id})`;

      // Send the video with the caption
      await api.sendMessage(
        {
          body: caption,
          attachment: await global.utils.getStreamFromURL(videoData.play),
        },
        event.threadID,
        event.messageID
      );

      // Add a "☑️" reaction after sending the video
      await api.setMessageReaction("☑️", event.messageID, () => {}, true);

    } catch (error) {
      console.error('Error in tiktrend command:', error.message);
      await api.sendMessage(`Error occurred while fetching TikTok trending video: ${error.message}`, event.threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  },
};