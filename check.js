const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');

const FALLBACK_SELECTORS = ['main', '#main-content', '.main-content', '.field--name-body', 'article', 'body'];

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Missing config.json. Copy config.example.json to config.json and fill in your values.`);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadState() {
    if (!fs.existsSync(STATE_PATH)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function extractText(html, preferredSelector) {
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer').remove();

    const selectors = [preferredSelector, ...FALLBACK_SELECTORS].filter(Boolean);
    for (const selector of selectors) {
        const el = $(selector).first();
        if (el.length && el.text().trim().length > 0) {
            return el.text().replace(/\s+/g, ' ').trim();
        }
    }
    return $.text().replace(/\s+/g, ' ').trim();
}

function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
    }
    return response.text();
}

async function notify(config, subject, message) {
    const sns = new SNSClient({ region: config.awsRegion });
    await sns.send(new PublishCommand({
        TopicArn: config.snsTopicArn,
        Subject: subject.slice(0, 100),
        Message: message
    }));
}

async function main() {
    const config = loadConfig();
    const timestamp = new Date().toISOString();

    let html;
    try {
        html = await fetchPage(config.pageUrl);
    } catch (err) {
        console.error(`[${timestamp}] Fetch failed:`, err.message);
        process.exitCode = 1;
        return;
    }

    const text = extractText(html, config.contentSelector);
    const hash = hashText(text);

    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const snapshotFile = path.join(SNAPSHOT_DIR, `${timestamp.replace(/[:.]/g, '-')}.txt`);
    fs.writeFileSync(snapshotFile, text);

    const previousState = loadState();

    if (!previousState) {
        saveState({ hash, lastChecked: timestamp, lastChanged: null });
        console.log(`[${timestamp}] Baseline saved. No notification sent.`);
        return;
    }

    if (previousState.hash === hash) {
        saveState({ ...previousState, lastChecked: timestamp });
        console.log(`[${timestamp}] No change detected.`);
        return;
    }

    console.log(`[${timestamp}] Change detected. Sending notification.`);
    try {
        await notify(
            config,
            'Costa Mesa 2026 disclosure statements page changed',
            `The Costa Mesa 2026 disclosure statements page appears to have changed.\n\n${config.pageUrl}\n\nDetected: ${timestamp}`
        );
    } catch (err) {
        console.error(`[${timestamp}] Notification failed:`, err.message);
    }

    saveState({ hash, lastChecked: timestamp, lastChanged: timestamp });
}

main();
