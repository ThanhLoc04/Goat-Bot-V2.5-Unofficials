module.exports.config = {
    name: "monster",
    version: "6.0.0",
    hasPermssion: 0,
    credits: "D-Jukie - Heo Rừng rmk Niiozic",
    description: "Monster Game Command",
    category: "Game",
    usages: "[tag]",
    cooldowns: 0
};

module.exports.onLoad = function() {
    try {
        global.monster = require("./game/monster/index.js");
        global.configMonster = require("./game/monster/config.json");
    } catch (e) {
        console.log(e);
    }
};

module.exports.onStart = async function({ api, event, args, Users }) {
    var axios = require("axios");
    try {
        var send = (msg, cb) => api.sendMessage(msg, event.threadID, cb, event.messageID);
        switch (args[0]) {
            case "create":
            case "-c":
                return await global.monster.createCharacter({ Users, api, event });

            case "info":
            case "-i":
                return await global.monster.getCharacter({ api, event });

            case "status":
                return await global.monster.getServer({ api, event });

            case "stat":
                return await global.monster.getStats({ api, event });

            case "weapon":
                return await global.monster.getWeapon({ api, event });

            case "rank":
            case "-r":
                return await global.monster.getRank({ api, event });

            case "shop":
            case "-s":
                return await api.sendMessage(
                    "[ MONSTER SHOP ]\n────────────────\n1. Buy Great Sword weapon\n2. Buy Lance weapon\n3. Buy Swords'n Shields weapon\n4. Buy Dual Blades weapon\n5. Buy HBG weapon\n6. Buy LBG weapon\n7. Buy food 🍗\n8. Sell monsters 💵\n9. Buy upgrade items for weapons 🔨\nReply with the number to select",
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "listItem"
                        });
                    },
                    event.messageID
                );

            case "bag":
            case "-b":
                return await global.monster.myItem({ api, event });

            case "fix":
                var stream = (await axios.get(global.configMonster.fix, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "Note: Only repair the currently equipped weapon\nMaximum durability is 10,000 per weapon", attachment: stream },
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "increaseDurability"
                        });
                    },
                    event.messageID
                );

            case "up-HP":
                var stream = (await axios.get(global.configMonster.fix, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "Reply with the amount of points you want to add to the HP stat", attachment: stream },
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "increaseHp"
                        });
                    },
                    event.messageID
                );

            case "up-DEF":
                var stream = (await axios.get(global.configMonster.fix, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "Reply with the amount of points you want to add to the DEF stat", attachment: stream },
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "increaseDef"
                        });
                    },
                    event.messageID
                );

            case "up-ATK":
                var stream = (await axios.get(global.configMonster.fix, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "Reply with the amount of points you want to add to the ATK stat", attachment: stream },
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "increaseAtk"
                        });
                    },
                    event.messageID
                );

            case "up-SPD":
                var stream = (await axios.get(global.configMonster.fix, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "Reply with the amount of points you want to add to the SPD stat", attachment: stream },
                    event.threadID,
                    (err, info) => {
                        global.client.handleReply.push({
                            name: "monster",
                            messageID: info.messageID,
                            author: event.senderID,
                            type: "increaseSpd"
                        });
                    },
                    event.messageID
                );

            case "pvp":
            case "fight":
                return global.monster.match({ api, event });

            case "solo":
                send(
                    "[ ----- PVP ----- ]\n────────────────\n1. View all PVP rooms\n2. View your created room\n3. Create a room\nReply with the number or use the command + tag for actions.",
                    (err, res) => {
                        res.name = "monster";
                        res.type = "pvp";
                        global.client.handleReply.push(res);
                    }
                );
                break;

            case "location":
            case "-l":
                return await global.monster.listLocation({ api, event });

            default:
                var stream = (await axios.get(global.configMonster.monster, { responseType: "stream" })).data;
                return api.sendMessage(
                    { body: "[ MONSTER HUNTER ]\n────────────────\n1. Create: create a character\n2. Info: view character stats\n3. Shop: open shop\n4. Bag: open inventory\n5. Fix: repair equipment\n6. Match/PVP/Fight: hunt monsters\n7. Location: select hunting area\n8. Status: server information\n9. Weapon: equipped weapon\n10. Stat: view and upgrade stats\n11. Solo: open player-vs-player\nEnter /monster + corresponding number to use", attachment: stream },
                    event.threadID,
                    event.messageID
                );
        }
    } catch (e) {
        console.log(e);
    }
};

module.exports.onReply = async function({ api, event, Currencies, handleReply }) {
    if (typeof handleReply.author === "string" && handleReply.author !== event.senderID) return;

    switch (handleReply.type) {
        case "listItem":
            return await global.monster.getItems({ api, event, type: event.body });

        case "increaseDurability":
            return await global.monster.increaseDurability({ api, event, Currencies, handleReply });

        case "increaseHp":
            return await global.monster.increaseHp({ api, event, Currencies, handleReply });

        case "increaseDef":
            return await global.monster.increaseDef({ api, event, Currencies, handleReply });

        case "increaseAtk":
            return await global.monster.increaseAtk({ api, event, Currencies, handleReply });

        case "increaseSpd":
            return await global.monster.increaseSpd({ api, event, Currencies, handleReply });

        case "pvp":
            return global.monster.pvp(event, event.senderID, { 1: "list rooms", 2: "info room", 3: "create room" }[event.args[0]]);
    }
};

module.exports.onReaction = function(o) {
    switch (o.handleReaction.type) {
        case "pvp.room.info":
            global.monster.pvp.room(o, o.event.userID, {
                "👍": "ready",
                "👎": "leave"
            }[o.event.reaction]);
            break;
    }
};