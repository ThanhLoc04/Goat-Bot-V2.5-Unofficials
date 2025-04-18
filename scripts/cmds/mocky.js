module.exports = {
    config: {
        name: "mocky",
        version: "0.0.1",
        author: "LocDev",
        countDown: 5,
        role: 2,
        description: {
            vi: "",
            en: ""
        },
        category: "admin",
        guide: {
            vi: "",
            en: ""
        }
    },

    langs: {
        vi: {},
        en: {}
    },

    onStart: async function({ event, api, args, Users }) {
        const axios = require('axios');
        const fs = require('fs');
        var contents = args.join(" ")
        if (!contents) {
            return api.sendMessage('thiếu dữ liệu text!', event.threadID, event.messageID);
        }
        if (contents.endsWith(".js")) {
            var data = fs.readFile(
                `${__dirname}/${contents}`,
                "utf-8",
                async (err, data) => {
                    if (err) return api.sendMessage(`Lệnh ${contents} không tồn tại!.`, event.threadID, event.messageID);
                    axios.post("https://api.mocky.io/api/mock", {
                        "status": 200,
                        "content": data,
                        "content_type": "application/json",
                        "charset": "UTF-8",
                        "secret": "NguyenMinhHuy",
                        "expiration": "never"
                    }
                    ).then(function (response) {
                        return api.sendMessage(`Kết quả: ${response.data.link}`, event.threadID, event.messageID);
                    })
                }
            );
            return
        } else {
            axios.post("https://api.mocky.io/api/mock", {
                "status": 200,
                "content": contents,
                "content_type": "application/json",
                "charset": "UTF-8",
                "secret": "NguyenMinhHuy",
                "expiration": "never"
            }
            ).then(function (response) {
                return api.sendMessage(`Kết quả: ${response.data.link}`, event.threadID, event.messageID);
            })
        }
    }
}