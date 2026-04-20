const https = require('https');
const fs = require('fs');
const path = require('path');

const ASSETS = [
    {
        name: 'traditional.mp3',
        url: 'https://opengameart.org/sites/default/files/bell3_0.mp3'
    },
    {
        name: 'christian.mp3',
        url: 'https://opengameart.org/sites/default/files/Sad%20Piano_3.mp3'
    },
    {
        name: 'modern.mp3',
        url: 'https://opengameart.org/sites/default/files/RPG%20Ambient%204%20%28The%20Dark%20Wood%29.mp3'
    }
];

const targetDir = path.join(__dirname, '..', 'public', 'audio');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Created directory: ${targetDir}`);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            // Handle redirects (e.g., 301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(res.statusCode)) {
                console.log(`Following redirect for ${path.basename(dest)}...`);
                downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Successfully downloaded: ${path.basename(dest)}`);
                resolve();
            });
        }).on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        });
    });
}

async function run() {
    console.log('Starting audio assets localization task...');
    for (const asset of ASSETS) {
        try {
            const dest = path.join(targetDir, asset.name);
            console.log(`Downloading ${asset.name} from: ${asset.url}`);
            await downloadFile(asset.url, dest);
        } catch (err) {
            console.error(`Error downloading ${asset.name}:`, err.message);
        }
    }
    console.log('-----------------------------------');
    console.log('Audio localization completed.');
    console.log('Files stored in: public/audio/');
}

run();
