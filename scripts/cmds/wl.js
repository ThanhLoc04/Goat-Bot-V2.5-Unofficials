const { config } = global.GoatBot;
const { writeFileSync } = require("fs-extra");

module.exports = {
  config: {
    name: "whitelist",
    aliases: ["wl"],
    version: "1.0.8",
    author: "Shikaki | Base code by: Rehat",
    countDown: 5,
    role: 2,
    longDescription: {
      en: "Add, remove, edit whitelistIds"
    },
    category: "owner",
    guide: {
      en: '{pn} [add | a] <uid | @tag>: Add whitelist role for user\n{pn} [remove | r] <uid | @tag>: Remove whitelist role of user\n{pn} [list | l] <uid | [page]>: List all whitelisted members or check if a user is whitelisted\n{pn} [on | off]: enable and disable whitelist mode'
    }
  },

  langs: {
    en: {
      added: "✅ | Added whitelist role for %1 users:\n%2",
      alreadyWhitelisted: "\n⚠️ | %1 users already have whitelist role:\n%2",
      missingIdAdd: "⚠️ | Please enter ID or tag user to add to whitelist",
      removed: "✅ | Removed whitelist role of %1 users:\n%2",
      notWhitelisted: "⚠️ | %1 users don't have whitelist role:\n%2",
      missingIdRemove: "⚠️ | Please enter ID or tag user to remove from whitelist",
      listWhitelisted: "👑 | List of whitelisted members:\n%1",
      enable: "Turned on the mode only specific whitelisted members can use bot",
      disable: "Turned off the mode only specific whitelisted members can use bot"
    }
  },

  onStart: async function ({ message, args, usersData, event }) {
    if (args.length === 0) {
      return message.reply(config.whiteListMode.enable ? "Whitelist mode is ON." : "Whitelist mode is OFF.");
    }
    switch (args[0]) {
      case "add":
      case "a": {
        if (args[1]) {
          let uids = [];
          if (Object.keys(event.mentions).length > 0)
            uids = Object.keys(event.mentions);
          else if (event.messageReply)
            uids.push(event.messageReply.senderID);
          else
            uids = args.filter(arg => !isNaN(arg));
          const notWhitelistedIds = [];
          const whitelistedIds = [];
          for (const uid of uids) {
            if (config.whiteListMode.whiteListIds.includes(uid))
              whitelistedIds.push(uid);
            else
              notWhitelistedIds.push(uid);
          }

          config.whiteListMode.whiteListIds.push(...notWhitelistedIds);
          const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
          writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
          return message.reply(
            (notWhitelistedIds.length > 0 ? this.langs.en.added.replace("%1", notWhitelistedIds.length).replace("%2", getNames.filter(({ uid }) => notWhitelistedIds.includes(uid)).map(({ uid, name }) => ` • ${name} (${uid})`).join("\n")) : "")
            + (whitelistedIds.length > 0 ? this.langs.en.alreadyWhitelisted.replace("%1", whitelistedIds.length).replace("%2", whitelistedIds.map(uid => ` • ${uid}`).join("\n")) : "")
          );
        }
        else
          return message.reply(this.langs.en.missingIdAdd);
      }
      case "remove":
      case "r": {
        if (args[1]) {
          let uids = [];
          if (Object.keys(event.mentions).length > 0)
            uids = Object.keys(event.mentions);
          else
            uids = args.filter(arg => !isNaN(arg));
          const notWhitelistedIds = [];
          const whitelistedIds = [];
          for (const uid of uids) {
            if (config.whiteListMode.whiteListIds.includes(uid))
              whitelistedIds.push(uid);
            else
              notWhitelistedIds.push(uid);
          }
          for (const uid of whitelistedIds)
            config.whiteListMode.whiteListIds.splice(config.whiteListMode.whiteListIds.indexOf(uid), 1);
          const getNames = await Promise.all(whitelistedIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
          writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
          return message.reply(
            (whitelistedIds.length > 0 ? this.langs.en.removed.replace("%1", whitelistedIds.length).replace("%2", getNames.map(({ uid, name }) => ` • ${name} (${uid})`).join("\n")) : "")
            + (notWhitelistedIds.length > 0 ? this.langs.en.notWhitelisted.replace("%1", notWhitelistedIds.length).replace("%2", notWhitelistedIds.map(uid => ` • ${uid}`).join("\n")) : "")
          );
        }
        else
          return message.reply(this.langs.en.missingIdRemove);
      }
      case "list":
        if (args[1] && !isNaN(args[1])) {
          const uid = args[1];
          usersData.getName(uid).then(name => {
            if (config.whiteListMode.whiteListIds.includes(uid))
              return message.reply(`${name} (${uid}) is a whitelisted member.`);
            else
              return message.reply(`${name} (${uid}) is not a whitelisted member.`);
          });
          return;
        } else {
          const page = args[1] ? parseInt(args[1]) : 1;
          const whitelistedMembers = await Promise.all(config.whiteListMode.whiteListIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
          whitelistedMembers.sort((a, b) => {
            if (a.name && b.name) {
              return a.name.localeCompare(b.name);
            } else if (!a.name) {
              return -1;
            } else if (!b.name) {
              return 1;
            } else {
              return 0;
            }
          });
          const pages = Math.ceil(whitelistedMembers.length / 30);
          const startIndex = (page - 1) * 30;
          const endIndex = startIndex + 30;
          const pageMembers = whitelistedMembers.slice(startIndex, endIndex);

          if (page > pages) {
            return message.reply("Empty.");
          }

          const listWhitelisted = this.langs.en.listWhitelisted.replace("%1", pageMembers.map(({ uid, name }) => ` • ${name} (${uid})`).join("\n"));
          message.reply(listWhitelisted + `\nPage ${page} of ${pages}`);
          break;
        }
      case "on": {
        config.whiteListMode.enable = true;
        writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
        return message.reply(this.langs.en.enable);
      }
      case "off": {
        config.whiteListMode.enable = false;
        writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
        return message.reply(this.langs.en.disable);
      }
    }
  }
}