const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
  config: {
    name: 'artx',
    version: '1.5',
    author: 'rehat--',
    longDescription: "Transform image to anime art",
    countDown: 5,
    role: 0,
    category: "ai",
    guide: {
      en: "{pn} <reply_image>"
    },
  },

  onStart: async function ({ event, api, args, message }) {
    let imageUrl;
    if (event.type === "message_reply") {
      if (["photo", "sticker"].includes(event.messageReply.attachments[0]?.type)) {
        imageUrl = event.messageReply.attachments[0].url;
      } else {
        return api.sendMessage({ body: "❌ | Reply must be an image." }, event.threadID, event.messageID);
      }
    } else if (args[0]?.match(/(https?:\/\/.*\.(?:png|jpg|jpeg))/g)) {
      imageUrl = args[0];
    } else {
      return api.sendMessage({ body: "❌ | Reply to an image." }, event.threadID, event.messageID);
    }

    message.reply("Please Wait...⏳", async (err, info) => {
      if (err) {
        console.error(err);
        return;
      }

      const api_key = 'f9742fa7-4093-4b50-8126-31076fc417a2';
      let aspect_ratio = "square"; 

      try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        const dimensions = await getImageDimensions(imageBuffer);
        const ratio = dimensions.width / dimensions.height;

        if (ratio > 1.4) {
          aspect_ratio = "landscape";
        } else if (ratio < 0.8) {
          aspect_ratio = "portrait";
        }
      } catch (error) {
        console.error(error);
        message.reply("An error occurred.");
      }

      async function generateImage(imageUrl) {
        try {
          const options = {
            method: 'POST',
            url: 'https://api.prodia.com/v1/sd/transform',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'X-Prodia-Key': api_key,
            },
            data: {
              imageUrl: imageUrl,
              prompt: `detailed eyes, beautiful hazel eyes, good eyes, expressive eyes, perfect face`,
              model: "meinamix_meinaV11.safetensors [b56ce717]",
              negative_prompt: "3d, depth, realistic, render, ugly eyes, unmatched eyes, unmatched color, bad eyes, bad quality eyes, wrost eyes, imperfect eyes, deformed pupils, deformed iris, badly drawn, odd character, missing fingers, multiple fingers, multiple body parts, gay, ugly face, cropped, worst quality, low quality, username, blurry, closed eye, broken image, easynegative, worst quality, normal quality, low quality, low res, blurry, text, watermark, logo, banner, extra digits, cropped, jpeg artifacts, signature, username, error, sketch ,duplicate, ugly, monochrome, horror, geometry, mutation, disgusting, bad anatomy, bad hands, three hands, three legs, bad arms, missing legs, missing arms, poorly drawn face, bad face, fused face, cloned face, worst face, three crus, extra crus, fused crus, worst feet, three feet, fused feet, fused thigh, three thigh, fused thigh, extra thigh, worst thigh, missing fingers, extra fingers, ugly fingers, long fingers, horn, realistic photo, extra eyes, huge eyes, 2girl, amputation, disconnected limbs",
              sampler: 'Euler a',
              cfg_scale: 7,
              steps: 50,
              seed: -1,
              denoising_strength: 0.40,
              upscale: true,
              aspect_ratio: aspect_ratio,
            },
          };

          const response = await axios(options);
          const job = response.data.job;

          while (true) {
            const jobResponse = await axios.get(`https://api.prodia.com/v1/job/${job}`, {
              headers: {
                accept: 'application/json',
                'X-Prodia-Key': api_key,
              },
            });

            if (jobResponse.data.status === 'succeeded') {
              return jobResponse.data.imageUrl;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err) {
          console.error(err);
          message.reply("An error occurred.");
          throw err;
        }
      }

      try {
        const imageLink = await generateImage(imageUrl);
        const response = await axios.get(imageLink, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        const imageFileName = 'artx.png';
        const imagePath = path.join(__dirname, imageFileName);
        fs.writeFileSync(imagePath, imageBuffer);

        await api.sendMessage({
          attachment: fs.createReadStream(imagePath),
        }, event.threadID, event.messageID);
      } catch (error) {
        console.error(error);
        message.reply("An error occurred.");
      }
    });
  }
};

async function getImageDimensions(imageBuffer) {
  const imageSize = require('image-size');
  const dimensions = imageSize(imageBuffer);
  return dimensions;
}