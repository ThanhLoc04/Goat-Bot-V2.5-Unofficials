const {
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory,
} = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const {
    GoogleAIFileManager,
    FileState,
} = require("@google/generative-ai/server");
const axios = require("axios");
const cheerio = require("cheerio");
const { Json } = require("sequelize/lib/utils");

const apiKey = "AIzaSyCjHC9xWZQ_SrNjRCuCRAbhdUQfaFwqGec"; //apikey
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

let links = [];
let prompt;
let uid;
let mimeType;
let extension;
let systemInstruction = "";

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

async function downloadAndUploadFiles(links, uid) {
    const files = await Promise.all(
        links.map(async (link) => {
            const filePath = path.join(
                "gemini1.5",
                "files",
                `${uid}`,
                `${link.name}.${link.extension}`
            );
            const dirPath = path.dirname(filePath);

            console.log(`Processing file: ${link.name}`);
            console.log(`File path: ${filePath}`);
            console.log(`UID: ${uid}`);

            try {
                await fs.promises.mkdir(dirPath, { recursive: true });
                console.log(`Created directory: ${dirPath}`);
                const fileBuffer = await downloadFile(link.url);
                console.log(`Downloaded file: ${link.name}`);
                await fs.promises.writeFile(filePath, fileBuffer);
                console.log(`Wrote file to: ${filePath}`);

                const uploadedFile = await fileManager.uploadFile(filePath, {
                    mimeType: link.mimeType,
                    displayName: link.name,
                });

                console.log(`Uploaded file to Gemini: ${link.name}`);
                return uploadedFile.file;
            } catch (error) {
                console.error(`Error downloading and uploading file: ${error}`);
                return null;
            }
        })
    );
    return files;
}

async function waitForFilesActive(files) {
    console.log("Waiting for file processing...");

    const pollIntervalMs = 10_000;

    for (const file of files) {
        if (file === null) {
            console.warn("Skipping null file.");
            continue;
        }

        let fileStatus = await fileManager.getFile(file.name);

        while (fileStatus.state === FileState.PROCESSING) {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            fileStatus = await fileManager.getFile(file.name);
        }

        if (fileStatus.state === FileState.FAILED) {
            throw new Error(`File ${file.name} failed to process.`);
        }

        console.log(`File ${file.displayName} is ready for inference as ${file.uri}`);
    }

    console.log("...all files ready\n");
}

function getChatHistory(uid) {
    const dirPath = path.join(__dirname, "gemini");
    const filePath = path.join(dirPath, `${uid}.json`);

    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    }
    return [];
}

function saveChatHistory(uid, history) {
    const dirPath = path.join(__dirname, "gemini");
    const filePath = path.join(dirPath, `${uid}.json`);

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }

    const filteredHistory = history.map(entry => ({
        role: entry.role,
        parts: entry.parts.filter(part => !part.fileData).map(part => ({ text: part.text }))
    }));

    fs.writeFileSync(filePath, JSON.stringify(filteredHistory, null, 2));
}

