class Command {
    constructor(config) {
        this.config = config;
        this.count_req = 0;
    }

    onStart({
        event: {
            messageReply,
            senderID,
        },
        args,
        api,
    }) {
        if (senderID == api.getCurrentUserID())return;

        mqttClient.publish('/ls_req', JSON.stringify({
            "app_id": "2220391788200892",
            "payload": JSON.stringify({
                tasks: [{
                    label: '742',
                    payload: JSON.stringify({
                        message_id: messageReply.messageID,
                        text: args.join(' '),
                    }),
                    queue_name: 'edit_message',
                    task_id: Math.random() * 1001 << 0,
                    failure_count: null,
                }],
                epoch_id: this.generateOfflineThreadingID(),
                version_id: '6903494529735864',
            }),
            "request_id": ++this.count_req,
            "type": 3
        }))
    }

    generateOfflineThreadingID() {
        var ret = Date.now();
        var value = Math.floor(Math.random() * 4294967295);
        var str = ("0000000000000000000000" + value.toString(2)).slice(-22);
        var msgs = ret.toString(2) + str;
        return this.binaryToDecimal(msgs);
    }

    binaryToDecimal(data) {
        var ret = "";
        while (data !== "0") {
            var end = 0;
            var fullName = "";
            var i = 0;
            for (; i < data.length; i++) {
                end = 2 * end + parseInt(data[i], 10);
                if (end >= 10) {
                    fullName += "1";
                    end -= 10;
                } else {
                    fullName += "0";
                }
            }
            ret = end.toString() + ret;
            data = fullName.slice(fullName.indexOf("1"));
        }
        return ret;
    }

}


module.exports = new Command({
    name: 'edit',
    aliases: ["ed"],
    version: '0.0.1',
    role: 0,
    author: 'DC-Nam',
    shortDescription: "edit message",
    longDescription: "edit message bot",
    category: 'Tiện ích',
    guide: "{pn} <text>",
    countDown: 5,
})