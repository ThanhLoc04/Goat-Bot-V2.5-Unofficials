const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const archiver = require('archiver');

module.exports.config = {
    name: "file",
    aliases: ["fl"],
    version: "1.1.4",
    author: "Niiozic Team - LocDev",
    countDown: 0,
    role: 2,
    shortDescription: "File management command",
    longDescription: "Manage files and folders on the server",
    category: "owner",
    guide: "Reply with: open, send, del, view, create, zip, copy, or rename + number"
};

module.exports.onStart = function ({ api, event, args }) {
    openFolder(api, event, process.cwd() + (args[0] ? args[0] : ''));
};

module.exports.onReply = async function ({ api, event, message, Reply }) {
    if (!Reply) return;

    const { author, data, directory } = Reply;
    if (event.senderID !== author) return;

    const [action, ...params] = event.body.toLowerCase().split(' ');
    const index = parseInt(params[0]) - 1;

    if (!['create'].includes(action) && (isNaN(index) || !data[index])) {
        return api.sendMessage('⚠️ Invalid index or action', event.threadID, event.messageID);
    }

    try {
        switch (action) {
            case 'open':
                if (data[index].info.isDirectory()) {
                    openFolder(api, event, data[index].dest);
                } else {
                    api.sendMessage('⚠️ Not a directory', event.threadID, event.messageID);
                }
                break;

            case 'del':
                deleteItems(api, event, data, params);
                break;

            case 'send':
                const content = fs.readFileSync(data[index].dest, 'utf8');
                const link = await bin(content);
                api.sendMessage(link, event.threadID, event.messageID);
                break;

            case 'view':
                viewFile(api, event, data[index].dest);
                break;

            case 'create':
                createItem(api, event, directory, params.join(' '));
                break;

            case 'copy':
                copyFile(api, event, data[index].dest);
                break;

            case 'rename':
                renameItem(api, event, data[index].dest, params[1]);
                break;

            case 'zip':
                const indices = params.map(p => parseInt(p) - 1);
                const files = indices.map(i => data[i].dest);
                const zipLink = await catbox(zip(files));
                api.sendMessage(zipLink, event.threadID, event.messageID);
                break;

            default:
                api.sendMessage('❎ Invalid action. Reply with: open, send, del, view, create, zip, copy, or rename + number', event.threadID, event.messageID);
        }
    } catch (e) {
        console.error(e);
        api.sendMessage(e.toString(), event.threadID, event.messageID);
    }
};

function getFolderSize(folderPath) {
    let totalSize = 0;
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
            totalSize += stats.size;
        } else if (stats.isDirectory()) {
            totalSize += getFolderSize(filePath);
        }
    }
    return totalSize;
}

function openFolder(api, event, folderPath) {
    const items = fs.readdirSync(folderPath).map(item => {
        const itemPath = path.join(folderPath, item);
        const stats = fs.statSync(itemPath);
        const isDirectory = stats.isDirectory();
        return {
            name: item,
            isDirectory: isDirectory,
            size: isDirectory ? getFolderSize(itemPath) : stats.size,
            path: itemPath
        };
    });

    items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return b.isDirectory - a.isDirectory;
    });

    let message = '';
    let totalSize = 0;
    const data = items.map((item, index) => {
        const icon = item.isDirectory ? '🗂️' : '📄';
        const size = convertBytes(item.size);
        message += `${index + 1}. ${icon} ${item.name} (${size})\n`;
        totalSize += item.size;
        return { dest: item.path, info: { isDirectory: () => item.isDirectory, isFile: () => !item.isDirectory } };
    });

    message += `\n📊 Total size: ${convertBytes(totalSize)}\nReply with: open, send, del, view, create, zip, copy, or rename + number`;

    api.sendMessage(message, event.threadID, (err, info) => {
        if (!err) {
            global.GoatBot.onReply.set(info.messageID, {
                commandName: "fileq",
                author: event.senderID,
                data: data,
                directory: folderPath + '/'
            });
        }
    }, event.messageID);
}

function convertBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function deleteItems(api, event, data, params) {
    const deletedItems = params.map(param => {
        const index = parseInt(param) - 1;
        const item = data[index];
        if (item.info.isFile()) {
            fs.unlinkSync(item.dest);
            return `${param}. File: ${path.basename(item.dest)}`;
        } else if (item.info.isDirectory()) {
            fs.rmdirSync(item.dest, { recursive: true });
            return `${param}. Folder: ${path.basename(item.dest)}`;
        }
    }).filter(Boolean);

    api.sendMessage(`✅ Deleted:\n${deletedItems.join('\n')}`, event.threadID, event.messageID);
}

function viewFile(api, event, filePath) {
    const ext = path.extname(filePath);
    const tempPath = ext === '.js' ? filePath.replace('.js', '.txt') : filePath;

    if (ext === '.js') {
        fs.copyFileSync(filePath, tempPath);
    }

    api.sendMessage({ attachment: fs.createReadStream(tempPath) }, event.threadID, () => {
        if (ext === '.js') {
            fs.unlinkSync(tempPath);
        }
    }, event.messageID);
}

function createItem(api, event, directory, itemPath) {
    const fullPath = path.join(directory, itemPath);
    if (itemPath.endsWith('/')) {
        fs.mkdirSync(fullPath, { recursive: true });
        api.sendMessage(`✅ Created folder: ${itemPath}`, event.threadID, event.messageID);
    } else {
        fs.writeFileSync(fullPath, '');
        api.sendMessage(`✅ Created file: ${itemPath}`, event.threadID, event.messageID);
    }
}

function copyFile(api, event, sourcePath) {
    const dir = path.dirname(sourcePath);
    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const newPath = path.join(dir, `${baseName} (COPY)${ext}`);
    fs.copyFileSync(sourcePath, newPath);
    api.sendMessage(`✅ Copied: ${path.basename(sourcePath)} to ${path.basename(newPath)}`, event.threadID, event.messageID);
}

function renameItem(api, event, oldPath, newName) {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    api.sendMessage(`✅ Renamed: ${path.basename(oldPath)} to ${newName}`, event.threadID, event.messageID);
}

function zip(sourcePaths) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    sourcePaths.forEach(sourcePath => {
        const name = path.basename(sourcePath);
        if (fs.statSync(sourcePath).isDirectory()) {
            archive.directory(sourcePath, name);
        } else {
            archive.file(sourcePath, { name: name });
        }
    });
    archive.finalize();
    return archive;
}

async function catbox(stream) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', stream);
    const response = await axios.post('https://catbox.moe/user/api.php', form, { headers: form.getHeaders() });
    return response.data;
}

async function bin(text) {
    const response = await axios.post('https://api.mocky.io/api/mock', {
        status: 200,
        content: text,
        content_type: "text/plain",
        charset: "UTF-8",
        secret: "LeMinhTien",
        expiration: "never"
    });
    return response.data.link;
}