async function GetAns(prompt, uid, links, systemInstruction) {
    if (prompt.toLowerCase() === "clear") {
        saveChatHistory(uid, []);
        return "chat history cleared!";
    }
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest", //2.0-flash-exp
        systemInstruction: systemInstruction,
        safetySettings,
        tools: [{ codeExecution: {} }],
    });

    let history = getChatHistory(uid);

    history = history.filter(entry => {
        if (entry.parts) {
            entry.parts = entry.parts.filter(part => (part.text && part.text.trim() !== "") || part.fileData);
        }
        return entry.parts && entry.parts.length > 0;
    });

    for (let i = 0; i < history.length - 1; i++) {
        if (history[i].role === history[i + 1].role) {
            history.splice(i + 1, 1);
            i--;
        }
    }

    if (history.length >= 2) {
        for (let i = 0; i < history.length - 1; i++) {
            if (history[i].role === history[i + 1].role) {
                history.splice(i + 1, 1);
                i--;
            }
        }
    }

    let files = [];
    if (links.length > 0) {
        files = await downloadAndUploadFiles(links, uid);
        await waitForFilesActive(files);
    }

    let userMessageParts = [{ text: prompt }];
    if (files.length > 0) {
        userMessageParts = [
            ...userMessageParts,
            ...files.map((file) => ({
                fileData: { mimeType: file.mimeType, fileUri: file.uri },
            })),
        ];
    }

    history.push({ role: "user", parts: userMessageParts });

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 8192,
        },
    });

    try {
        const result = await chat.sendMessage(userMessageParts);
        const response = await result.response;
        if (response.candidates && response.candidates.length > 0) {
            let text = response.candidates[0].content?.parts
                ?.filter(part => part.text)
                ?.map(part => part.text)
                ?.join("\n\n") || "";

            if (text.trim() === "" || text.trim() === "null" || text.trim() === "undefined") {
                if (response.finishReason === "RECITATION") {
                    return "Failed due to RECITATION. Try your luck in future.";
                } else if (response.candidates && response.candidates[0].finishReason === "RECITATION") {
                    return "Failed due to RECITATION. Try your luck in future.";
                } else {
                    return "An error occurred while processing your request.";
                }
            }

            history.push({
                role: "model",
                parts: [{ text: text.trim() }]
            });

            if (history.length >= 2) {
                const lastUserIndex = history.length - 2;
                history[lastUserIndex].parts = history[lastUserIndex].parts.filter(part =>
                    Object.keys(part).length > 0 && (part.text || part.fileData)
                );
            }

            saveChatHistory(uid, history);
            return text.trim();
        } else {
            if (response.promptFeedback && response.promptFeedback.blockReason) {
                const reason = response.promptFeedback.blockReason;
                return `Prompt blocked due to the reason : ${reason}`;
            } else if (response.finishReason === "RECITATION") {
                return "Failed due to RECITATION. Try your luck in future.";
            } else {
                return "An error occurred while processing your request.";
            }
        }
    } catch (error) {
        console.error("Error during sendMessage:", error);
        return "An error occurred while processing your request.";
    } finally {
        try {
            const folderPath = path.join("gemini1.5", "files", `${uid}`);
            if (fs.existsSync(folderPath)) {
                await fs.promises.rm(folderPath, { recursive: true });
                console.log(`Deleted folder: ${folderPath}`);
            }
        } catch (error) {
            console.error(`Error deleting folder ${folderPath}: ${error}`);
        }
    }
}

async function downloadFile(url) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        return response.data;
    } catch (error) {
        console.error(`Error downloading file: ${error}`);
        return null;
    }
}

const Prefixes = ["gn"];

