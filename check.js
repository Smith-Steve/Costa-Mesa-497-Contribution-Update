const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');

const FORM_497_LABEL = /Contribution Report\s*\(Form 497\)/i;

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('Missing config.json. Copy config.example.json to config.json and fill in your values.');
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

function normalize(text) {
    return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

// Each candidate is a <tr> with name/district in the first two <td>s and a
// series of <p>label</p><ul><li><a>...</a></li></ul> blocks in the third,
// one per disclosure form type. This pulls out just the Form 497 block.
function extractForm497ByCandidate(html) {
    const $ = cheerio.load(html);
    const candidates = [];

    $('tr').each((_, row) => {
        const cells = $(row).find('> td');
        if (cells.length < 3) return;

        const candidateName = normalize($(cells[0]).text());
        const district = normalize($(cells[1]).text());
        if (!candidateName) return;

        let form497Items = null;
        $(cells[2]).find('p').each((_, p) => {
            const label = normalize($(p).text());
            if (FORM_497_LABEL.test(label)) {
                const next = $(p).next();
                form497Items = next.is('ul')
                    ? next.find('li').map((_, li) => normalize($(li).text())).get()
                    : [];
            }
        });

        if (form497Items !== null) {
            candidates.push({ key: `${candidateName} (${district})`, candidateName, district, form497Items });
        }
    });

    return candidates;
}

function hashItems(items) {
    return crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
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

async function notifySafe(config, subject, message, timestamp) {
    try {
        await notify(config, subject, message);
    } catch (err) {
        console.error(`[${timestamp}] Notification failed:`, err.message);
    }
}

async function main() {
    const config = loadConfig();
    const timestamp = new Date().toISOString();

    let html;
    try {
        html = await fetchPage(config.pageUrl);
    } catch (err) {
        console.error(`[${timestamp}] Fetch failed:`, err.message);
        await notifySafe(
            config,
            'Costa Mesa 497 monitor: scan failed',
            `Scan failed at ${timestamp}: ${err.message}`,
            timestamp
        );
        process.exitCode = 1;
        return;
    }

    const candidates = extractForm497ByCandidate(html);

    if (candidates.length === 0) {
        console.error(`[${timestamp}] No candidate rows found - the page structure may have changed.`);
        await notifySafe(
            config,
            'Costa Mesa 497 monitor: scan failed',
            `Scan completed at ${timestamp} but found 0 candidate rows - the page structure may have changed.`,
            timestamp
        );
        process.exitCode = 1;
        return;
    }

    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(SNAPSHOT_DIR, `${timestamp.replace(/[:.]/g, '-')}.json`),
        JSON.stringify(candidates, null, 2)
    );

    const currentHashes = {};
    for (const candidate of candidates) {
        currentHashes[candidate.key] = hashItems(candidate.form497Items);
    }

    const previousState = loadState();

    if (!previousState || !previousState.hashes) {
        saveState({ hashes: currentHashes, lastChecked: timestamp, lastChanged: null });
        console.log(`[${timestamp}] Baseline saved for ${candidates.length} candidates. No change notification sent.`);
        await notifySafe(
            config,
            'Costa Mesa 497 monitor: scan complete',
            `Scan completed at ${timestamp}. Baseline established for ${candidates.length} candidates.`,
            timestamp
        );
        return;
    }

    const changedCandidates = candidates.filter(
        (candidate) => previousState.hashes[candidate.key] !== currentHashes[candidate.key]
    );

    if (changedCandidates.length === 0) {
        saveState({ ...previousState, hashes: currentHashes, lastChecked: timestamp });
        console.log(`[${timestamp}] No Form 497 changes detected.`);
        await notifySafe(
            config,
            'Costa Mesa 497 monitor: scan complete',
            `Scan completed at ${timestamp}. No Form 497 changes detected across ${candidates.length} candidates.`,
            timestamp
        );
        return;
    }

    const names = changedCandidates.map((c) => c.candidateName).join(', ');
    console.log(`[${timestamp}] Form 497 change detected for: ${names}`);

    const lines = changedCandidates.map((c) => `Candidate ${c.candidateName} has had a 497 Contribution.`);
    const changeMessage = `${lines.join('\n')}\n\n${config.pageUrl}`;

    await notifySafe(config, 'Costa Mesa Form 497 update', changeMessage, timestamp);

    saveState({ hashes: currentHashes, lastChecked: timestamp, lastChanged: timestamp });
}

main();
