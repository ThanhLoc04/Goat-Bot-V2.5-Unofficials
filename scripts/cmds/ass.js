const axios = require("axios");
const { getStreamFromURL } = global.utils;
const fetch = require('node-fetch');

async function postWithProxy(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`Request failed (${response.status} ${response.statusText})`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error:", error.message);
        return null;
    }
}

async function getWithProxy(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed (${response.status} ${response.statusText})`);
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return await response.text();
        }
    } catch (error) {
        console.error("Error:", error.message);
        return null;
    }
}

const qualityTagsPresets = ["(None)", "Standard v3.0", "Standard v3.1", "Light v3.1", "Heavy v3.1"];
const stylePresets = ["(None)", "Cinematic", "Photographic", "Anime", "Manga", "Digital Art", "Pixel Art", "Fantasy Art", "Neonpunk", "3D Model"];
const samplers = ["DPM++ 2M Karras", "DPM++ SDE Karras", "DPM++ 2M SDE Karras", "Euler", "Euler a", "DDIM"];

const aspectRatios = {
    "1:1": [1024, 1024],
    "16:9": [1152, 896],
    "9:16": [896, 1152],
    "3:2": [1216, 832],
    "2:3": [832, 1216],
    "5:3": [1344, 768],
    "3:5": [768, 1344],
    "8:5": [1536, 640],
    "5:8": [640, 1536]
};

async function generateImage(prompt, options) {
    const sessionHash = Math.random().toString(36).substring(2);
    const randomDigit = Math.floor(Math.random() * 100000);

    const response = await fetch("https://cagliostrolab-animagine-xl-3-1.hf.space/queue/join?", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: [
                prompt, `(rating_explicit:1.2), ${options.negativePrompt || ""}`, randomDigit, options.width || 1024, options.height || 1024, options.guidanceScale || 4, options.steps || 35, options.sampler || "DPM++ 2M SDE Karras", `${options.width || 1024} x ${options.height || 1024}`, options.stylePreset || "(None)", options.qualityTagPreset || "Standard v3.1", options.useUpscaler || false, 0.55, 1.5, true
            ],
            event_data: null,
            fn_index: 5,
            trigger_id: 49,
            session_hash: sessionHash,
        }),
    });

    const newurl = `https://cagliostrolab-animagine-xl-3-1.hf.space/queue/data?session_hash=${sessionHash}`;
    const data = await getWithProxy(newurl);
    let res = JSON.parse(data.split('\n\n')[data.split('\n\n').length - 2].replace('data: ', ''));
    return res.output.data[0][0].image.url;
}

function parseOptions(args) {
    let options = {};
    args.forEach((arg, index) => {
        if (arg.startsWith("--ar")) {
            const ratio = args[index + 1];
            if (aspectRatios[ratio]) {
                [options.width, options.height] = aspectRatios[ratio];
            }
        } else if (arg.startsWith("--re")) {
            const styleIndex = Number(args[index + 1]);
            if (styleIndex > 0 && styleIndex <= stylePresets.length) {
                options.stylePreset = stylePresets[styleIndex - 1];
            }
        } else if (arg.startsWith("--negative")) {
            options.negativePrompt = args[index + 1];
        } else if (arg.startsWith("--sampler")) {
            options.sampler = args[index + 1];
        } else if (arg.startsWith("--scale")) {
            options.guidanceScale = Number(args[index + 1]);
        } else if (arg.startsWith("--steps")) {
            options.steps = Number(args[index + 1]);
        } else if (arg.startsWith("--m")) {
            const qualityIndex = Number(args[index + 1]);
            if (qualityIndex > 0 && qualityIndex <= qualityTagsPresets.length) {
                options.qualityTagPreset = qualityTagsPresets[qualityIndex - 1];
            }
        } else if (arg.startsWith("--seed")) {
            options.seed = Number(args[index + 1]);
            options.randomSeed = false;
        } else if (arg.startsWith("--sm")) {
            const samplerIndex = Number(args[index + 1]);
            if (samplerIndex > 0 && samplerIndex <= samplers.length) {
                options.sampler = samplers[samplerIndex - 1];
            }
        }
    });
    return options;
}

module.exports = {
    config: {
        name: "sora",
        aliases: ["sorax"],
        version: "1.0",
        author: "Marrcus",
        countDown: 5,
        role: 0,
        longDescription: "Text to Image",
        category: "ai",
        guide: {
            en: "{pn} prompt [--ar ratio] [--re style] [--negative negativePrompt] [--sampler sampler] [--scale guidanceScale] [--steps steps] [--m preset] [--seed seed] [--sm sampler]"
        }
    },

    onStart: async function({ api, args, message, event }) {
        try {
            let prompt = args.filter(arg => !arg.startsWith("--")).join(" ");
            let options = parseOptions(args);

            const processingMessage = await message.reply("Please wait...⏳");
            message.reaction("⏳", event.messageID);

            const imageUrl = await generateImage(prompt, options);
            await message.reply({
                body: `✅ Image Generated`,
                attachment: await getStreamFromURL(imageUrl)
            });

            message.unsend(processingMessage.messageID);
            await message.reaction("✅", event.messageID);
        } catch (error) {
            console.error(error);
            message.reply("An error occurred.");
            message.reaction("❌", event.messageID);
        }
    }
};