module.exports = {
    config: {
        name: "gn",
        version: "1.3",
        author: "Shikaki",
        countDown: 5,
        role: 0,
        description: { en: "Text & image & video & audio & gif & files(plain text, csv) input and text outout using Google Gemini 1.5 flash" },
        guide: { en: "{pn} <query>" },
        category: "ai",
    },
    onStart: async function () { },
    onChat: async function ({ api, message, event, commandName }) {
        //console.log('onChat function called');

        mimeType;
        extension;
        links = [];

        const prefix = Prefixes.find((p) => {
            if (!event.body) {
                return false; // Early return if event.body is undefined or null
            }
            const words = event.body.split(' ');
            return words[0].toLowerCase() === p;
        });

        if (!prefix) {
            //console.log('No prefix found, returning');
            return;
        }

        prompt = event.body.replace(prefix, '').trim();

        if (prompt.toLowerCase() === "") {
            return;
        }

        if (prompt.toLowerCase().startsWith("gn ")) {
            prompt = prompt.substring(2).trim();
        }

        console.log(`Processing prompt: ${prompt}`);

        const urlRegex = /\b(https?:\/\/[^\s]+)/g;
        const urls = prompt.match(urlRegex);

        links = [];

        var websiteData = '';
        if (urls && urls.length > 0) {
            console.log('Found URLs, processing...');
            for (const webUrl of urls) {
                mimeType = await getMimeTypeFromUrl(webUrl);
                if (mimeType.startsWith('image/')) {
                    const fileExtension = mimeType.substring(mimeType.indexOf('/') + 1);
                    console.log(`MIME type of ${webUrl}: ${mimeType}, File Extension: ${fileExtension}`);
                    prompt = prompt.replace(webUrl, '');

                    let imageUrl = event.attachments[0].image;

                    links.push({ url: imageUrl, mimeType: mimeType || "image/jpeg", name: `${Date.now()}`, extension: "jpeg" });
                    console.log(`Added attachment to links array: ${imageUrl}, ${mimeType}`);

                    let answer = await GetAns(prompt, uid, links, systemInstruction);
                    console.log(`Generated answer: ${answer}`);

                    message.reply(answer, (err, info) => {
                        if (!err) {
                            global.GoatBot.onReply.set(info.messageID, {
                                commandName,
                                messageID: info.messageID,
                                author: event.senderID
                            });
                        }
                    });
                    api.setMessageReaction("✅", event.messageID, () => { }, true);
                    return;
                }
                if (mimeType.startsWith('text/') || mimeType.startsWith('application/')) {
                    console.log('Found text, processing...');
                    websiteData += await getTextFromWebsite(webUrl);
                    prompt = prompt.replace(webUrl, '');
                }
            }
            prompt = websiteData + "\n" + prompt;
        }

        uid = event.senderID;
        console.log(`User ID: ${uid}`);

        let content;

        if (event.type == "message_reply") {
            content = event.messageReply?.body ?? "";
            console.log(`Content: ${content}`);

            for (let i = 0; i < event.messageReply.attachments.length; i++) {
                let url = event.messageReply.attachments[i]?.url;
                let attType = event.messageReply.attachments[i]?.type;
                let name = event.messageReply.attachments[i]?.filename;
                let extension = event.messageReply.attachments[i]?.original_extension;

                console.log(`Attachment ${i}: ${url}, ${mimeType}, ${name}, ${extension}`);

                switch (attType) {
                    case 'photo':
                        extension = 'png';
                        mimeType = 'image/png';
                        break;
                    case 'file':
                        let contentType = event.messageReply.attachments[0].contentType;
                        if (contentType == "attach:ms:word")
                        {
                            mimeType = "application/vnd.google-apps.document";
                            extension = "docx";
                        }
                        else if (contentType == "attach:ms:ppt")
                        {
                            mimeType = "application/vnd.google-apps.presentation";
                            extension = "pptx";
                        }
                        else if (contentType == "attach:text")
                        {
                            mimeType = "text/plain";
                            extension = "txt";
                        }
                        else
                        {
                            mimeType = "application/pdf";
                            extension = "pdf";
                        }

                        try {
                            name = event.messageReply.attachments[0].filename;
                            url = event.messageReply.attachments[0].url;
                            url = url.replace("https://l.facebook.com/l.php?u=", "");
                            url = decodeURIComponent(url);
                        } catch (e) {
                            console.log(e);
                        }
                        console.log(url);
                    
                        break;
                    case 'video':
                        extension = 'mp4';
                        mimeType = 'video/mp4';
                        url = event.messageReply.attachments[0].url;
                        break;
                    case 'audio':
                        extension = 'mp3';
                        mimeType = 'audio/mp3';
                        url = event.messageReply.attachments[0].url;
                        break;
                    default:
                        console.log(`Unknown extension: ${extension}`);
                        break;
                }

                links.push({ url, mimeType, name, extension });
            }
        }

        content = (content ?? "") + " " + prompt;
        console.log(`Updated content: ${content}`);

        api.setMessageReaction("⌛", event.messageID, () => { }, true);
        console.log('Set message reaction to ⌛');

        try {
            let answer = await GetAns(prompt, uid, links, systemInstruction);
            console.log(`Generated answer: ${answer}`);

            message.reply(answer, (err, info) => {
                if (!err) {
                    global.GoatBot.onReply.set(info.messageID, {
                        commandName,
                        messageID: info.messageID,
                        author: event.senderID,
                    });
                    console.log('Set onReply data');
                }
            });
            api.setMessageReaction("✅", event.messageID, () => { }, true);
            console.log('Set message reaction to ✅');
        } catch (error) {
            console.error(`Error generating answer: ${error.message}`);
            message.reply(`${error.message}`, event.threadID);
            api.setMessageReaction("❌", event.messageID, () => { }, true);
            console.log('Set message reaction to ❌');
        }

    },

    onReply: async function ({ api, message, event, Reply, args }) {
        //console.log('onReply function called');

        let links = [];
        let mimeType;

        prompt = args.join(" ");
        uid = event.senderID;
        console.log(`User ID: ${uid}`);

        const { author, commandName, previousAttachments } = Reply;
        console.log(`Author: ${author}, Command Name: ${commandName}`);

        if (event.senderID !== author) {
            console.log('Not the same author, returning');
            return;
        }

        const urlRegex = /\b(https?:\/\/[^\s]+)/g;
        const urls = prompt.match(urlRegex);

        var websiteData = '';
        if (urls && urls.length > 0) {
            console.log('Found URLs, processing...');
            for (const webUrl of urls) {
                mimeType = await getMimeTypeFromUrl(webUrl);
                if (mimeType.startsWith('image/')) {
                    const fileExtension = mimeType.substring(mimeType.indexOf('/') + 1);
                    console.log(`MIME type of ${webUrl}: ${mimeType}, File Extension: ${fileExtension}`);
                    prompt = prompt.replace(webUrl, '');

                    let imageUrl = event.attachments[0].image;

                    links.push({ url: imageUrl, mimeType: mimeType || "image/jpeg", name: `${Date.now()}`, extension: "jpeg" });
                    console.log(`Added attachment to links array: ${imageUrl}, ${mimeType}`);

                    let answer = await GetAns(prompt, uid, links, systemInstruction);
                    console.log(`Generated answer: ${answer}`);

                    message.reply(answer, (err, info) => {
                        if (!err) {
                            global.GoatBot.onReply.set(info.messageID, {
                                commandName,
                                messageID: info.messageID,
                                author: event.senderID
                            });
                        }
                    });
                    api.setMessageReaction("✅", event.messageID, () => { }, true);
                    return;
                } else if (mimeType.startsWith('text/') || mimeType.startsWith('application/')) {
                    console.log('Found website, processing...');
                    websiteData += await getTextFromWebsite(webUrl);
                    prompt = prompt.replace(webUrl, '');
                }
            }
            prompt = websiteData + "\n" + prompt;
        }
        console.log(`Updated prompt after web scraped: ${prompt}`);

        const processAttachments = (attachments) => {
            for (let i = 0; i < attachments.length; i++) {
                let url = attachments[i]?.url || attachments[i]?.image;
                let attType = attachments[i]?.type;
                let name = attachments[i]?.filename || `${Date.now()}`;
                let extension = attachments[i]?.original_extension;
                if (url?.includes('.mp4')) {
                    extension = 'mp4';
                    mimeType = 'video/mp4';
                } else if (url?.includes('.mp3')) {
                    extension = 'mp3';
                    mimeType = 'audio/mp3';
                }

                console.log(`Attachment ${i}: ${url}, ${mimeType}, ${name}, ${extension}`);

                switch (attType) {
                    case 'photo':
                        extension = 'png';
                        mimeType = 'image/png';
                        break;
                    case 'file':
                        let contentType = event.messageReply.attachments[0].contentType;
                        if (contentType == "attach:ms:word")
                        {
                            mimeType = "application/vnd.google-apps.document";
                            extension = "docx";
                        }
                        else if (contentType == "attach:ms:ppt")
                        {
                            mimeType = "application/vnd.google-apps.presentation";
                            extension = "pptx";
                        }
                        else if (contentType == "attach:text")
                        {
                            mimeType = "text/plain";
                            extension = "txt";
                        }
                        else
                        {
                            mimeType = "application/pdf";
                            extension = "pdf";
                        }

                        try {
                            name = event.messageReply.attachments[0].filename;
                            url = event.messageReply.attachments[0].url;
                            url = url.replace("https://l.facebook.com/l.php?u=", "");
                            url = decodeURIComponent(url);
                        } catch (e) {
                            console.log(e);
                        }
                        console.log(url);
                    
                        break;
                    case 'video':
                        extension = 'mp4';
                        mimeType = 'video/mp4';
                        url = url || event.messageReply.attachments[0].url;
                        break;
                    case 'audio':
                        extension = 'mp3';
                        mimeType = 'audio/mp3';
                        url = url || event.messageReply.attachments[0].url;
                        break;
                    default:
                        console.log(`Unknown extension: ${extension}`);
                        break;
                }

                links.push({ url, mimeType, name, extension });
            }
        };

        try {
            api.setMessageReaction("⌛", event.messageID, () => { }, true);
            console.log('Set message reaction to ⌛');

            if (previousAttachments && prompt.trim() !== "") {
                console.log('Processing previous attachments with new prompt');
                processAttachments(previousAttachments);
                let answer = await GetAns(prompt, uid, links, systemInstruction);
                console.log(`Generated answer: ${answer}`);

                message.reply(answer, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName,
                            messageID: info.messageID,
                            author: event.senderID
                        });
                    }
                });
                api.setMessageReaction("✅", event.messageID, () => { }, true);
                return;
            }

            if (event.attachments.length > 0 && prompt.trim() === "") {
                console.log('Attachments detected without prompt');
                let response = event.attachments.length === 1 ? "What would you like to do with the file?" : "What would you like to do with the files?";
                message.reply(response, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName,
                            messageID: info.messageID,
                            author: event.senderID,
                            previousAttachments: event.attachments  // Store attachments for next interaction
                        });
                    }
                });
                api.setMessageReaction("✅", event.messageID, () => { }, true);
                return;
            }

            if (event.attachments.length > 0 && prompt.trim() !== "") {
                console.log('Processing current attachments with prompt');
                processAttachments(event.attachments);
            }

            if (prompt.trim() !== "") {
                processAttachments(event.attachments);

                let answer = await GetAns(prompt, uid, links, systemInstruction);
                console.log(`Generated answer: ${answer}`);

                message.reply(answer, (err, info) => {
                    if (!err) {
                        global.GoatBot.onReply.set(info.messageID, {
                            commandName,
                            messageID: info.messageID,
                            author: event.senderID
                        });
                    }
                });
                api.setMessageReaction("✅", event.messageID, () => { }, true);
            }

        } catch (error) {
            console.error(`Error processing message: ${error.message}`);
            message.reply(`Error: ${error.message}`);
            api.setMessageReaction("❌", event.messageID, () => { }, true);
            console.log('Set message reaction to ❌');
        }
    }
}

async function getTextFromWebsite(webUrl) {
    try {
        console.log(`Fetching website: ${webUrl}`);
        const response = await fetch(webUrl);
        const html = await response.text();
        const $ = cheerio.load(html);
        const allText = $('body').text();
        console.log(`Text from website: ${allText}`);
        return allText;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function getMimeTypeFromUrl(url) {
    try {
        console.log(`Fetching MIME type: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        const mimeType = response.headers.get('Content-Type');
        console.log(`MIME type: ${mimeType}`);
        return mimeType;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}