const puppeteer = require('puppeteer');
const solver = require('2captcha');
const totp = require('totp-generator');

// Your API Key from the 2Captcha service
const apiKey = '50addf6f687785c2ee3403fa414f5fb1'; // Replace with your actual API Key

// CAPTCHA decoding function from URL
async function solveCaptcha(page) {
    try {
        // Get CAPTCHA image URL from page
        const captchaImage = await page.$('img[src*="captcha"]');
        if (!captchaImage) throw new Error("Captcha image not found!");

        // Get the URL of the CAPTCHA
        const imageUrl = await page.evaluate(captchaImage => captchaImage.src, captchaImage);
        console.log("Captcha URL:", imageUrl);

        // Submit CAPTCHA to solve via 2Captcha
        const solverInstance = new solver.TwoCaptcha(apiKey);
        const result = await solverInstance.normal({ body: imageUrl });

        // Returns the solved CAPTCHA code
        return result.text;
    } catch (error) {
        console.error('Error occurred while solving captcha:', error.message);
        throw error;
    }
}

// Function to log in to Facebook and pass CAPTCHA if available
async function loginMbasic({ email, pass, twoFactorSecretOrCode, userAgent, proxy, maxTry = 3, currentTry = 0 }) {
    const browser = await puppeteer.launch({
        headless: false, // To see the browser
        args: proxy ? [`--proxy-server=${proxy}`] : []
    });

    const page = await browser.newPage();
    if (userAgent) {
        await page.setUserAgent(userAgent);
    }

    await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle2'
    });

    // Fill in login information
    await page.type('input[name="email"]', email);
    await page.type('input[name="pass"]', pass);

    // Click the login button
    const loginButton = await page.$('button[name="login"]') || await page.$('button[data-testid="royal_login_button"]');
    if (!loginButton) {
        const error = new Error("No login button found on the page");
        await browser.close();
        throw error;
    }

    // Submit login form
    await Promise.all([
        page.click('button[name="login"]') || page.click('button[data-testid="royal_login_button"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // Check if CAPTCHA appears
    const captchaImage = await page.$('img[src*="captcha"]');
    if (captchaImage) {
        // Get and solve the CAPTCHA
        const captchaSolution = await solveCaptcha(page);

        // Enter the CAPTCHA code into the form
        await page.type('input[name="captcha_response"]', captchaSolution);

        // Submit CAPTCHA
        await page.click('button[name="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Check if the CAPTCHA fails
        const captchaFailed = await page.$('div._9ay7');
        if (captchaFailed) {
            await browser.close();
            throw new Error("Failed to solve captcha, unable to proceed.");
        }
    }

    // Check if the login fails
    const loginFailed = await page.$("div._9ay7");
    if (loginFailed) {
        await browser.close();
        throw new Error("Password is incorrect");
    }

    // Check if 2FA verification code is needed
    const twoFactorForm = await page.$('input[name="approvals_code"]');
    if (twoFactorForm) {
        let otpCode;
        if (twoFactorSecretOrCode.length >= 32) {
            twoFactorSecretOrCode = twoFactorSecretOrCode.replace(/\s/g, '');
            otpCode = totp(twoFactorSecretOrCode);
        } else {
            otpCode = twoFactorSecretOrCode;
        }

        await page.type('input[name="approvals_code"]', otpCode);

        // Submit 2FA code
        await Promise.all([
            page.click('button[name="submit[Submit Code]"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
    }

    // Check if account verification is required (checkpoint).
    const checkpoint = await page.$("form[action*='checkpoint']");
    if (checkpoint) {
        await browser.close();
        throw new Error("Your account is locked, please verify your identity");
    }

    // Get cookies after successful login
    const cookies = await page.cookies();
    await browser.close();

    return cookies.map(cookie => ({
        name: cookies.name,
        value: cookie.value,
        domain: cookies.domain,
        path: cookies.path,
        hostOnly: cookies.hostOnly,
        creation: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
    }));
}

// Export the loginMbasic function so it can be reused
module.exports = loginMbasic;


// auto login code via puppeteer
// the above is just a demo
// if you want to code more, start from it