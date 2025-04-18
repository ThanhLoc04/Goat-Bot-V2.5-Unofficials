const axios = require("axios");

module.exports = {
  config: {
    name: "girls",
    category: "entertainment"
  },
  onStart: async function({message}) {
    
    try {
      const {data: result} = await axios.get("https://hiroshi-api.onrender.com/video/eabab");
      const {data: vidSt} = await axios.get(result.link, {responseType: "stream"});
     
      vidSt.path = Date.now() + ".mp4";
      return message.reply({body: `${result.username}`, attachment: vidSt});
    } catch (e) {
      await message.react("❌")
    }
  }
}