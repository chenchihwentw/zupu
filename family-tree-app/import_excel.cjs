const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const OpenCC = require('opencc-js');

const filePath = 'f:\\proj\\zupu\\祖谱(6).xls';
const dbPath = './family.db';

// Initialize OpenCC
const converterT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });
const converterS2T = OpenCC.Converter({ from: 'cn', to: 'tw' });

const db = new sqlite3.Database(dbPath);

console.log(`Reading file: ${filePath}`);
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet);

console.log(`Found ${jsonData.length} rows.`);

const members = new Map(); // ID -> Member
const nameToId = new Map(); // Name -> ID (Simplified)

// Helper to parse year
const parseYear = (val) => {
    if (!val) return null;
    const str = String(val);
    const match = str.match(/\d{4}/);
    return match ? parseInt(match[0]) : null;
};

// Helper to infer gender
const inferGender = (row) => {
    const title = row['称谓'] || '';
    const genTitle = row['辈称'] || '';

    if (title.includes('父') || title.includes('夫') || title.includes('子') || title.includes('孙')) return 'male';
    if (title.includes('母') || title.includes('妻') || title.includes('女')) return 'female';

    if (genTitle === '父' || genTitle === '子') return 'male';
    if (genTitle === '母' || genTitle === '妻' || genTitle === '女') return 'female';

    return 'male'; // Default
};

// Pass 1: Create Members
jsonData.forEach(row => {
    const id = row['item'];
    if (!id) return;

    const name = row['姓名'] || 'Unknown';
    const gender = inferGender(row);
    const birthYear = parseYear(row['出生年月']);
    const isDeceased = row['去世年月'] ? 1 : 0;
    const address = row['通讯地址'] || '';
    const remark = row['备注'] || '';
    const phone = row['电话'] || '';

    const member = {
        id,
        name,
        gender,
        spouses: [],
        children: [],
        parents: [],
        birth_year: birthYear,
        is_deceased: isDeceased,
        phone,
        address,
        remark,
        raw_father_name: row['父辈'], // For linking later
        raw_title: row['称谓'] // For linking spouses
    };

    members.set(id, member);
    // Store Simplified name for robust linking
    nameToId.set(converterT2S(name), id);
    // Also store original just in case
    nameToId.set(name, id);
});

// Pass 2: Link Parents
members.forEach(member => {
    if (member.raw_father_name) {
        // Normalize father name to Simplified
        const fatherNameSimp = converterT2S(member.raw_father_name);
        const fatherId = nameToId.get(fatherNameSimp);

        if (fatherId) {
            member.parents.push(fatherId);
            const father = members.get(fatherId);
            if (father) {
                father.children.push(member.id);
            }
        } else {
            // Try original
            const fatherIdOrig = nameToId.get(member.raw_father_name);
            if (fatherIdOrig) {
                member.parents.push(fatherIdOrig);
                const father = members.get(fatherIdOrig);
                if (father) {
                    father.children.push(member.id);
                }
            } else {
                console.warn(`Warning: Father '${member.raw_father_name}' not found for ${member.name} (${member.id})`);
            }
        }
    }
});

// Pass 3: Link Spouses
members.forEach(member => {
    const title = member.raw_title || '';
    if (title.includes('之妻')) {
        const husbandName = title.split('之妻')[0];
        const husbandNameSimp = converterT2S(husbandName);

        let husbandId = nameToId.get(husbandNameSimp) || nameToId.get(husbandName);

        if (husbandId) {
            member.spouses.push(husbandId);
            const husband = members.get(husbandId);
            if (husband) {
                if (!husband.spouses.includes(member.id)) {
                    husband.spouses.push(member.id);
                }
            }
        }
    } else if (title.includes('之夫')) {
        const wifeName = title.split('之夫')[0];
        const wifeNameSimp = converterT2S(wifeName);

        let wifeId = nameToId.get(wifeNameSimp) || nameToId.get(wifeName);

        if (wifeId) {
            member.spouses.push(wifeId);
            const wife = members.get(wifeId);
            if (wife) {
                if (!wife.spouses.includes(member.id)) {
                    wife.spouses.push(member.id);
                }
            }
        }
    }
});

// Initialize DB and Insert
db.serialize(() => {
    // Create Table if not exists (Ensure schema matches server.cjs)
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT,
      gender TEXT,
      spouses TEXT,
      children TEXT,
      parents TEXT,
      birth_year INTEGER,
      is_deceased INTEGER,
      phone TEXT,
      address TEXT,
      remark TEXT
    )`);

    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("INSERT OR REPLACE INTO members (id, name, gender, spouses, children, parents, birth_year, is_deceased, phone, address, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    members.forEach(member => {
        stmt.run(
            member.id,
            member.name,
            member.gender,
            JSON.stringify(member.spouses),
            JSON.stringify(member.children),
            JSON.stringify(member.parents),
            member.birth_year,
            member.is_deceased,
            member.phone,
            member.address,
            member.remark
        );
    });

    stmt.finalize();
    db.run("COMMIT", (err) => {
        if (err) {
            console.error("Import failed:", err);
        } else {
            console.log("Import successful!");
        }
        db.close();
    });
});
