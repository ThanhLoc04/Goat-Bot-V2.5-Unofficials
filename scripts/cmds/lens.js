const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

// Function to get content from Google Lens
async function getContentLens(content) {
  const timestamp = Date.now();
  const url = `https://lens.google.com/v3/upload?hl=en&re=df&stcs=${timestamp}&vpw=1500&vph=1500`;

  const formData = new FormData();
  formData.append('encoded_image', content, {
    filename: 'image.jpg', // Provide a filename
    contentType: 'image/jpeg', // Specify content type
  });

  const headers = {
    ...formData.getHeaders(),
    Cookie: 'NID=511=eoiYVbD3qecDKQrHrtT9_jFCqvrNnL-GSi7lPJANAlHOoYlZOhFjOhPvcc-43ZSGmBx_L5D_Irknb8HJvUMo41sCh1i0homN3Taqg2z7mdjnu3AQe-PbpKAyKE4zW1-N6niKTJAMkV6Jq4AWPwp6txH_c24gjt7fU3LWAfNIezA',
  };

  const response = await axios.post(url, formData, { headers });
  return response.data;
}

// Function to extract URLs from HTML content
function extractURL(htmlContent) {
  const items = [];

  try {
    const $ = cheerio.load(htmlContent);
    const divs = $('div.Vd9M6');

    divs.each((index, div) => {
      const actionUrl = $(div).attr('data-action-url');
      const query = new URLSearchParams(actionUrl);
      const imgUrl = decodeURIComponent(query.get('imgurl'));
      const imgRefUrl = decodeURIComponent(query.get('imgrefurl'));
      const title = $(div).find('div.UAiK1e').text().trim();

      if (imgUrl && imgRefUrl && title) {
        const host = new URL(imgRefUrl).host;
        items.push({
          title,
          thumbnail: imgUrl,
          link: imgRefUrl,
          host,
        });
      }
    });
  } catch (error) {
    throw error;
  }

  return items;
}

// Discover function to process an image URL
async function discover(link) {
  if (!link) {
    throw new Error('No Link Passed');
  }

  try {
    const { data } = await axios.get(link, { responseType: 'arraybuffer' });
    const content = await getContentLens(data);

    if (content) {
      const response = extractURL(content);
      return response;
    } else {
      throw new Error('No Content Found');
    }
  } catch (error) {
    throw error;
  }
}

// Exported module
module.exports = {
  config: {
    name: "lens",
    aliases: ["googlelens", "vision"],
    usage: "{pn} lens <image_reply>",
    description: {
      short: "Google Lens",
      long: "Search for similar images via Google Lens",
    },
    cooldown: 10,
    category: "utility",
  },
  onStart: async function ({ message, api, event, args }) {
    try {
      // Check if the user replied to a message containing an image
      if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
        return message.reply("Please reply to a message containing an image.");
      }

      const attachment = event.messageReply.attachments[0];
      if (attachment.type !== 'photo') {
        return message.reply("The attachment must be an image.");
      }

      const imageUrl = attachment.url; // Extract the image URL
      if (!imageUrl) {
        return message.reply("Unable to retrieve the image URL.");
      }

      const initiate = await message.reply("Searching with Google Lens...");

      const results = await discover(imageUrl);
      const response = results.slice(0, 3); // Limit to top 3 results

      if (response.length === 0) {
        return message.reply("No similar images found.");
      }

      // Send the results with thumbnails and links
      for (const item of response) {
        await message.reply({
          body: `Title: ${item.title}\nHost: ${item.host}\nLink: ${item.link}`,
          attachment: await axios.get(item.thumbnail, { responseType: 'stream' }).then((res) => res.data),
        });
      }

      // Remove the "Searching" message
      await message.unsend(initiate.messageID);
    } catch (e) {
      console.error(e);
      message.reply(`An error occurred: ${e.message}`);
    }
  },
};