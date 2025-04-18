const axios = require("axios");
const fs = require("fs");

function formatSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

module.exports = {
  config: {
    name: "soundcloud",
    aliases: ["sc"],
    version: "1.0",
    author: "MILAN",
    countDown: 10,
    role: 0,
    shortDescription: "Search for tracks on SoundCloud.",
    longDescription: "Search for tracks on SoundCloud.",
    category: "media",
    guide: "{query}",
  },

  onStart: async function ({ api, event, args, message }) {
    const query = args.join(" ");
    const soundcloudApi = `https://apis-starlights-team.koyeb.app/starlight/soundcloud-search?text=${encodeURIComponent(query)}`;
    try {
      const response = await axios.get(soundcloudApi);
      const tracks = response.data.slice(0, 6); // Limit to 6 tracks for simplicity
      
      if (tracks.length === 0) {
        return message.reply("No tracks found for the given query.");
      }
      
      const trackInfo = tracks
        .map((track, index) => 
          `${index + 1}. ${track.title}\n• Artist: ${track.artist}\n• Duration: ${track.duration}\n• Plays: ${track.repro}`
        )
        .join("\n\n");
      
      const attachments = await Promise.all(
        tracks.map((track) =>
          global.utils.getStreamFromURL(track.image)
        )
      );

      const replyMessage = await message.reply({
        body: `${trackInfo}\n\nReply with the number of the track to download.`,
        attachment: attachments,
      });

      const data = {
        commandName: this.config.name,
        messageID: replyMessage.messageID,
        tracks: tracks,
      };

      global.GoatBot.onReply.set(replyMessage.messageID, data);
    } catch (error) {
      console.error(error);
      message.reply("Error: " + error.message);
    }
  },

  onReply: async function ({ api, event, args, message, Reply }) {
    const userInput = parseInt(args[0]);
    if (!isNaN(userInput) && userInput >= 1 && userInput <= Reply.tracks.length) {
      const selectedTrack = Reply.tracks[userInput - 1];
      try {
        const downloadApi = `https://apis-starlights-team.koyeb.app/starlight/soundcloud?url=${encodeURIComponent(selectedTrack.url)}`;
        const apiResponse = await axios.get(downloadApi);

        if (apiResponse.data.link) {
          const audioLink = apiResponse.data.link;
          const audioResponse = await axios.get(audioLink, { responseType: 'arraybuffer' });
          const filePath = `${__dirname}/cache/soundcloudAudio.mp3`;
          fs.writeFileSync(filePath, Buffer.from(audioResponse.data));

          const fileSize = fs.statSync(filePath).size;
          const sizeFormatted = formatSize(fileSize);

          const attachment = fs.createReadStream(filePath);
          const trackDetails = `
• Title: ${selectedTrack.title}
• Artist: ${selectedTrack.artist}
• Duration: ${selectedTrack.duration}
• Size: ${sizeFormatted}
• Plays: ${selectedTrack.repro}`;

          await message.reply({
            body: `${trackDetails}`,
            attachment: attachment,
          });
        } else {
          console.error("Audio link not available");
          message.reply("Sorry, the audio link could not be retrieved.");
        }
      } catch (error) {
        console.error(error);
        message.reply("Error downloading the audio file.");
      }
    }
  },
};