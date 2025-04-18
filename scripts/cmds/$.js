const util = require('util');
const exec = util.promisify(require('child_process').exec);

module.exports = {
  config: {
    name: 'exec',
    aliases: ['$','>'],
    version: '1.0',
    author: 'Yukinori ʚĭɞ',
    role: 2,
    category: 'utility',
    shortDescription: {
      en: 'Executes terminal commands.',
    },
    longDescription: {
      en: 'Executes terminal commands and returns the output.',
    },
    guide: {
      en: '{pn} [command]',
    },
  },
  onStart: async function ({ api, args, message, event }) {
    if (args.length === 0) {
      message.reply('Usage: {pn} [command]');
      return;
    }

    const command = args.join(' ');

    try {
      const { stdout, stderr } = await exec(command);

      if (stderr) {
        message.send(`${stderr}`);
      } else {
        message.send(`${stdout}`);
      }
    } catch (error) {
      console.error(error);
      message.reply(`Error: ${error.message}`);
    }
  },
  onChat: async function ({ api, args, message, event }) {
    const messageContent = event.body.trim();

    if (!messageContent.startsWith('exec') && !messageContent.startsWith('$') && !messageContent.startsWith('>')) return;

    const commandArgs = messageContent.split(/ +/);
    const commandName = commandArgs.shift().toLowerCase();

    if (commandName !== this.config.name && !this.config.aliases.includes(commandName)) return;

    if (commandArgs.length === 0) {
      message.reply('Usage: {pn} [command]');
      return;
    }

    const command = commandArgs.join(' ');

    try {
      const { stdout, stderr } = await exec(command);

      if (stderr) {
        message.send(`${stderr}`);
      } else {
        message.send(`${stdout}`);
      }
    } catch (error) {
      console.error(error);
      message.reply(`Error: ${error.message}`);
    }
  },
};