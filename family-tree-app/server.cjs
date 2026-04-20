const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const OpenCC = require('opencc-js');
const multer = require('multer');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, /\.railway\.app$/] 
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS requests for all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Preflight request:', req.method, req.path);
    return res.sendStatus(204);
  }
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path}`);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 📝 全局診斷日誌重定向 (修復 500 報錯用)
const ERROR_LOG_PATH = path.join(__dirname, 'error_log.txt');
function logFatalError(type, err) {
    const timestamp = new Date().toISOString();
    const errorMsg = `[${timestamp}] ${type}: ${err.stack || err}\n`;
    fs.appendFileSync(ERROR_LOG_PATH, errorMsg);
    console.error(errorMsg);
}

process.on('uncaughtException', (err) => logFatalError('UNCAUGHT_EXCEPTION', err));
process.on('unhandledRejection', (reason) => logFatalError('UNHANDLED_REJECTION', reason));

// Serve static files - Support both local and Railway deployment
const staticPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve Vite built files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(staticPath));
}

// Initialize OpenCC converters
const converterS2T = OpenCC.Converter({ from: 'cn', to: 'tw' });
const converterT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'zupu_family_tree_secret_key_2026_change_in_production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// JWT Middleware - Authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Optional Authentication - doesn't fail if no token
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
}

// 🛡️ Helper to prevent double JSON stringification
function smartStringify(data) {
    if (data === null || data === undefined) return null;
    
    // 如果已經是字符串，檢查是否已經是 JSON 格式
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            return data;
        }
        return JSON.stringify(data);
    }
    
    // 如果是數組或對象，檢查內容是否包含被雙重編碼的字符串
    if (Array.isArray(data)) {
        const cleaned = data.map(item => {
            if (typeof item === 'string' && item.startsWith('[') && item.endsWith(']')) {
                try { return JSON.parse(item); } catch (e) { return item; }
            }
            return item;
        }).flat(); // 如果解析出來是數組，則打平 (可選，根據業務邏輯)
        return JSON.stringify(cleaned);
    }

    return JSON.stringify(data);
}

// File upload configuration - Support for Railway Volume
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/app/data/uploads'
  : './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ========== 權限控制輔助函數 ==========

// 計算用戶對某成員的權限等級
function calculatePermissionLevel(viewerId, targetMember) {
    // L4 - 管理員：系統預設或特殊授權
    if (viewerId === 'admin') return 'L4';
    
    // 匿名用戶 - L1 公開權限
    if (!viewerId || viewerId === 'anonymous') return 'L1';
    
    // TODO: 從數據庫查詢實際權限
    // 這裡先實現簡單的邏輯：
    // - 如果是同一個 family_tree_id，給 L2
    // - 如果是直系親屬或配偶，給 L3
    
    const viewerFamilyTreeId = getViewerFamilyTreeId(viewerId); // TODO: 實作此函數
    
    if (viewerFamilyTreeId === targetMember.family_tree_id) {
        return 'L2'; // 同族人
    }
    
    // TODO: 檢查婚姻關係（跨家族）
    if (isSpouseOrDirectRelative(viewerId, targetMember.id)) {
        return 'L3'; // 至親
    }
    
    return 'L1'; // 公開
}

// 開發階段：臨時授予所有用戶 L3 權限（可以編輯）
function getDevelopmentPermissionLevel() {
    // TODO: 上線前刪除此函數，使用真實權限驗證
    return 'L3';
}

// 根據權限等級過濾字段
function filterFieldsByPermission(member, permissionLevel) {
    const defaultPrivacy = {
        name: 'public',
        gender: 'public',
        birth_year: 'public',
        avatar_url: 'public',
        phone: 'family',
        email: 'family',
        address: 'family',
        birth_date: 'family',
        biography_md: 'public',
        education: 'family',
        occupation: 'family'
    };
    
    // 解析成員的隱私設定
    let privacySettings = {};
    try {
        privacySettings = JSON.parse(member.privacy_settings || '{}');
    } catch (e) {
        privacySettings = defaultPrivacy;
    }
    
    // 構建過濾後的成員對象
    const filtered = {
        id: member.id,
        name: member.name,
        gender: member.gender,
        avatar_url: member.avatar_url,
        family_tree_id: member.family_tree_id
    };
    
    // L1 - 公開權限：只能看 public 字段
    if (permissionLevel === 'L1') {
        if (privacySettings.name !== 'public') filtered.name = '[隱藏]';
        if (privacySettings.gender !== 'public') delete filtered.gender;
        if (privacySettings.birth_year !== 'public') delete filtered.birth_year;
        if (privacySettings.avatar_url !== 'public') delete filtered.avatar_url;
        
        // 事蹟預設公開
        if (member.biography_md) filtered.biography_md = member.biography_md;
    }
    
    // L2 - 族人權限：可以看到 family 級別
    if (permissionLevel === 'L2') {
        Object.assign(filtered, {
            phone: member.phone,
            email: member.email,
            address: member.address,
            birth_date: member.birth_date,
            birth_year: member.birth_year,
            birth_month: member.birth_month,
            birth_day: member.birth_day,
            biography_md: member.biography_md,
            education: member.education,
            occupation: member.occupation
        });
    }
    
    // L3/L4 - 至親/管理員：所有字段
    if (permissionLevel === 'L3' || permissionLevel === 'L4') {
        Object.assign(filtered, member);
        // 解析 JSON 字段
        filtered.spouses = JSON.parse(member.spouses || '[]');
        filtered.children = JSON.parse(member.children || '[]');
        filtered.parents = JSON.parse(member.parents || '[]');
        filtered.families = JSON.parse(member.families || '[]');
    }
    
    return filtered;
}

// TODO: 實作這些輔助函數
function getViewerFamilyTreeId(viewerId) {
    // 從數據庫查詢用戶所屬的 family tree
    return null;
}

function isSpouseOrDirectRelative(viewerId, targetMemberId) {
    // 檢查是否為配偶或直系親屬
    return false;
}

// ========== API Endpoints ==========

// Database setup
// Support both local development and Railway deployment with Volume
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/app/data/family.db' 
  : './family.db';

// Ensure directory exists for production
if (process.env.NODE_ENV === 'production') {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create members table with enhanced structure
        db.run(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      family_tree_id TEXT,
      name TEXT,
      surname TEXT,            -- 姓
      given_name TEXT,         -- 名
      gender TEXT,
      spouses TEXT,
      children TEXT,
      parents TEXT,
      birth_date TEXT,        -- 完整出生日期 (YYYY-MM-DD)
      birth_year INTEGER,     -- 出生年份
      birth_month INTEGER,    -- 出生月份
      birth_day INTEGER,      -- 出生日期
      birth_calendar TEXT,    -- 出生日期历法 (gregorian/lunar)
      death_date TEXT,        -- 完整死亡日期 (YYYY-MM-DD)
      death_year INTEGER,     -- 死亡年份
      death_month INTEGER,    -- 死亡月份
      death_day INTEGER,      -- 死亡日期
      death_calendar TEXT,    -- 死亡日期历法 (gregorian/lunar)
      is_deceased INTEGER,
      phone TEXT,
      email TEXT,             -- 電子郵箱（用於登入）
      address TEXT,
      remark TEXT,
      generation INTEGER,      -- 世代
      clan_name TEXT,          -- 堂号
      ancestral_home TEXT,     -- 地望（祖籍）
      courtesy_name TEXT,      -- 字
      pseudonym TEXT,          -- 号
      aliases TEXT,            -- 曾用名（JSON 格式）
      education TEXT,          -- 教育背景
      occupation TEXT,         -- 职业
      achievements TEXT,       -- 成就（JSON 格式）
      biography TEXT,          -- 傳記
      biography_md TEXT,       -- 事蹟（Markdown 格式）
      biography_html TEXT,     -- 事蹟（HTML 格式）
      biography_tags TEXT,     -- 事蹟標籤（JSON 格式）
      has_biography INTEGER DEFAULT 0,  -- 是否有事蹟
      avatar_url TEXT,         -- 頭像照片 URL
      privacy_settings TEXT,   -- 隱私設定（JSON 格式）
      user_id TEXT,            -- 關聯的用戶 ID（用於登入系統）
      is_deleted INTEGER DEFAULT 0, -- 軟刪除標記
      deleted_at TEXT,         -- 刪除時間
      primaryFamily TEXT,      -- 主家族 ID
      families TEXT            -- 所屬家族列表 (JSON)
    )`, (err) => {
            if (err) {
                console.error('Error creating members table', err.message);
            } else {
                // Add missing columns if they don't exist
                const alterStatements = [
                    `ALTER TABLE members ADD COLUMN biography_html TEXT`,
                    `ALTER TABLE members ADD COLUMN biography_tags TEXT`,
                    `ALTER TABLE members ADD COLUMN has_biography INTEGER DEFAULT 0`,
                    `ALTER TABLE members ADD COLUMN user_id TEXT`,
                    `ALTER TABLE members ADD COLUMN is_deleted INTEGER DEFAULT 0`,
                    `ALTER TABLE members ADD COLUMN deleted_at TEXT`,
                    `ALTER TABLE members ADD COLUMN primaryFamily TEXT`,
                    `ALTER TABLE members ADD COLUMN families TEXT`,
                    `ALTER TABLE members ADD COLUMN surname TEXT`,
                    `ALTER TABLE members ADD COLUMN given_name TEXT`
                ];
                
                alterStatements.forEach(sql => {
                    db.run(sql, (err) => {
                        if (err && !err.message.includes('duplicate column')) {
                            console.error('Error adding column:', err.message);
                        }
                    });
                });
            }
        });

        // Create family_trees table
        db.run(`CREATE TABLE IF NOT EXISTS family_trees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_public INTEGER DEFAULT 0,
      password TEXT,
      cover_image TEXT,
      invite_code TEXT,
      invite_code_expires_at TEXT,
      surname TEXT,
      hall_name TEXT,
      ancestral_home TEXT,
      storage_limit_mb INTEGER DEFAULT 200 -- 家族總配額
    )`, (err) => {
            if (err) {
                console.error('Error creating family_trees table', err.message);
            } else {
                // 加固字段遷移
                const treeAlters = [
                    `ALTER TABLE family_trees ADD COLUMN invite_code TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN invite_code_expires_at TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN surname TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN hall_name TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN ancestral_home TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN storage_limit_mb INTEGER DEFAULT 200`
                ];
                treeAlters.forEach(sql => {
                    db.run(sql, (err) => {
                        if (err && !err.message.includes('duplicate column')) {
                            console.error('[SCHEMA] Update trees error:', err.message);
                        }
                    });
                });
            }
        });

        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      phone TEXT,
      avatar TEXT,
      created_at TEXT,
      last_login TEXT,
      is_active INTEGER DEFAULT 1,
      invited_by TEXT,
      invite_code_used TEXT,
      member_level TEXT DEFAULT 'Basic',
      storage_limit_mb INTEGER DEFAULT 500,
      fair_use_limit_mb INTEGER DEFAULT 50,
      used_storage_kb INTEGER DEFAULT 0
    )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                // 加固 users 表欄位
                const userAlters = [
                    `ALTER TABLE users ADD COLUMN member_level TEXT DEFAULT 'Basic'`,
                    `ALTER TABLE users ADD COLUMN storage_limit_mb INTEGER DEFAULT 500`,
                    `ALTER TABLE users ADD COLUMN fair_use_limit_mb INTEGER DEFAULT 50`,
                    `ALTER TABLE users ADD COLUMN used_storage_kb INTEGER DEFAULT 0`
                ];
                userAlters.forEach(sql => {
                    db.run(sql, (err) => {
                        if (err && !err.message.includes('duplicate column')) {
                            console.error('[SCHEMA] Update users error:', err.message);
                        }
                    });
                });
            }
        });

        // Create user_family_trees table
        db.run(`CREATE TABLE IF NOT EXISTS user_family_trees (
      user_id TEXT,
      family_tree_id TEXT,
      role TEXT,
      joined_at TEXT,
      PRIMARY KEY (user_id, family_tree_id)
    )`, (err) => {
            if (err) {
                console.error('Error creating user_family_trees table:', err.message);
            }
        });

        // Create invitations table
        db.run(`CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      invite_code TEXT UNIQUE NOT NULL,
      creator_id TEXT NOT NULL, -- 創建者（管理員）
      family_tree_id TEXT NOT NULL,
      target_member_id TEXT,    -- 綁定的成員 ID
      default_role TEXT DEFAULT 'user',
      max_uses INTEGER DEFAULT NULL, -- 最大使用次數
      used_count INTEGER DEFAULT 0, -- 已使用次數
      expires_at TEXT, -- 過期時間
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )`, (err) => {
            if (err) {
                console.error('Error creating user_family_trees table', err.message);
            }
        });

        // Create marriages table
        db.run(`CREATE TABLE IF NOT EXISTS marriages (
      id TEXT PRIMARY KEY,
      husband_id TEXT,
      wife_id TEXT,
      marriage_date TEXT,
      marriage_year INTEGER,
      marriage_month INTEGER,
      marriage_day INTEGER,
      marriage_calendar TEXT,
      divorce_date TEXT,
      is_divorced INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (husband_id) REFERENCES members(id),
      FOREIGN KEY (wife_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating marriages table', err.message);
            }
        });

        // Create adoptions table
        db.run(`CREATE TABLE IF NOT EXISTS adoptions (
      id TEXT PRIMARY KEY,
      child_id TEXT,
      adoptive_parent_id TEXT,
      adoption_date TEXT,
      adoption_type TEXT,
      notes TEXT,
      FOREIGN KEY (child_id) REFERENCES members(id),
      FOREIGN KEY (adoptive_parent_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating adoptions table', err.message);
            }
        });

        // Create media table
        db.run(`CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      family_tree_id TEXT,
      file_path TEXT,
      media_type TEXT,
      title TEXT,
      description TEXT,
      photo_date TEXT,
      upload_date TEXT,
      uploaded_by TEXT,
      metadata TEXT,
      is_featured INTEGER DEFAULT 0,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (family_tree_id) REFERENCES family_trees(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating media table', err.message);
            }
        });

        // Create face_embeddings table
        db.run(`CREATE TABLE IF NOT EXISTS face_embeddings (
      id TEXT PRIMARY KEY,
      media_id TEXT,
      member_id TEXT,
      embedding_data TEXT,
      bounding_box TEXT,
      confidence REAL,
      created_at TEXT,
      FOREIGN KEY (media_id) REFERENCES media(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating face_embeddings table', err.message);
            }
        });

        // ✨ [MIGRATION V2] 強力 Node.js 級別修補 (解決 SQL json_extract 兼容性問題)
        db.all("SELECT id, metadata FROM media WHERE photo_date IS NULL OR photo_date = ''", (err, rows) => {
            if (err) return;
            rows.forEach(row => {
                try {
                    const meta = JSON.parse(row.metadata || '{}');
                    if (meta.photo_date) {
                        db.run("UPDATE media SET photo_date = ? WHERE id = ?", [meta.photo_date, row.id]);
                        console.log(`[Migration] Fixed missing date for ${row.id}: ${meta.photo_date}`);
                    }
                } catch(e) {}
            });
        });

        // Create biographies table
        // First drop old table if exists (to fix schema issues)
        db.run(`DROP TABLE IF EXISTS biographies`, (err) => {
            if (err) {
                console.error('Error dropping old biographies table:', err.message);
            }
        });
        
        db.run(`CREATE TABLE IF NOT EXISTS biographies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT,
      version INTEGER DEFAULT 1,
      content_md TEXT,
      content_html TEXT,
      tags TEXT,
      images TEXT,
      edited_by TEXT,
      is_current INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating biographies table', err.message);
            } else {
                console.log('Biographies table created or already exists');
            }
        });

        // ✨ [STORAGE RECONCILIATION] 啟動時存儲自動對帳
        db.all(`
            SELECT uploaded_by, SUM(CAST(json_extract(metadata, '$.size') AS INTEGER)) as total_size 
            FROM media 
            GROUP BY uploaded_by
        `, (err, rows) => {
            if (err) {
                console.error('[STORAGE] Reconciliation failed to query:', err.message);
                return;
            }
            console.log(`[STORAGE] Starting reconciliation for ${rows.length} users...`);
            rows.forEach(row => {
                if (!row.uploaded_by || row.uploaded_by === 'anonymous') return;
                const sizeKb = Math.ceil((row.total_size || 0) / 1024);
                db.run(`UPDATE users SET used_storage_kb = ? WHERE id = ?`, [sizeKb, row.uploaded_by]);
            });
            console.log('[STORAGE] Reconciliation completed.');
        });
        
        // Create family_documents table
        db.run(`CREATE TABLE IF NOT EXISTS family_documents (
      id TEXT PRIMARY KEY,
      family_tree_id TEXT,
      title TEXT,
      content TEXT,
      document_type TEXT,
      author TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (family_tree_id) REFERENCES family_trees(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating family_documents table', err.message);
            }
        });

        // Create family_circle_posts table
        db.run(`CREATE TABLE IF NOT EXISTS family_circle_posts (
      id TEXT PRIMARY KEY,
      family_tree_id TEXT,
      author_id TEXT,
      content TEXT,
      media_ids TEXT,
      created_at TEXT,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      FOREIGN KEY (family_tree_id) REFERENCES family_trees(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating family_circle_posts table', err.message);
            }
        });

        // Create family_circle_comments table
        db.run(`CREATE TABLE IF NOT EXISTS family_circle_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      author_id TEXT,
      content TEXT,
      created_at TEXT,
      parent_comment_id TEXT,
      FOREIGN KEY (post_id) REFERENCES family_circle_posts(id),
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (parent_comment_id) REFERENCES family_circle_comments(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating family_circle_comments table', err.message);
            }
        });

        // Create audit_logs table (審計日誌)
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id TEXT,          -- 目標 ID (如 member_id)
      target_type TEXT,        -- 目標類型 (member, reunion, family)
      action TEXT,             -- 操作 (create, update, delete, restore)
      old_values TEXT,         -- 變更前數據 (JSON)
      new_values TEXT,         -- 變更後數據 (JSON)
      changed_fields TEXT,     -- 具體變動的字段 (JSON)
      user_id TEXT,            -- 操作人
      user_name TEXT,          -- 操作人姓名
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
            if (err) {
                console.error('Error creating audit_logs table', err.message);
            }
        });

        // Create change_history table (legacy, matched with new audit style)

        // Create health_records table
        db.run(`CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      height REAL,
      weight REAL,
      blood_type TEXT,
      medical_conditions TEXT,
      allergies TEXT,
      medications TEXT,
      last_checkup_date TEXT,
      doctor TEXT,
      notes TEXT,
      updated_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating health_records table', err.message);
            }
        });

        // Create dna_data table
        db.run(`CREATE TABLE IF NOT EXISTS dna_data (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      dna_provider TEXT,
      ethnic_origin TEXT,
      health_risks TEXT,
      traits TEXT,
      raw_data_path TEXT,
      analysis_date TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating dna_data table', err.message);
            }
        });

        // Create permissions table（權限表）
        db.run(`CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      user_id TEXT,
      permission_level TEXT,  -- L1/L2/L3/L4
      granted_by TEXT,
      granted_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating permissions table', err.message);
            }
        });

        // Create Reunion Posts table
        db.run(`CREATE TABLE IF NOT EXISTS reunion_posts (
          id TEXT PRIMARY KEY,
          title TEXT,
          description TEXT,
          contact TEXT,
          created_at TEXT,
          updated_at TEXT,
          user_id TEXT REFERENCES users(id),
          status TEXT DEFAULT 'searching'
        )`, (err) => {
            if (err) {
                console.error('Error creating reunion table', err.message);
            }
        });

        // Create indexes for better performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id)`, (err) => {
            if (err) console.error('Error creating index:', err.message);
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(invite_code)`, (err) => {
            if (err) console.error('Error creating index:', err.message);
        });

        // Create view for user-member links
        db.run(`CREATE VIEW IF NOT EXISTS user_member_links AS
SELECT 
  u.id as user_id,
  u.email,
  u.full_name as user_name,
  m.id as member_id,
  m.name as member_name,
  m.family_tree_id,
  ufr.role
FROM users u
LEFT JOIN members m ON u.id = m.user_id
LEFT JOIN user_family_trees ufr ON u.id = ufr.user_id
`, (err) => {
            if (err) console.error('Error creating view:', err.message);
        });
    }
});

// API Endpoints

// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: 'connected'
    });
});

// ========== Authentication & Invitation APIs ==========

// Generate Invitation Code (Admin only)
app.post('/api/invite/generate', authenticateToken, async (req, res) => {
    // 兼容前端發送的 memberId 和 role
    const { 
        family_id,
        family_tree_id, 
        target_member_id, 
        memberId, 
        default_role = 'user', 
        role,
        expires_in_days, 
        max_uses 
    } = req.body;
    
    const actualFamilyId = family_id || family_tree_id;
    
    const actualMemberId = target_member_id || memberId;
    const actualRole = role || default_role;
    
    if (!actualMemberId) {
        return res.status(400).json({ error: 'Missing target_member_id' });
    }

    // TODO: Check if user is admin
    const creatorId = req.user.userId;
    
    // Generate unique invite code
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invite_code = `INVITE_${timestamp}_${random}`;
    
    const id = `invite_${timestamp}`;
    const expires_at = expires_in_days 
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;
    
    const sql = `
        INSERT INTO invitations (id, invite_code, creator_id, family_tree_id, target_member_id, default_role, max_uses, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [id, invite_code, creatorId, actualFamilyId, actualMemberId, actualRole, max_uses, expires_at, new Date().toISOString(), new Date().toISOString()], function(err) {
        if (err) {
            console.error('Error creating invitation:', err);
            return res.status(500).json({ error: 'Failed to create invitation' });
        }
        
        res.json({
            success: true,
            invitation: {
                id,
                invite_code,
                invite_url: `${req.protocol}://${req.get('host')}/register?invite=${invite_code}`,
                family_tree_id,
                target_member_id: actualMemberId,
                default_role: actualRole,
                expires_at,
                max_uses
            }
        });
    });
});

// Verify Invitation Code
app.get('/api/invite/verify', (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Invite code required' });
    }
    
    const sql = `
        SELECT i.*, ft.name as family_tree_name 
        FROM invitations i
        LEFT JOIN family_trees ft ON i.family_tree_id = ft.id
        WHERE i.invite_code = ? AND i.is_active = 1
    `;

    db.get(sql, [code], async (err, invitation) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation code' });
        }
        
        // Check if expired
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invitation code has expired' });
        }
        
        // Check if max uses reached
        if (invitation.max_uses && invitation.used_count >= invitation.max_uses) {
            return res.status(400).json({ error: 'Invitation code has reached maximum uses' });
        }
        
        // Get target member info if exists
        let targetMember = null;
        if (invitation.target_member_id) {
            targetMember = await new Promise((resolve, reject) => {
                db.get(`SELECT id, name, family_tree_id FROM members WHERE id = ?`, [invitation.target_member_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        
        res.json({
            valid: true,
            invitation: {
                code: invitation.invite_code,
                family_tree_id: invitation.family_tree_id,
                family_tree_name: invitation.family_tree_name || invitation.family_tree_id,
                default_role: invitation.default_role,
                target_member_id: invitation.target_member_id,
                target_member_name: targetMember?.name || null
            }
        });
    });
});

// Register with Invitation
app.post('/api/auth/register-with-invite', async (req, res) => {
    const { email, password, name, invite_code, memberId, autoLinkMember } = req.body;
    
    // Validate input
    if (!email || !password || !name || !invite_code) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Verify invitation
        const invitation = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM invitations WHERE invite_code = ? AND is_active = 1`, [invite_code], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!invitation) {
            return res.status(400).json({ error: 'Invalid or expired invitation code' });
        }
        
        // Check expiration and usage
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invitation code has expired' });
        }
        
        if (invitation.max_uses && invitation.used_count >= invitation.max_uses) {
            return res.status(400).json({ error: 'Invitation code has reached maximum uses' });
        }
        
        // If invitation has target_member_id, verify name matches
        if (invitation.target_member_id) {
            const targetMember = await new Promise((resolve, reject) => {
                db.get(`SELECT id, name FROM members WHERE id = ?`, [invitation.target_member_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!targetMember) {
                return res.status(400).json({ error: 'Target member not found' });
            }
            
            if (targetMember.name !== name) {
                return res.status(400).json({ 
                    error: `Name does not match. Expected: ${targetMember.name}` 
                });
            }
            
            // Check if this member already has a linked user
            const existingLink = await new Promise((resolve, reject) => {
                db.get(`SELECT user_id FROM members WHERE id = ? AND user_id IS NOT NULL`, [invitation.target_member_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (existingLink) {
                return res.status(400).json({ error: 'This member already has a linked account' });
            }
        }
        
        // Check if email already registered
        const existingUser = await new Promise((resolve, reject) => {
            db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        // Create user
        const userId = `user_${Date.now()}`;
        const passwordHash = await bcrypt.hash(password, 10);
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (id, username, email, password_hash, full_name, invited_by, invite_code_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, email, email, passwordHash, name, invitation.creator_id, invite_code, new Date().toISOString()], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Link to member if target_member_id exists
        let linkedMemberId = null;
        if (invitation.target_member_id) {
            linkedMemberId = invitation.target_member_id;
            await new Promise((resolve, reject) => {
                db.run(`UPDATE members SET user_id = ? WHERE id = ?`, [userId, invitation.target_member_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        // Add to family tree with role
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_family_trees (user_id, family_tree_id, role, joined_at)
                VALUES (?, ?, ?, ?)
            `, [userId, invitation.family_tree_id, invitation.default_role, new Date().toISOString()], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Update invitation used count
        await new Promise((resolve, reject) => {
            db.run(`UPDATE invitations SET used_count = used_count + 1, updated_at = ? WHERE id = ?`, [new Date().toISOString(), invitation.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId,
                email,
                role: invitation.default_role,
                familyTrees: [invitation.family_tree_id],
                linkedMemberId
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                email,
                name,
                role: invitation.default_role,
                linkedMemberId,
                familyTrees: [invitation.family_tree_id]
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Create New Family Tree and Founder Account
app.post('/api/family/create', async (req, res) => {
    const { surname, ancestralHome, hallName, founderName, founderEmail, founderPassword } = req.body;
    
    if (!surname || !founderName || !founderEmail || !founderPassword) {
        return res.status(400).json({ error: '必填欄位缺失' });
    }

    const familyTreeId = `family_${Date.now()}`;
    const userId = `user_${Date.now()}`;
    const memberId = `member_${Date.now()}`;
    const now = new Date().toISOString();

    try {
        const passwordHash = await bcrypt.hash(founderPassword, 10);

        // 1. 建立家族樹
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO family_trees (id, name, surname, ancestral_home, hall_name, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [familyTreeId, `${surname}氏家族`, surname, ancestralHome, hallName, now, now], (err) => {
                if (err) reject(err); else resolve();
            });
        });

        // 2. 建立用戶
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (id, username, email, password_hash, full_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [userId, founderEmail, founderEmail, passwordHash, founderName, now], (err) => {
                if (err) reject(err); else resolve();
            });
        });

        // 3. 建立對應成員並與用戶連結
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO members (id, name, surname, family_tree_id, user_id, primaryFamily, families)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [memberId, founderName, surname, familyTreeId, userId, familyTreeId, JSON.stringify([familyTreeId])], (err) => {
                if (err) reject(err); else resolve();
            });
        });

        // 4. 授予權限
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO user_family_trees (user_id, family_tree_id, role, joined_at)
                VALUES (?, ?, ?, ?)
            `, [userId, familyTreeId, 'family_admin', now], (err) => {
                if (err) reject(err); else resolve();
            });
        });

        res.json({ success: true, familyTreeId, userId, memberId });
    } catch (err) {
        console.error('[API/Family/Create] 錯誤:', err);
        res.status(500).json({ error: '系統錯誤，請稍後再試: ' + err.message });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    try {
        // Find user
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active != 0`, [email, email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // 獲取用戶的家族樹和角色(關鍵:同時返回家族信息)
        const familyTrees = await new Promise((resolve, reject) => {
            db.all(`
                SELECT uft.family_tree_id, uft.role, ft.name as family_name 
                FROM user_family_trees uft
                LEFT JOIN family_trees ft ON uft.family_tree_id = ft.id
                WHERE user_id = ?
            `, [user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // 獲取鏈接的成員ID
        const linkedMember = await new Promise((resolve, reject) => {
            db.get(`SELECT id as member_id FROM members WHERE user_id = ?`, [user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // 更新最後登錄時間
        db.run(`UPDATE users SET last_login = ? WHERE id = ?`, [new Date().toISOString(), user.id]);
        
        // 構建家族列表(包含ID和名稱)
        const familyTreeList = familyTrees.map(ft => ({
            id: ft.family_tree_id,
            name: ft.family_name || ft.family_tree_id,
            role: ft.role
        }));
        
        // ✅ 構建 familyRoles 對象(向後兼容)
        const familyRolesObj = {};
        familyTrees.forEach(ft => {
            familyRolesObj[ft.family_tree_id] = ft.role;
        });
        
        // Generate JWT token
        const expiresIn = rememberMe ? '7d' : '24h';
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: familyTrees[0]?.role || 'user',
                familyTrees: familyTrees.map(ft => ft.family_tree_id),
                linkedMemberId: linkedMember?.member_id
            },
            JWT_SECRET,
            { expiresIn }
        );
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email || '',
                name: user.full_name || user.username || '用戶',
                avatar: user.avatar || null,
                role: familyTrees[0]?.role || 'user',
                linkedMemberId: linkedMember?.member_id || null,
                familyTrees: familyTreeList || [],
                familyTreeIds: familyTrees.map(ft => ft.family_tree_id) || [],
                familyRoles: familyRolesObj || {}
            }
        });
        
    } catch (error) {
        console.error('Login error detail:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT id, email, full_name, avatar, created_at, last_login FROM users WHERE id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 獲取用戶的家族樹和角色(關鍵:同時返回家族信息)
        const familyTrees = await new Promise((resolve, reject) => {
            db.all(`
                SELECT uft.family_tree_id, uft.role, ft.name as family_name 
                FROM user_family_trees uft
                LEFT JOIN family_trees ft ON uft.family_tree_id = ft.id
                WHERE uft.user_id = ?
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // 獲取鏈接的成員ID
        const linkedMember = await new Promise((resolve, reject) => {
            db.get(`SELECT id as member_id FROM members WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // 構建家族列表(包含ID和名稱)
        const familyTreeList = familyTrees.map(ft => ({
            id: ft.family_tree_id,
            name: ft.family_name || ft.family_tree_id,  // 如果沒有名稱,使用ID
            role: ft.role
        }));
        
        // ✅ 構建 familyRoles 對象(向後兼容)
        const familyRolesObj = {};
        familyTrees.forEach(ft => {
            familyRolesObj[ft.family_tree_id] = ft.role;
        });
        
        res.json({
            id: user.id,
            email: user.email || '',
            name: user.full_name || user.username || '用戶',
            avatar: user.avatar || null,
            role: familyTrees[0]?.role || 'user',
            linkedMemberId: linkedMember?.member_id || null,
            familyTrees: familyTreeList || [],
            familyTreeIds: familyTrees.map(ft => ft.family_tree_id) || [],
            familyRoles: familyRolesObj || {},
            createdAt: user.created_at,
            lastLogin: user.last_login
        });
        
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all members
// Get all members (Supported filtering by family_tree_id)
app.get('/api/family', (req, res) => {
    const { family_tree_id } = req.query;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let sql = "SELECT * FROM members WHERE is_deleted = 0";
    const params = [];

    if (family_tree_id) {
        // ✨ 優化查詢：優先匹配索引字段 primaryFamily，並支援 families 數組匹配
        sql = `
            SELECT DISTINCT m.* 
            FROM members m
            WHERE (m.primaryFamily = ? 
               OR EXISTS (SELECT 1 FROM json_each(m.families) WHERE value = ?))
               AND m.is_deleted = 0
        `;
        params.push(family_tree_id, family_tree_id);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        const members = rows.map(row => ({
            ...row,
            spouses: JSON.parse(row.spouses || "[]"),
            children: JSON.parse(row.children || "[]"),
            parents: JSON.parse(row.parents || "[]"),
            aliases: JSON.parse(row.aliases || "[]"),
            achievements: JSON.parse(row.achievements || "[]"),
            is_deceased: !!row.is_deceased,
            email: row.email || null,
            avatar_url: row.avatar_url || null,
            has_biography: !!row.biography_md,
            tags: JSON.parse(row.biography_tags || '[]'),
            // ✨ 僅依賴新欄位
            primaryFamily: row.primaryFamily,
            families: JSON.parse(row.families || '[]')
        }));
        res.json(members);
    });
});

// Add a new member
app.post('/api/family', (req, res) => {
    let { id, name, surname, given_name, gender, spouses, children, parents,
        birth_date, birth_year, birth_month, birth_day, birth_calendar,
        death_date, death_year, death_month, death_day, death_calendar,
        is_deceased, phone, email, address, remark, generation, clan_name,
        ancestral_home, courtesy_name, pseudonym, aliases, education,
        occupation, achievements, biography, avatar_url, biography_md, privacy_settings,
        primaryFamily, families } = req.body;

    // ✨ 寫入邏輯統一：僅處理 primaryFamily 與 families
    let familyList = Array.isArray(families) ? families : (families ? [families] : []);
    let mainFamily = primaryFamily || (familyList.length > 0 ? familyList[0] : null);
    
    // 如果仍然缺失，記錄日誌並返回錯誤
    if (!mainFamily) {
        console.warn('[API/POST] Missing primaryFamily for member creation, req.body:', JSON.stringify(req.body));
        return res.status(400).json({ error: 'Missing primaryFamily assignment' });
    }

    if (!familyList.includes(mainFamily)) {
        familyList = [mainFamily, ...familyList];
    } else {
        familyList = [mainFamily, ...familyList.filter(f => f !== mainFamily)];
    }
    
    primaryFamily = mainFamily;
    families = familyList;

    const sql = "INSERT INTO members (id, name, surname, given_name, gender, spouses, children, parents, birth_date, birth_year, birth_month, birth_day, birth_calendar, death_date, death_year, death_month, death_day, death_calendar, is_deceased, phone, email, address, remark, generation, clan_name, ancestral_home, courtesy_name, pseudonym, aliases, education, occupation, achievements, biography, avatar_url, biography_md, privacy_settings, primaryFamily, families) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const params = [
        id,
        name,
        surname || '',
        given_name || '',
        gender,
        JSON.stringify(spouses || []),
        JSON.stringify(children || []),
        JSON.stringify(parents || []),
        birth_date,
        birth_year,
        birth_month,
        birth_day,
        birth_calendar,
        death_date,
        death_year,
        death_month,
        death_day,
        death_calendar,
        is_deceased ? 1 : 0,
        phone,
        email,
        address,
        remark,
        generation,
        clan_name,
        ancestral_home,
        courtesy_name,
        pseudonym,
        JSON.stringify(aliases || []),
        education,
        occupation,
        JSON.stringify(achievements || []),
        biography,
        avatar_url,
        biography_md,
        JSON.stringify(privacy_settings || {}),
        primaryFamily,
        JSON.stringify(families)
    ];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('POST /api/family error:', err.message);
            console.error('SQL:', sql);
            console.error('Params count:', params.length);
            console.error('Params:', params);
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// Update a member
app.put('/api/family/:id', authenticateToken, (req, res) => {
    let { name, surname, given_name, gender, spouses, children, parents,
        birth_date, birth_year, birth_month, birth_day, birth_calendar,
        death_date, death_year, death_month, death_day, death_calendar,
        is_deceased, phone, email, address, remark, generation, clan_name,
        ancestral_home, courtesy_name, pseudonym, aliases, education,
        occupation, achievements, biography, avatar_url, biography_md, privacy_settings,
        primaryFamily, families,
        nationality, birth_place, religion, father_id, mother_id
    } = req.body;

    // ✨ 寫入邏輯統一：如果更新了家族相關字段，確保同步
    if (primaryFamily || families) {
        let familyList = Array.isArray(families) ? families : (families ? [families] : []);
        const mainFamily = primaryFamily || (familyList.length > 0 ? familyList[0] : null);
        
        if (mainFamily) {
            if (!familyList.includes(mainFamily)) {
                familyList = [mainFamily, ...familyList];
            } else {
                familyList = [mainFamily, ...familyList.filter(f => f !== mainFamily)];
            }
            primaryFamily = mainFamily;
            families = familyList;
        }
    }

    const sql = `UPDATE members SET 
      name = COALESCE(?, name), 
      surname = COALESCE(?, surname),
      given_name = COALESCE(?, given_name),
      gender = COALESCE(?, gender), 
      spouses = COALESCE(?, spouses), 
      children = COALESCE(?, children), 
      parents = COALESCE(?, parents),
      birth_date = COALESCE(?, birth_date),
      birth_year = COALESCE(?, birth_year),
      birth_month = COALESCE(?, birth_month),
      birth_day = COALESCE(?, birth_day),
      birth_calendar = COALESCE(?, birth_calendar),
      death_date = COALESCE(?, death_date),
      death_year = COALESCE(?, death_year),
      death_month = COALESCE(?, death_month),
      death_day = COALESCE(?, death_day),
      death_calendar = COALESCE(?, death_calendar),
      is_deceased = COALESCE(?, is_deceased),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      address = COALESCE(?, address),
      remark = COALESCE(?, remark),
      generation = COALESCE(?, generation),
      clan_name = COALESCE(?, clan_name),
      ancestral_home = COALESCE(?, ancestral_home),
      courtesy_name = COALESCE(?, courtesy_name),
      pseudonym = COALESCE(?, pseudonym),
      aliases = COALESCE(?, aliases),
      education = COALESCE(?, education),
      occupation = COALESCE(?, occupation),
      achievements = COALESCE(?, achievements),
      biography = COALESCE(?, biography),
      avatar_url = COALESCE(?, avatar_url),
      biography_md = COALESCE(?, biography_md),
      privacy_settings = COALESCE(?, privacy_settings),
      primaryFamily = COALESCE(?, primaryFamily),
      families = COALESCE(?, families),
      nationality = COALESCE(?, nationality),
      birth_place = COALESCE(?, birth_place),
      religion = COALESCE(?, religion),
      father_id = COALESCE(?, father_id),
      mother_id = COALESCE(?, mother_id)
      WHERE id = ?`;

    const params = [
        name === undefined ? null : name,
        surname === undefined ? null : surname,
        given_name === undefined ? null : given_name,
        gender === undefined ? null : gender,
        smartStringify(spouses || []),
        smartStringify(children || []),
        smartStringify(parents || []),
        birth_date === undefined ? null : birth_date,
        birth_year === undefined ? null : birth_year,
        birth_month === undefined ? null : birth_month,
        birth_day === undefined ? null : birth_day,
        birth_calendar === undefined ? null : birth_calendar,
        death_date === undefined ? null : death_date,
        death_year === undefined ? null : death_year,
        death_month === undefined ? null : death_month,
        death_day === undefined ? null : death_day,
        death_calendar === undefined ? null : death_calendar,
        is_deceased !== undefined ? (is_deceased ? 1 : 0) : null,
        phone === undefined ? null : phone,
        email === undefined ? null : email,
        address === undefined ? null : address,
        remark === undefined ? null : remark,
        generation === undefined ? null : generation,
        clan_name === undefined ? null : clan_name,
        ancestral_home === undefined ? null : ancestral_home,
        courtesy_name === undefined ? null : courtesy_name,
        pseudonym === undefined ? null : pseudonym,
        smartStringify(aliases || []),
        education === undefined ? null : education,
        occupation === undefined ? null : occupation,
        smartStringify(achievements || []),
        biography === undefined ? null : biography,
        avatar_url === undefined ? null : avatar_url,
        biography_md === undefined ? null : biography_md,
        smartStringify(privacy_settings || {}),
        primaryFamily === undefined ? null : primaryFamily,
        smartStringify(families || []),
        nationality === undefined ? null : nationality,
        birth_place === undefined ? null : birth_place,
        religion === undefined ? null : religion,
        father_id === undefined ? null : father_id,
        mother_id === undefined ? null : mother_id,
        req.params.id
    ];

    // 📌 第一步：在更新前獲取舊數據，用於精確日誌記錄
    db.get('SELECT * FROM members WHERE id = ?', [req.params.id], (getErr, oldData) => {
        if (getErr || !oldData) {
            return res.status(404).json({ error: '找不到該成員，無法更新' });
        }

        db.run(sql, params, function (err) {
            if (err) {
                console.error('[API/PUT] SQL Update Error:', err.message);
                console.error('Params Length:', params.length);
                res.status(400).json({ "error": err.message });
                return;
            }

            // 📌 第二步：對比並寫入審計日誌
            const userId = req.user?.userId || 'system';
            const userName = req.user?.full_name || '系統用戶';
            
            const changes = {};
            // 擴展開發所有需要追蹤的字段
            const fieldsToTrack = [
                'name', 'surname', 'given_name', 'gender', 'birth_date', 
                'death_date', 'parents', 'children', 'spouses', 'phone', 
                'email', 'address', 'remark', 'biography_md', 'primaryFamily'
            ];
            
            fieldsToTrack.forEach(field => {
                let newVal = req.body[field];
                let oldVal = oldData[field];
                
                // 處理 JSON 字段的對比
                if (['parents', 'children', 'spouses'].includes(field)) {
                    const normalizedNew = smartStringify(newVal || []);
                    const normalizedOld = oldVal || '[]';
                    if (normalizedNew !== normalizedOld) {
                        changes[field] = { old: normalizedOld, new: normalizedNew };
                    }
                } else if (newVal !== undefined && newVal !== oldVal) {
                    changes[field] = { old: oldVal, new: newVal };
                }
            });

            if (Object.keys(changes).length > 0) {
                db.run(`INSERT INTO audit_logs (target_id, target_type, action, old_values, new_values, changed_fields, user_id, user_name)
                       VALUES (?, 'member', 'update', ?, ?, ?, ?, ?)`,
                       [req.params.id, JSON.stringify(oldData), JSON.stringify(req.body), JSON.stringify(changes), userId, userName]);
            }

            res.json({
                message: "success",
                data: req.body,
                changes: this.changes
            });
        });
    });
});

// ⏪ Revert member state from log (還原成員狀態)
app.post('/api/family/:id/revert', authenticateToken, async (req, res) => {
    const { log_id } = req.body;
    if (!log_id) return res.status(400).json({ error: '需要指定 Log ID' });

    db.get('SELECT old_values FROM audit_logs WHERE id = ? AND target_id = ?', [log_id, req.params.id], (err, log) => {
        if (err || !log) return res.status(404).json({ error: '找不到對應的歷史記錄' });

        try {
            const oldData = JSON.parse(log.old_values);
            // 排除不可還原的字段（如 ID 和 軟刪除狀態）
            const { id, is_deleted, created_at, deleted_at, ...updateData } = oldData;
            
            const fields = Object.keys(updateData);
            const placeholders = fields.map(f => `${f} = ?`).join(', ');
            const params = [...Object.values(updateData), req.params.id];

            db.run(`UPDATE members SET ${placeholders} WHERE id = ?`, params, function(updateErr) {
                if (updateErr) return res.status(500).json({ error: updateErr.message });
                
                // 記錄還原動作本人
                db.run(`INSERT INTO audit_logs (target_id, target_type, action, changed_fields, user_id, user_name)
                       VALUES (?, 'member', 'revert', ?, ?, ?)`,
                       [req.params.id, JSON.stringify({ reverted_from_log: log_id }), req.user.userId, req.user.full_name]);

                res.json({ success: true, message: '已成功還原至歷史版本' });
            });
        } catch (e) {
            res.status(500).json({ error: '還原失敗：數據解析錯誤' });
        }
    });
});

// 📸 Snapshot/Backup DB (資料庫快照)
app.post('/api/admin/snapshot', authenticateToken, (req, res) => {
    // 只有管理員可以操作備份
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) return res.status(403).json({ error: '權限不足' });

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `family_backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFile);

    // 複製數據庫文件
    fs.copyFile(path.join(__dirname, 'family.db'), backupPath, (err) => {
        if (err) return res.status(500).json({ error: '備份失敗：' + err.message });
        
        db.run(`INSERT INTO audit_logs (target_id, target_type, action, changed_fields, user_id, user_name)
               VALUES (?, 'system', 'backup', ?, ?, ?)`,
               ['database', JSON.stringify({ filename: backupFile }), req.user.userId, req.user.full_name]);

        res.json({ success: true, message: '數據備份成功', filename: backupFile });
    });
});

// 📂 List Backups (查看備份列表)
app.get('/api/admin/snapshots', authenticateToken, (req, res) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) return res.json([]);

    fs.readdir(backupDir, (err, files) => {
        if (err) return res.status(500).json({ error: '讀取備份列表失敗' });
        
        const backups = files
            .filter(f => f.endsWith('.db'))
            .map(f => ({
                filename: f,
                created_at: fs.statSync(path.join(backupDir, f)).mtime
            }))
            .sort((a, b) => b.created_at - a.created_at);

        res.json(backups);
    });
});

// 🗑️ Soft Delete a member (軟刪除)
app.delete('/api/family/:id', authenticateToken, (req, res) => {
    const userId = req.user?.userId || 'system';
    const userName = req.user?.full_name || '系統用戶';

    const sql = 'UPDATE members SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
    const params = [req.params.id];
    
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }

        // 記錄審計日誌
        db.run(`INSERT INTO audit_logs (target_id, target_type, action, user_id, user_name)
               VALUES (?, 'member', 'delete', ?, ?)`,
               [req.params.id, userId, userName]);

        res.json({
            message: "soft_deleted",
            changes: this.changes
        });
    });
});

// ♻️ Restore a member (恢復)
app.post('/api/admin/restore/:id', authenticateToken, (req, res) => {
    // 檢查管理員權限 (TODO: 更嚴格的 super_admin 檢查)
    const userId = req.user?.userId || 'system';
    const userName = req.user?.full_name || '系統用戶';

    const sql = 'UPDATE members SET is_deleted = 0, deleted_at = NULL WHERE id = ?';
    db.run(sql, [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        
        db.run(`INSERT INTO audit_logs (target_id, target_type, action, user_id, user_name)
               VALUES (?, 'member', 'restore', ?, ?)`,
               [req.params.id, userId, userName]);

        res.json({ message: "restored", changes: this.changes });
    });
});

// 📁 Get Trash contents (獲取回收站內容)
app.get('/api/admin/trash', authenticateToken, (req, res) => {
    db.all('SELECT * FROM members WHERE is_deleted = 1 ORDER BY deleted_at DESC', [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// 📜 Get Audit Logs (獲取審計日誌)
app.get('/api/admin/logs', authenticateToken, (req, res) => {
    const { target_id } = req.query;
    let sql = 'SELECT * FROM audit_logs';
    const params = [];
    
    if (target_id) {
        sql += ' WHERE target_id = ?';
        params.push(target_id);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 100';
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// Get all marriages
app.get('/api/marriages', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    db.all("SELECT * FROM marriages", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

// Divorce - handle marriage dissolution and family tree cleanup
app.post('/api/marriages/divorce', authenticateToken, async (req, res) => {
    try {
        const { member_a_id, member_b_id, husband_id, wife_id, divorce_date, family_id } = req.body;
        const idA = member_a_id || husband_id;
        const idB = member_b_id || wife_id;
        
        if (!idA || !idB) {
            return res.status(400).json({ error: '需要指定雙方Member ID' });
        }
        
        const now = new Date().toISOString();
        const divorceDate = divorce_date || now;
        
        // Step 1: Update marriages table
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE marriages 
                SET divorce_date = ?, is_divorced = 1 
                WHERE (husband_id = ? AND wife_id = ?) 
                   OR (husband_id = ? AND wife_id = ?)
            `, [divorceDate, idA, idB, idB, idA], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Step 2: 自動解除外姓配偶的家族綁定
        if (family_id) {
            const memberIds = [idA, idB];
            for (const mid of memberIds) {
                if (!mid) continue;
                
                await new Promise((resolve) => {
                    db.get("SELECT primaryFamily, families FROM members WHERE id = ?", [mid], (err, row) => {
                        if (err || !row) {
                            resolve();
                            return;
                        }
                        
                        // 判定邏輯：如果該成員的主家族不是當前家族，說明是「嫁/贅入」的配偶
                        if (row.primaryFamily !== family_id) {
                            let families = [];
                            try {
                                families = JSON.parse(row.families || '[]');
                            } catch (e) {
                                families = [];
                            }
                            
                            if (families.includes(family_id)) {
                                const newFamilies = families.filter(fid => fid !== family_id);
                                db.run("UPDATE members SET families = ? WHERE id = ?", [JSON.stringify(newFamilies), mid], (updateErr) => {
                                    if (!updateErr) {
                                        console.log(`[Divorce Cleanup] Decoupled member ${mid} from family ${family_id}`);
                                    }
                                    resolve();
                                });
                            } else {
                                resolve();
                            }
                        } else {
                            resolve();
                        }
                    });
                });
            }
        }
        
        // Simple logic to log this action in audit logs
        const userId = req.user?.userId || 'system';
        const userName = req.user?.full_name || '系統用戶';
        db.run(`INSERT INTO audit_logs (target_id, target_type, action, changed_fields, user_id, user_name)
               VALUES (?, 'marriage', 'divorce', ?, ?, ?)`,
               [idA + '_' + idB, JSON.stringify({divorce_date: divorceDate, decoupled_family: family_id}), userId, userName]);

        res.json({
            success: true,
            message: '離婚處理完成，外姓配偶已從該家族視圖中移除',
            divorced_members: [idA, idB]
        });
        
    } catch (error) {
        console.error('Divorce processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single member with permission check
app.get('/api/family/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const memberId = req.params.id;
    // TODO: 從 session 或 token 中獲取當前用戶 ID
    const viewerId = req.query.user_id || 'anonymous';  // 臨時方案
    
    db.get("SELECT * FROM members WHERE id = ?", [memberId], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ "error": "Member not found" });
            return;
        }
        
        // 計算權限等級
        const permissionLevel = calculatePermissionLevel(viewerId, row);
        
        // 根據權限過濾字段
        const filteredMember = filterFieldsByPermission(row, permissionLevel);
        
        res.json({
            ...filteredMember,
            permission_level: permissionLevel
        });
    });
});

// 獲取家族管理信息（需要管理員權限）
app.get('/api/family/:id/manage', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const userId = req.user.userId;
        
        // 检查用户是否为家族管理员
        const roleSql = 'SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?';
        db.get(roleSql, [userId, familyId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '數據庫錯誤' });
            }
            
            if (!row) {
                console.log('No role found for user', userId, 'in family', familyId);
                return res.status(403).json({ error: '無權訪問此家族' });
            }
            
            console.log('User role:', row.role);
            
            // 支持多种管理员角色名称
            const adminRoles = ['admin', 'family_admin', 'super_admin'];
            if (!adminRoles.includes(row.role)) {
                return res.status(403).json({ error: '僅管理員可訪問' });
            }
            
            // 获取家族信息
            const familySql = 'SELECT * FROM family_trees WHERE id = ?';
            db.get(familySql, [familyId], (err, family) => {
                if (err || !family) {
                    return res.status(404).json({ error: '家族不存在' });
                }
                
                // 格式化邀请码显示
                const inviteCode = family.invite_code ? 
                    family.invite_code.slice(0, 3) + ' ' + family.invite_code.slice(3) : null;
                
                res.json({
                    ...family,
                    invite_code_formatted: inviteCode,
                    is_admin: true,
                    // 確保返回存儲配額字段
                    storage_limit_mb: family.storage_limit_mb || 200
                });
            });
        });
    } catch (error) {
        console.error('Error in /api/family/:id/manage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 新增：獲取家族下所有用戶的存儲明細
app.get('/api/family/:id/storage-users', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const userId = req.user.userId;

        // 權限檢查（僅管理員）
        const roleRow = await new Promise((resolve, reject) => {
            db.get('SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?', [userId, familyId], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!roleRow || !['admin', 'family_admin', 'super_admin'].includes(roleRow.role)) {
            return res.status(403).json({ error: '僅管理員可訪問' });
        }

        // 查詢已綁定用戶的存儲明細
        const sql = `
            SELECT 
                u.id as userId, 
                u.username, 
                u.full_name as fullName, 
                u.fair_use_limit_mb as fairUseLimit, 
                u.used_storage_kb as usedStorage,
                m.name as linkedMemberName,
                uft.role
            FROM user_family_trees uft
            JOIN users u ON uft.user_id = u.id
            LEFT JOIN members m ON u.id = m.user_id AND (m.primaryFamily = uft.family_tree_id OR m.families LIKE '%' || uft.family_tree_id || '%')
            WHERE uft.family_tree_id = ?
            GROUP BY u.id
        `;
        
        db.all(sql, [familyId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 新增：修改家族存儲上限
app.put('/api/family/:id/storage-limit', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const { limit_mb } = req.body;
        const userId = req.user.userId;

        // 權限檢查
        const roleRow = await new Promise((resolve, reject) => {
            db.get('SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?', [userId, familyId], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!roleRow || !['admin', 'family_admin', 'super_admin'].includes(roleRow.role)) {
            return res.status(403).json({ error: '無權修改' });
        }

        db.run('UPDATE family_trees SET storage_limit_mb = ? WHERE id = ?', [limit_mb, familyId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: '家族配額已更新', limit_mb });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 新增：修改用戶公平使用限額 (全局屬性)
app.put('/api/user/:userId/fair-use-limit', authenticateToken, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const { limit_mb } = req.body;
        const userId = req.user.userId;

        // 簡單權限檢查：必須是某個家族的管理員（或者超級管理員）
        // 這裡為了方便，只要當前用戶在任何一個家族是 admin 即可修改（因為個人限額是全局的）
        const adminCheck = await new Promise((resolve, reject) => {
            db.get('SELECT role FROM user_family_trees WHERE user_id = ? AND role IN ("admin", "super_admin", "family_admin") LIMIT 1', [userId], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!adminCheck) {
            return res.status(403).json({ error: '權限不足，無法調整用戶限額' });
        }

        db.run('UPDATE users SET fair_use_limit_mb = ? WHERE id = ?', [limit_mb, targetUserId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: '用戶公平限額已更新', userId: targetUserId, limit_mb });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新家族基本信息 (實現 PUT /api/family/:id/info)
app.put('/api/family/:id/info', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const userId = req.user.userId;
        const { name, surname, ancestral_home, hall_name, description } = req.body;
        
        // 1. 權限驗證：檢查用戶是否具有該家族的管理員權限
        const roleSql = 'SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?';
        db.get(roleSql, [userId, familyId], (err, row) => {
            if (err || !row) {
                return res.status(403).json({ error: '無權訪問此家族' });
            }
            
            const adminRoles = ['admin', 'family_admin', 'super_admin'];
            if (!adminRoles.includes(row.role)) {
                return res.status(403).json({ error: '權限不足，僅管理員可執行此操作' });
            }
            
            // 2. 更新數據
            const updateSql = `
                UPDATE family_trees 
                SET name = ?, surname = ?, ancestral_home = ?, hall_name = ?, description = ?, updated_at = ?
                WHERE id = ?
            `;
            const now = new Date().toISOString();
            db.run(updateSql, [name, surname, ancestral_home, hall_name, description, now, familyId], function(updErr) {
                if (updErr) {
                    console.error('Update family info error:', updErr);
                    return res.status(500).json({ error: '數據庫更新失敗: ' + updErr.message });
                }
                res.json({ success: true, message: '家族信息已更新' });
            });
        });
    } catch (error) {
        console.error('Error in PUT /api/family/:id/info:', error);
        res.status(500).json({ error: '服務器內部錯誤' });
    }
});

// Update biography (MD format)
app.put('/api/family/:id/biography', (req, res) => {
    const { biography_md } = req.body;
    const memberId = req.params.id;
    // TODO: 驗證用戶權限（需要 L3 以上）
    
    db.run(
        "UPDATE members SET biography_md = ? WHERE id = ?",
        [biography_md, memberId],
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({
                message: "Biography updated successfully",
                changes: this.changes
            });
        }
    );
});

// 生成/刷新家族邀请码
app.post('/api/family/:id/invite-code', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const userId = req.user.userId;
        
        // 检查权限
        const roleSql = 'SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?';
        db.get(roleSql, [userId, familyId], (err, row) => {
            if (err || !row) {
                return res.status(403).json({ error: '僅管理員可生成邀請碼' });
            }
            
            const adminRoles = ['admin', 'family_admin', 'super_admin'];
            if (!adminRoles.includes(row.role)) {
                return res.status(403).json({ error: '僅管理員可生成邀請碼' });
            }
            
            // 生成新邀请码
            const inviteCode = generateInviteCode();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30天有效期
            
            const updateSql = 'UPDATE family_trees SET invite_code = ?, invite_code_expires_at = ? WHERE id = ?';
            db.run(updateSql, [inviteCode, expiresAt.toISOString(), familyId], (err) => {
                if (err) {
                    console.error('Error generating invite code:', err);
                    return res.status(500).json({ error: '生成邀請碼失敗' });
                }
                
                res.json({
                    invite_code: inviteCode.slice(0, 3) + ' ' + inviteCode.slice(3),
                    expires_at: expiresAt.toISOString()
                });
            });
        });
    } catch (error) {
        console.error('Error in POST /api/family/:id/invite-code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update privacy settings
app.post('/api/family/:id/privacy', (req, res) => {
    const { privacy_settings } = req.body;
    const memberId = req.params.id;
    // TODO: 驗證用戶權限（需要 L4 或成員本人）
    
    db.run(
        "UPDATE members SET privacy_settings = ? WHERE id = ?",
        [JSON.stringify(privacy_settings), memberId],
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({
                message: "Privacy settings updated successfully",
                changes: this.changes
            });
        }
    );
});

// ========== 新增：Member 詳情與生平事蹟 API ==========

// Get member detail with biography info
// 全域成員搜索 (用於添加關聯成員)
app.get('/api/members/search', (req, res) => {
    const { q, gender } = req.query;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    if (!q || q.length < 1) {
        return res.json([]);
    }

    let sql = "SELECT * FROM members WHERE is_deleted = 0 AND (name LIKE ? OR id LIKE ?)";
    const params = [`%${q}%`, `%${q}%`];

    if (gender) {
        sql += " AND gender = ?";
        params.push(gender);
    }

    sql += " LIMIT 50";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // 返回關鍵的信息供前端顯示
        const results = rows.map(row => ({
            id: row.id,
            name: row.name,
            gender: row.gender,
            avatar_url: row.avatar_url,
            birth_year: row.birth_year,
            primaryFamily: row.primaryFamily
        }));
        
        res.json(results);
    });
});

// Get member details
app.get('/api/member/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const memberId = req.params.id;
    const viewerId = req.query.user_id || 'anonymous';
    
    db.get("SELECT * FROM members WHERE id = ?", [memberId], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ "error": "Member not found" });
            return;
        }
        
        // 解析標籤和事蹟狀態 (加固解析)
        let tags = [];
        try {
            tags = JSON.parse(row.biography_tags || '[]');
        } catch (e) {
            console.error('[JSON_ERROR] Failed to parse tags for member:', memberId);
            tags = [];
        }
        const hasBiography = !!row.biography_md;
        
        // 計算權限並過濾字段
        // 開發階段：直接給 L3 權限（可以編輯）
        const permissionLevel = getDevelopmentPermissionLevel();
        const filteredMember = filterFieldsByPermission(row, permissionLevel);
        
        res.json({
            ...filteredMember,
            tags,
            has_biography: hasBiography,
            permission_level: permissionLevel
        });
    });
});

// Get biography (with version support)
app.get('/api/member/:id/biography', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const memberId = req.params.id;
    const { version } = req.query;
    
    let sql = "SELECT * FROM biographies WHERE member_id = ? AND is_current = 1";
    const params = [memberId];
    
    if (version) {
        sql = "SELECT * FROM biographies WHERE member_id = ? AND version = ?";
        params.push(parseInt(version));
    }
    
    db.get(sql, params, (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        if (!row) {
            // 如果沒有版本記錄，返回當前的 biography_md
            db.get("SELECT biography_md, biography_tags FROM members WHERE id = ?", [memberId], (err2, memberRow) => {
                if (err2) {
                    res.status(400).json({ "error": err2.message });
                    return;
                }
                res.json({
                    content_md: memberRow?.biography_md || '',
                    tags: JSON.parse(memberRow?.biography_tags || '[]'),
                    version: 0,
                    is_legacy: true
                });
            });
            return;
        }
        
        res.json({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
            images: JSON.parse(row.images || '[]')
        });
    });
});

// Get image count and urls for storage quota
app.get('/api/member/:id/image-count', (req, res) => {
    const memberId = req.params.id;
    // Get current biography to find associated images
    db.get("SELECT images FROM biographies WHERE member_id = ? AND is_current = 1", [memberId], (err, row) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        const urls = row ? JSON.parse(row.images || '[]') : [];
        res.json({ 
            count: urls.length,
            urls: urls 
        });
    });
});

// Update/Create biography (creates new version)
app.put('/api/member/:id/biography', (req, res) => {
    const { id } = req.params;
    const { content_md, content_html, tags, achievements, edited_by } = req.body;
    
    // Extract images from content_md to keep database in sync
    const urlsInContent = content_md.match(/\/uploads\/[^)]+\.(jpg|jpeg|png|gif|webp)/g) || [];
    const images = urlsInContent;
    
    console.log(`[Bio] Saving biography for member ${id}. Found ${images.length} images.`);
    
    // 事務處理：更新 member 表和 biography 表
    db.serialize(() => {
        // 1. 取消當前版本
        db.run("UPDATE biographies SET is_current = 0 WHERE member_id = ?", [id]);
        
        // 2. 獲取新版本號
        db.get("SELECT MAX(version) as max_ver FROM biographies WHERE member_id = ?", [id], 
            (err, row) => {
                const newVersion = (row?.max_ver || 0) + 1;
                
                // 3. 插入新版本
                db.run(`INSERT INTO biographies 
                    (member_id, version, content_md, content_html, tags, images, edited_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, newVersion, content_md, content_html, 
                     smartStringify(tags || []), smartStringify(images || []), edited_by || 'anonymous'],
                    function(err) {
                        if (err) {
                            res.status(400).json({ "error": err.message });
                            return;
                        }
                        
                        const biographyId = this.lastID;
                        
                        // 4. 更新 member 表
                        db.run(`UPDATE members SET 
                            biography_md = ?, 
                            biography_html = ?, 
                            biography_tags = ?,
                            achievements = ?,
                            has_biography = 1
                            WHERE id = ?`,
                            [content_md, content_html, smartStringify(tags || []), smartStringify(achievements || []), id],
                            (err) => {
                                if (err) {
                                    res.status(400).json({ "error": err.message });
                                    return;
                                }
                                
                                res.json({
                                    success: true,
                                    version: newVersion,
                                    biography_id: biographyId
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// Convert text (Simplified <-> Traditional)
app.post('/api/convert', (req, res) => {
    const { text, type } = req.body; // type: 's2t' or 't2s'
    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }

    let convertedText = text;
    if (type === 's2t') {
        convertedText = converterS2T(text);
    } else if (type === 't2s') {
        convertedText = converterT2S(text);
    }

    res.json({ converted: convertedText });
});

// Reunion Board Endpoints
// Get all reunion posts with optional search and status filter
// ========== 尋親啟事 API ==========
// 已在文件末尾定義（第 2255 行開始）

// Media API Endpoints
app.get('/api/media', (req, res) => {
    const { member_id, family_tree_id } = req.query;
    let sql = "SELECT * FROM media";
    let params = [];

    if (member_id) {
        // ✨ 增強：不僅獲取成員上傳的照片，還獲取所有標注了該成員的照片
        sql = `
            SELECT * FROM media 
            WHERE member_id = ? 
               OR id IN (SELECT media_id FROM face_embeddings WHERE member_id = ?)
        `;
        params = [member_id, member_id];
        console.log('[DEBUG] Media query for member:', { sql, params });
    } else if (family_tree_id) {
        sql += " WHERE family_tree_id = ?";
        params = [family_tree_id];
    }

    // ✨ [STRENGTHENED SORT] 智能排序：優先取 photo_date，若為空則動態從 metadata 中提取
    sql += ` ORDER BY 
        COALESCE(
            NULLIF(photo_date, ''), 
            json_extract(metadata, '$.photo_date'), 
            '1900-01-01'
        ) DESC, 
        upload_date DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('[DATABASE ERROR] Media query fail:', err.message);
            return res.status(400).json({ "error": err.message });
        }
        
        try {
            const media = rows.map(row => ({
                ...row,
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata
            }));
            console.log(`[DEBUG] Media query success: returned ${media.length} items`);
            res.json(media);
        } catch (parseErr) {
            console.error('[JSON ERROR] Metadata parse fail:', parseErr.message);
            res.json(rows);
        }
    });
});

app.post('/api/media', (req, res) => {
    // ✨ 嚴格提取字段
    let { 
        id, member_id, family_tree_id, file_path, media_type, 
        title, description, photo_date, uploaded_by, metadata, is_featured 
    } = req.body;
    
    // 🛡️ 雙重保險：如果 photo_date 為空，嘗試從 metadata 字符串解析
    if (!photo_date && metadata) {
        try {
            const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            if (meta.photo_date) photo_date = meta.photo_date;
        } catch (e) {}
    }
    
    console.log('[API/POST] Final photo_date at write:', photo_date);
    
    const upload_date = new Date().toISOString();

    // ✨ 確保字段與值絕對對齊 (12個字段)
    const sql = `INSERT INTO media (
        id, member_id, family_tree_id, file_path, media_type, 
        title, description, photo_date, upload_date, uploaded_by, 
        metadata, is_featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        id, member_id, family_tree_id, file_path, media_type, 
        title, description, photo_date, upload_date, uploaded_by, 
        metadata, is_featured ? 1 : 0
    ];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('[DATABASE ERROR] Insert media fail:', err.message);
            return res.status(400).json({ error: err.message });
        }
        console.log(`[API/POST] Successfully saved media: ${id}, rowid: ${this.lastID}`);
        res.json({
            message: "success",
            data: req.body,
            id: this.lastID
        });
    });
});

// 🙏 祭奠儀式相關 API (Memorial Rituals)

// 獲取位成員的祭奠統計與最近留言
app.get('/api/memorial/rituals/:memberId', (req, res) => {
    const { memberId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const statsSql = `
        SELECT 
            COUNT(*) as total_count,
            SUM(CASE WHEN ritual_date LIKE ? THEN 1 ELSE 0 END) as today_count
        FROM memorial_rituals 
        WHERE member_id = ?
    `;
    
    const messagesSql = `
        SELECT r.*, u.username, u.full_name 
        FROM memorial_rituals r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.member_id = ? 
        ORDER BY r.ritual_date DESC 
        LIMIT 20
    `;

    db.get(statsSql, [`${today}%`, memberId], (err, stats) => {
        if (err) return res.status(400).json({ error: err.message });
        
        db.all(messagesSql, [memberId], (err, messages) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({
                stats: stats || { total_count: 0, today_count: 0 },
                recent_messages: messages || []
            });
        });
    });
});

// 記錄新的祭奠儀式
app.post('/api/memorial/rituals', authenticateToken, (req, res) => {
    // 兼容處理前端可能發送的不同命名的字段
    const member_id = req.body.member_id || req.body.memberId;
    const ritual_type = req.body.ritual_type || req.body.ritualType;
    const message = req.body.message;
    const user_id = req.user.userId || req.user.id; // 從 Token 中獲取
    const ritual_date = new Date().toISOString();

    if (!member_id) {
        return res.status(400).json({ error: 'member_id is required' });
    }

    const sql = `
        INSERT INTO memorial_rituals (member_id, user_id, ritual_type, ritual_date, message)
        VALUES (?, ?, ?, ?, ?)
    `;
    const params = [member_id, user_id, ritual_type, ritual_date, message];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('[Ritual/POST] DB Error:', err.message);
            return res.status(400).json({ error: err.message });
        }
        res.json({
            id: this.lastID,
            message: 'Ritual logged successfully'
        });
    });
});

// 📸 獲取媒體资源 (Media API)
// 獲取用戶儲存空間狀態 (Storage Quota API)
app.get('/api/user/storage', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { family_tree_id } = req.query;

    db.get('SELECT member_level, storage_limit_mb, fair_use_limit_mb, used_storage_kb FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // 如果提供了家族樹 ID，同步計算家族總佔用
        if (family_tree_id) {
            db.get(`
                SELECT SUM(CAST(json_extract(metadata, '$.size') AS INTEGER)) as tree_used 
                FROM media WHERE family_tree_id = ? AND is_deleted = 0`, [family_tree_id], (err, tree) => {
                
                db.get('SELECT storage_limit_mb FROM family_trees WHERE id = ?', [family_tree_id], (err, treeLimit) => {
                    res.json({
                        user: {
                            level: user.member_level || 'Basic',
                            used_kb: user.used_storage_kb || 0,
                            personal_limit_mb: user.fair_use_limit_mb || 50,
                            system_limit_mb: user.storage_limit_mb || 500
                        },
                        family: {
                            id: family_tree_id,
                            used_bytes: tree?.tree_used || 0,
                            limit_mb: treeLimit?.storage_limit_mb || 200
                        }
                    });
                });
            });
        } else {
            res.json({
                user: {
                    level: user.member_level || 'Basic',
                    used_kb: user.used_storage_kb || 0,
                    personal_limit_mb: user.fair_use_limit_mb || 50,
                    system_limit_mb: user.storage_limit_mb || 500
                }
            });
        }
    });
});

// Update media metadata (description, photo_date, etc.)
app.put('/api/media/:id', optionalAuth, (req, res) => {
    const mediaId = req.params.id;
    const { description, photo_date, metadata } = req.body;
    
    console.log('[Update Media] Request:', { mediaId, description, photo_date });
    
    // Build dynamic SQL based on provided fields
    const updates = [];
    const params = [];
    
    if (description !== undefined) {
        updates.push("description = ?");
        params.push(description);
    }
    
    if (photo_date !== undefined) {
        updates.push("photo_date = ?");
        params.push(photo_date);
    }
    
    if (metadata !== undefined) {
        updates.push("metadata = ?");
        params.push(typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(mediaId);
    const sql = `UPDATE media SET ${updates.join(', ')} WHERE id = ?`;
    
    console.log('[Update Media] SQL:', sql);
    console.log('[Update Media] Params:', params);
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error('[Update Media] Error:', err.message);
            res.status(400).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Media not found' });
            return;
        }
        res.json({
            success: true,
            message: 'Media updated successfully',
            changes: this.changes
        });
    });
});

// File upload endpoint for biography images and avatars
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    const userId = req.user.userId;
    const familyTreeId = req.body.family_tree_id;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileSizeKb = Math.ceil(req.file.size / 1024);

    // ✨ [QUOTA CHECK] 雙重空間檢查
    db.get('SELECT used_storage_kb, fair_use_limit_mb FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: 'User lookup failed' });
        }

        // 1. 個人公平限額檢查
        if (user.used_storage_kb + fileSizeKb > user.fair_use_limit_mb * 1024) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: `個人空間已達上限 (${user.fair_use_limit_mb}MB)` });
        }

        // 2. 家族樹總量檢查 (如果是家族相冊上傳)
        if (familyTreeId && familyTreeId !== 'undefined') {
            db.get('SELECT storage_limit_mb FROM family_trees WHERE id = ?', [familyTreeId], (err, tree) => {
                const treeLimit = (tree?.storage_limit_mb || 200) * 1024 * 1024;
                db.get('SELECT SUM(CAST(json_extract(metadata, \'$.size\') AS INTEGER)) as treeUsed FROM media WHERE family_tree_id = ?', [familyTreeId], (err, usage) => {
                    if ((usage?.treeUsed || 0) + req.file.size > treeLimit) {
                        fs.unlinkSync(req.file.path);
                        return res.status(403).json({ error: '家族存儲空間已達上限' });
                    }
                    proceedWithUpload();
                });
            });
        } else {
            proceedWithUpload();
        }
    });

    async function proceedWithUpload() {
        // ... 原有的處理邏輯 (壓縮等) ...
        // 注意：這裡需要更新 used_storage_kb
        db.run('UPDATE users SET used_storage_kb = used_storage_kb + ? WHERE id = ?', [fileSizeKb, userId]);
        
        console.log('[Upload] Processing upload for user:', userId);
    
    try {
        const uploadType = req.body.type || 'image';
        const filePath = req.file.path;
        const fileUrl = `/uploads/${req.file.filename}`;
        
        // For avatar uploads, create compressed versions
        if (uploadType === 'avatar') {
            console.log('[Upload] Processing avatar upload...');
            
            try {
                // Try to use sharp for image processing if available
                const sharp = require('sharp');
                const path = require('path');
                const fs = require('fs');
                
                // Create avatar directory if not exists
                const avatarDir = path.join(uploadDir, 'avatars');
                if (!fs.existsSync(avatarDir)) {
                    fs.mkdirSync(avatarDir, { recursive: true });
                }
                
                // Generate avatar filenames
                const baseName = path.parse(req.file.filename).name;
                const avatar40Path = path.join(avatarDir, `${baseName}_40x40.jpg`);
                const avatar200Path = path.join(avatarDir, `${baseName}_200x200.jpg`);
                
                // Create 40x40 avatar (small thumbnail)
                await sharp(filePath)
                    .resize(40, 40, { fit: 'cover', position: 'center' })
                    .jpeg({ quality: 80 })
                    .toFile(avatar40Path);
                
                // Create 200x200 avatar (medium size for profile page)
                await sharp(filePath)
                    .resize(200, 200, { fit: 'cover', position: 'center' })
                    .jpeg({ quality: 85 })
                    .toFile(avatar200Path);
                
                console.log('[Upload] Avatar compressed successfully');
                
                // Return the 200x200 avatar URL as main avatar
                const avatarUrl = `/uploads/avatars/${baseName}_200x200.jpg`;
                
                res.json({
                    success: true,
                    url: avatarUrl,
                    avatar40: `/uploads/avatars/${baseName}_40x40.jpg`,
                    avatar200: avatarUrl,
                    original: fileUrl,
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                });
                return;
                
            } catch (sharpError) {
                // If sharp is not available or fails, return original file
                console.log('[Upload] Sharp not available, using original file:', sharpError.message);
                res.json({
                    success: true,
                    url: fileUrl,
                    filename: req.file.filename,
                    originalname: req.file.originalname,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    note: 'Image compression not available'
                });
                return;
            }
        }
        
        // For regular biography images, limit size
        if (uploadType === 'image' || uploadType === 'biography') {
            try {
                const sharp = require('sharp');
                const path = require('path');
                const fs = require('fs');
                
                // Check image dimensions
                const metadata = await sharp(filePath).metadata();
                console.log('[Upload] Image dimensions:', metadata.width, 'x', metadata.height);
                
                // If image is too large, resize it (max 1200px width for biography)
                if (metadata.width > 1200 || metadata.height > 1200) {
                    console.log('[Upload] Image too large, resizing...');
                    
                    const baseName = path.parse(req.file.filename).name;
                    const ext = path.parse(req.file.filename).ext;
                    const resizedPath = path.join(uploadDir, `${baseName}_resized${ext}`);
                    
                    await sharp(filePath)
                        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toFile(resizedPath);
                    
                    // Delete original large file
                    fs.unlinkSync(filePath);
                    
                    const resizedUrl = `/uploads/${baseName}_resized${ext}`;
                    
                    res.json({
                        success: true,
                        url: resizedUrl,
                        filename: `${baseName}_resized${ext}`,
                        originalname: req.file.originalname,
                        size: req.file.size,
                        mimetype: req.file.mimetype,
                        resized: true
                    });
                    return;
                }
            } catch (sharpError) {
                console.log('[Upload] Sharp processing skipped:', sharpError.message);
            }
        }
        
        // Default response for regular uploads
        console.log('[Upload] File saved to:', fileUrl);
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        
        } catch (error) {
            console.error('[Upload] Error processing upload:', error);
            res.status(500).json({ error: 'Upload processing failed: ' + error.message });
        }
    }
});

// Delete uploaded image file
app.delete('/api/upload/:filename', authenticateToken, (req, res) => {
    try {
        // Decode filename to handle spaces (%20)
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(uploadDir, filename);
        
        console.log('[Delete] Attempting to delete file:', filename);
        
        // Security check
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename security violation' });
        }
        
        if (fs.existsSync(filePath)) {
            // ✨ [QUOTA REFUND] 刪除時返還可用空間
            const stats = fs.statSync(filePath);
            const sizeKb = Math.ceil(stats.size / 1024);
            const userId = req.user.userId;
            
            fs.unlinkSync(filePath);
            db.run('UPDATE users SET used_storage_kb = MAX(0, used_storage_kb - ?) WHERE id = ?', [sizeKb, userId]);
            
            res.json({ success: true, message: 'File deleted and quota updated' });
            
            // Cleanup avatars if they exist
            const baseName = path.parse(filename).name;
            const avatars = [
                path.join(uploadDir, 'avatars', `${baseName}_40x40.jpg`),
                path.join(uploadDir, 'avatars', `${baseName}_200x200.jpg`)
            ];
            avatars.forEach(av => {
                if (fs.existsSync(av)) fs.unlinkSync(av);
            });
            
            res.json({ success: true });
        } else {
            console.warn('[Delete] File not found on disk:', filePath);
            res.status(404).json({ error: 'File not found' });
        }
    } catch (err) {
        console.error('[Delete] System error:', err);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Error handling for file uploads
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('[Upload] Multer error:', err.message);
        return res.status(400).json({ error: err.message });
    } else if (err) {
        console.error('[Upload] General error:', err.message);
        return res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
    next();
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Global Error]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// Face Embeddings API Endpoints
app.post('/api/face-embeddings', (req, res) => {
    const { id, media_id, member_id, embedding_data, bounding_box, confidence } = req.body;
    const created_at = new Date().toISOString();

    const sql = "INSERT INTO face_embeddings (id, media_id, member_id, embedding_data, bounding_box, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const params = [id, media_id, member_id, embedding_data, bounding_box, confidence, created_at];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

app.get('/api/face-embeddings/:media_id', (req, res) => {
    const sql = `
        SELECT f.*, m.name as member_name, m.birth_date as member_birth_date 
        FROM face_embeddings f
        LEFT JOIN members m ON f.member_id = m.id
        WHERE f.media_id = ?
    `;
    db.all(sql, [req.params.media_id], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.delete('/api/face-embeddings/:tag_id', authenticateToken, (req, res) => {
    const tagId = req.params.tag_id;
    
    db.run("DELETE FROM face_embeddings WHERE id = ?", [tagId], function(err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ "error": "Tag not found" });
            return;
        }
        res.json({
            "message": "Face embedding deleted successfully",
            "changes": this.changes
        });
    });
});

// Family Trees API Endpoints
app.get('/api/family-trees', (req, res) => {
    db.all("SELECT * FROM family_trees", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/family-trees', (req, res) => {
    const { id, name, description, created_by, is_public, password, cover_image } = req.body;
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    const sql = "INSERT INTO family_trees (id, name, description, created_by, created_at, updated_at, is_public, password, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, name, description, created_by, created_at, updated_at, is_public ? 1 : 0, password, cover_image];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// Users API Endpoints
app.get('/api/users', (req, res) => {
    db.all("SELECT id, username, email, full_name, phone, avatar, created_at, last_login, is_active FROM users", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
    const { id, username, email, password_hash, full_name, phone, avatar } = req.body;
    const created_at = new Date().toISOString();
    const is_active = 1;

    const sql = "INSERT INTO users (id, username, email, password_hash, full_name, phone, avatar, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, username, email, password_hash, full_name, phone, avatar, created_at, is_active];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// User-Family Tree Relations API Endpoints
app.get('/api/user-family-trees/:user_id', (req, res) => {
    const sql = `
        SELECT uft.*, ft.name as family_tree_name 
        FROM user_family_trees uft 
        JOIN family_trees ft ON uft.family_tree_id = ft.id 
        WHERE uft.user_id = ?
    `;

    db.all(sql, [req.params.user_id], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/user-family-trees', (req, res) => {
    const { user_id, family_tree_id, role } = req.body;
    const joined_at = new Date().toISOString();

    const sql = "INSERT INTO user_family_trees (user_id, family_tree_id, role, joined_at) VALUES (?, ?, ?, ?)";
    const params = [user_id, family_tree_id, role, joined_at];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// Marriages API Endpoints
app.get('/api/marriages', (req, res) => {
    db.all("SELECT * FROM marriages", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/marriages', (req, res) => {
    let { id, husband_id, wife_id, marriage_date, marriage_year, marriage_month,
        marriage_day, marriage_calendar, divorce_date, is_divorced, notes } = req.body;

    // ✨ 自動生成 ID 防止主鍵為空
    const finalId = id || `marriage_${husband_id}_${wife_id}_${Date.now()}`;

    const sql = "INSERT INTO marriages (id, husband_id, wife_id, marriage_date, marriage_year, marriage_month, marriage_day, marriage_calendar, divorce_date, is_divorced, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [finalId, husband_id, wife_id, marriage_date, marriage_year, marriage_month, marriage_day, marriage_calendar, divorce_date, is_divorced ? 1 : 0, notes];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// Health Records API Endpoints
app.get('/api/health-records/:member_id', (req, res) => {
    db.all("SELECT * FROM health_records WHERE member_id = ?", [req.params.member_id], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/health-records', (req, res) => {
    const { id, member_id, height, weight, blood_type, medical_conditions,
        allergies, medications, last_checkup_date, doctor, notes } = req.body;
    const updated_at = new Date().toISOString();

    const sql = "INSERT INTO health_records (id, member_id, height, weight, blood_type, medical_conditions, allergies, medications, last_checkup_date, doctor, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, member_id, height, weight, blood_type, medical_conditions, allergies, medications, last_checkup_date, doctor, notes, updated_at];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id": this.lastID
        });
    });
});

// Add CSV import endpoint
app.post('/api/import/csv', upload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    let rowCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            results.push(data);
            rowCount++;
        })
        .on('end', async () => {
            // Process each row
            for (const row of results) {
                try {
                    // Validate required fields
                    if (!row.id || !row.name) {
                        errors.push(`Row ${rowCount}: Missing required fields (id, name)`);
                        errorCount++;
                        continue;
                    }

                    // Prepare data for insertion
                    const memberData = {
                        id: row.id,
                        family_tree_id: row.family_tree_id || null,
                        name: row.name,
                        gender: row.gender || null,
                        spouses: row.spouses ? JSON.parse(row.spouses) : [],
                        children: row.children ? JSON.parse(row.children) : [],
                        parents: row.parents ? JSON.parse(row.parents) : [],
                        birth_date: row.birth_date || null,
                        birth_year: row.birth_year ? parseInt(row.birth_year) : null,
                        birth_month: row.birth_month ? parseInt(row.birth_month) : null,
                        birth_day: row.birth_day ? parseInt(row.birth_day) : null,
                        birth_calendar: row.birth_calendar || null,
                        death_date: row.death_date || null,
                        death_year: row.death_year ? parseInt(row.death_year) : null,
                        death_month: row.death_month ? parseInt(row.death_month) : null,
                        death_day: row.death_day ? parseInt(row.death_day) : null,
                        death_calendar: row.death_calendar || null,
                        is_deceased: row.is_deceased ? parseInt(row.is_deceased) : 0,
                        phone: row.phone || null,
                        address: row.address || null,
                        remark: row.remark || null,
                        generation: row.generation ? parseInt(row.generation) : null,
                        clan_name: row.clan_name || null,
                        ancestral_home: row.ancestral_home || null,
                        courtesy_name: row.courtesy_name || null,
                        pseudonym: row.pseudonym || null,
                        aliases: row.aliases ? JSON.parse(row.aliases) : [],
                        education: row.education || null,
                        occupation: row.occupation || null,
                        achievements: row.achievements ? JSON.parse(row.achievements) : []
                    };

                    // Check if member already exists
                    const existingMember = await new Promise((resolve, reject) => {
                        db.get("SELECT id FROM members WHERE id = ?", [row.id], (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        });
                    });

                    if (existingMember) {
                        // Update existing member
                        const updateSql = `UPDATE members SET 
                            family_tree_id = ?, name = ?, gender = ?, spouses = ?, children = ?, parents = ?,
                            birth_date = ?, birth_year = ?, birth_month = ?, birth_day = ?, birth_calendar = ?,
                            death_date = ?, death_year = ?, death_month = ?, death_day = ?, death_calendar = ?,
                            is_deceased = ?, phone = ?, address = ?, remark = ?, generation = ?, clan_name = ?,
                            ancestral_home = ?, courtesy_name = ?, pseudonym = ?, aliases = ?, education = ?,
                            occupation = ?, achievements = ?
                            WHERE id = ?`;

                        const updateParams = [
                            memberData.family_tree_id, memberData.name, memberData.gender,
                            JSON.stringify(memberData.spouses), JSON.stringify(memberData.children), JSON.stringify(memberData.parents),
                            memberData.birth_date, memberData.birth_year, memberData.birth_month, memberData.birth_day, memberData.birth_calendar,
                            memberData.death_date, memberData.death_year, memberData.death_month, memberData.death_day, memberData.death_calendar,
                            memberData.is_deceased, memberData.phone, memberData.address, memberData.remark,
                            memberData.generation, memberData.clan_name, memberData.ancestral_home,
                            memberData.courtesy_name, memberData.pseudonym, JSON.stringify(memberData.aliases),
                            memberData.education, memberData.occupation, JSON.stringify(memberData.achievements),
                            row.id
                        ];

                        await new Promise((resolve, reject) => {
                            db.run(updateSql, updateParams, function (err) {
                                if (err) reject(err);
                                else resolve(this.changes);
                            });
                        });
                    } else {
                        // Insert new member
                        const insertSql = `INSERT INTO members (
                            id, family_tree_id, name, gender, spouses, children, parents,
                            birth_date, birth_year, birth_month, birth_day, birth_calendar,
                            death_date, death_year, death_month, death_day, death_calendar,
                            is_deceased, phone, address, remark, generation, clan_name,
                            ancestral_home, courtesy_name, pseudonym, aliases, education,
                            occupation, achievements
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                        const insertParams = [
                            memberData.id, memberData.family_tree_id, memberData.name, memberData.gender,
                            JSON.stringify(memberData.spouses), JSON.stringify(memberData.children), JSON.stringify(memberData.parents),
                            memberData.birth_date, memberData.birth_year, memberData.birth_month, memberData.birth_day, memberData.birth_calendar,
                            memberData.death_date, memberData.death_year, memberData.death_month, memberData.death_day, memberData.death_calendar,
                            memberData.is_deceased, memberData.phone, memberData.address, memberData.remark,
                            memberData.generation, memberData.clan_name, memberData.ancestral_home,
                            memberData.courtesy_name, memberData.pseudonym, JSON.stringify(memberData.aliases),
                            memberData.education, memberData.occupation, JSON.stringify(memberData.achievements)
                        ];

                        await new Promise((resolve, reject) => {
                            db.run(insertSql, insertParams, function (err) {
                                if (err) reject(err);
                                else resolve(this.lastID);
                            });
                        });
                    }

                    successCount++;
                } catch (error) {
                    errors.push(`Row ${rowCount}: ${error.message}`);
                    errorCount++;
                }
            }

            // Clean up uploaded file
            fs.unlinkSync(req.file.path);

            // Return results
            res.json({
                message: 'CSV import completed',
                totalRows: rowCount,
                successful: successCount,
                errors: errorCount,
                errorDetails: errors
            });
        })
        .on('error', (error) => {
            // Clean up uploaded file
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                error: 'Error processing CSV file',
                details: error.message
            });
        });
});

// Handle SPA routing - return index.html for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// ========== 尋親啟事 API ==========

// 獲取所有尋親帖子
app.get('/api/reunion', optionalAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let sql = `
      SELECT rp.*, u.full_name as author_name, u.family_id
      FROM reunion_posts rp
      LEFT JOIN users u ON rp.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      sql += ' AND rp.status = ?';
      params.push(status);
    }
    
    if (search) {
      sql += ' AND (rp.title LIKE ? OR rp.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY rp.created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching reunion posts:', err);
        return res.status(500).json({ error: 'Failed to fetch posts' });
      }
      res.json(rows || []);
    });
  } catch (error) {
    console.error('Error in /api/reunion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 創建新的尋親帖子
app.post('/api/reunion', authenticateToken, async (req, res) => {
  try {
    const { title, description, contact, status = 'searching' } = req.body;
    
    // 調試：打印用戶信息
    console.log('[DEBUG] Creating post - User:', req.user);
    
    if (!title || !description) {
      return res.status(400).json({ error: '標題和描述不能為空' });
    }
    
    if (!req.user || !req.user.id) {
      console.error('[ERROR] No user in request');
      return res.status(401).json({ error: '未授權：用戶信息缺失' });
    }
    
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.user.id;
    const now = new Date().toISOString();
    
    console.log('[DEBUG] Inserting post with user_id:', userId);
    
    const sql = `
      INSERT INTO reunion_posts (id, title, description, contact, status, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [postId, title, description, contact || '', status, userId, now, now], function(err) {
      if (err) {
        console.error('Error creating post:', err);
        return res.status(500).json({ error: 'Failed to create post' });
      }
      
      // 返回創建的帖子（包含作者信息）
      const selectSql = `
        SELECT rp.*, u.full_name as author_name, u.family_id
        FROM reunion_posts rp
        LEFT JOIN users u ON rp.user_id = u.id
        WHERE rp.id = ?
      `;
      
      db.get(selectSql, [postId], (err, row) => {
        if (err) {
          console.error('Error fetching created post:', err);
          return res.status(500).json({ error: 'Post created but failed to fetch' });
        }
        console.log('[DEBUG] Created post:', row);
        res.status(201).json(row);
      });
    });
  } catch (error) {
    console.error('Error in POST /api/reunion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新帖子
app.put('/api/reunion/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, description, contact, status } = req.body;
    
    // 檢查權限
    const checkSql = 'SELECT user_id FROM reunion_posts WHERE id = ?';
    db.get(checkSql, [postId], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: '帖子不存在' });
      }
      
      // 檢查是否為作者或管理員
      const isAuthor = row.user_id === req.user.id;
      const isAdmin = req.user.role === 'family_admin' || req.user.role === 'super_admin';
      
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ error: '無權修改此帖子' });
      }
      
      // 更新帖子
      const updateSql = `
        UPDATE reunion_posts
        SET title = ?, description = ?, contact = ?, status = ?, updated_at = ?
        WHERE id = ?
      `;
      
      const now = new Date().toISOString();
      db.run(updateSql, [title, description, contact, status, now, postId], function(err) {
        if (err) {
          console.error('Error updating post:', err);
          return res.status(500).json({ error: 'Failed to update post' });
        }
        
        // 返回更新後的帖子
        const selectSql = `
          SELECT rp.*, u.full_name as author_name, u.family_id
          FROM reunion_posts rp
          LEFT JOIN users u ON rp.user_id = u.id
          WHERE rp.id = ?
        `;
        
        db.get(selectSql, [postId], (err, row) => {
          if (err) {
            console.error('Error fetching updated post:', err);
            return res.status(500).json({ error: 'Post updated but failed to fetch' });
          }
          res.json(row);
        });
      });
    });
  } catch (error) {
    console.error('Error in PUT /api/reunion/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 刪除帖子
app.delete('/api/reunion/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    
    // 檢查帖子是否存在及權限
    const checkSql = 'SELECT user_id FROM reunion_posts WHERE id = ?';
    db.get(checkSql, [postId], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: '帖子不存在' });
      }
      
      // 檢查權限：作者、家族管理員（同家族）、超級管理員
      const isAuthor = row.user_id === req.user.id;
      const isSuperAdmin = req.user.role === 'super_admin';
      
      // 家族管理員需要檢查是否同家族
      let isFamilyAdmin = false;
      if (req.user.role === 'family_admin') {
        // 獲取帖子的 family_id
        const familyCheckSql = `
          SELECT u.family_id FROM reunion_posts rp
          JOIN users u ON rp.user_id = u.id
          WHERE rp.id = ?
        `;
        db.get(familyCheckSql, [postId], (err, familyRow) => {
          if (!err && familyRow) {
            isFamilyAdmin = familyRow.family_id === req.user.family_id;
          }
        });
      }
      
      if (!isAuthor && !isSuperAdmin && !isFamilyAdmin) {
        return res.status(403).json({ error: '無權刪除此帖子' });
      }
      
      // 刪除帖子
      db.run('DELETE FROM reunion_posts WHERE id = ?', [postId], function(err) {
        if (err) {
          console.error('Error deleting post:', err);
          return res.status(500).json({ error: 'Failed to delete post' });
        }
        res.json({ message: '帖子已刪除' });
      });
    });
  } catch (error) {
    console.error('Error in DELETE /api/reunion/:id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== 我的家族樹 API ==========

// 獲取我的家族樹（包含所有相關成員）
app.get('/api/my-family-tree', authenticateToken, async (req, res) => {
  try {
    const { include_related = 'false' } = req.query;
    const userId = req.user.userId;
    
    // 獲取用戶信息
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: '用戶不存在' });
    }
    
    // 解析用戶的家族ID - 從 user_family_trees 表獲取
    const userFamilies = await new Promise((resolve, reject) => {
      db.all('SELECT family_tree_id, role FROM user_family_trees WHERE user_id = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // 選擇家族的智能邏輯(關鍵!)
    let familyId = req.query.family_id || req.query.primaryFamily; // 優先使用URL參數，支援多種命名方式
    const viewMemberId = req.query.view_member_id;

    // 如果沒有傳入 family_id 但有 view_member_id，嘗試根據成員尋找所屬家族
    if (!familyId && viewMemberId) {
      const perspectiveMember = await new Promise((resolve) => {
        db.get('SELECT primaryFamily, families FROM members WHERE id = ?', [viewMemberId], (err, row) => {
          resolve(row);
        });
      });

      if (perspectiveMember) {
        familyId = perspectiveMember.primaryFamily;
      }
    }
    
    console.log('[/api/my-family-tree] 請求參數:', req.query);
    console.log('[/api/my-family-tree] 決定使用的 family_id:', familyId);
    console.log('[/api/my-family-tree] 用戶的家族:', userFamilies);
    
    if (!familyId && userFamilies.length > 0) {
      // 1. 優先選擇: 有管理權限的真實家族(非_native)
      const adminRealFamily = userFamilies.find(f => 
        (f.role === 'admin' || f.role === 'family_admin') && 
        !f.family_tree_id.endsWith('_native')
      );
      
      if (adminRealFamily) {
        familyId = adminRealFamily.family_tree_id;
      } else {
        // 2. 否則選擇第一個真實家族
        const realFamily = userFamilies.find(f => !f.family_tree_id.endsWith('_native'));
        familyId = realFamily ? realFamily.family_tree_id : userFamilies[0].family_tree_id;
      }
    }
    
    if (!familyId) {
      // 用戶還沒有加入任何家族，返回空數據而不是錯誤
      return res.json({
        success: true,
        family_info: null,
        members: [],
        view_member_id: userId,
        message: '用戶還沒有加入任何家族'
      });
    }
    
    // 獲取家族信息
    const family = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM family_trees WHERE id = ?', [familyId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!family) {
      return res.status(404).json({ error: '家族不存在' });
    }
    
    // 獲獲獲成員(使用json_each精確匹配families數組)
    let members = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DISTINCT m.* 
        FROM members m
        WHERE m.primaryFamily = ?
           OR EXISTS (SELECT 1 FROM json_each(m.families) WHERE value = ?)
      `, [familyId, familyId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // 如果include_related=true,還包含姻親等相關成員
    if (include_related === 'true') {
      // 獲取所有families包含此家族ID的成員
      const relatedMembers = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM members WHERE families LIKE ?', [`%${familyId}%`], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // 合併並去重
      const memberMap = new Map();
      members.forEach(m => memberMap.set(m.id, m));
      relatedMembers.forEach(m => memberMap.set(m.id, m));
      members = Array.from(memberMap.values());
    }
    
    // 解析 JSON 字段（parents, spouses, families 等）
    members = members.map(m => {
      try {
        return {
          ...m,
          parents: m.parents ? (typeof m.parents === 'string' ? JSON.parse(m.parents) : m.parents) : [],
          spouses: m.spouses ? (typeof m.spouses === 'string' ? JSON.parse(m.spouses) : m.spouses) : [],
          children: m.children ? (typeof m.children === 'string' ? JSON.parse(m.children) : m.children) : [],
          families: m.families ? (typeof m.families === 'string' ? JSON.parse(m.families) : m.families) : []
        };
      } catch (e) {
        console.error(`[Error] Failed to parse member ${m.id}:`, e);
        return m;
      }
    });
    
    res.json({
      success: true,
      family_info: family,
      members,
      view_member_id: userId
    });
    
  } catch (error) {
    console.error('[My Family Tree] Error:', error);
    res.status(500).json({ error: '獲取家族樹失敗: ' + error.message });
  }
});

// ========== 批量管理家族標簽 API ==========

// 預覽批量更新家族標簽
app.post('/api/family/batch-labels/preview', authenticateToken, async (req, res) => {
  try {
    const { memberIds, operation, targetFamilyId } = req.body;
    
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: '請提供成員ID列表' });
    }
    
    if (!targetFamilyId || !targetFamilyId.trim()) {
      return res.status(400).json({ error: '請提供目標家族ID' });
    }
    
    if (!['add', 'remove', 'replace'].includes(operation)) {
      return res.status(400).json({ error: '無效的操作類型' });
    }
    
    const changes = [];
    
    // 獲取每個成員的當前狀態
    for (const memberId of memberIds) {
      const member = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!member) {
        changes.push({
          memberId,
          memberName: '未知成員',
          error: '成員不存在'
        });
        continue;
      }
      
      // 解析當前families
      let currentFamilies = [];
      if (member.families) {
        try {
          currentFamilies = JSON.parse(member.families);
        } catch (e) {
          currentFamilies = [];
        }
      }
      
      const before = currentFamilies.length > 0 ? JSON.stringify(currentFamilies) : '[]';
      let newFamilies = [...currentFamilies];
      
      // 根據操作類型處理
      switch (operation) {
        case 'add':
          if (!newFamilies.includes(targetFamilyId)) {
            newFamilies.push(targetFamilyId);
          }
          break;
        case 'remove':
          newFamilies = newFamilies.filter(fid => fid !== targetFamilyId);
          break;
        case 'replace':
          newFamilies = [targetFamilyId];
          break;
      }
      
      const after = newFamilies.length > 0 ? JSON.stringify(newFamilies) : '[]';
      
      changes.push({
        memberId,
        memberName: member.name,
        before,
        after,
        changed: before !== after
      });
    }
    
    // 只返回實際變更的成員
    const affectedChanges = changes.filter(c => c.changed);
    
    res.json({
      success: true,
      affectedCount: affectedChanges.length,
      changes: affectedChanges
    });
    
  } catch (error) {
    console.error('[Batch Labels Preview] Error:', error);
    res.status(500).json({ error: '預覽失敗: ' + error.message });
  }
});

// 執行批量更新家族標簽
app.post('/api/family/batch-labels/execute', authenticateToken, async (req, res) => {
  try {
    const { memberIds, operation, targetFamilyId } = req.body;
    
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: '請提供成員ID列表' });
    }
    
    if (!targetFamilyId || !targetFamilyId.trim()) {
      return res.status(400).json({ error: '請提供目標家族ID' });
    }
    
    if (!['add', 'remove', 'replace'].includes(operation)) {
      return res.status(400).json({ error: '無效的操作類型' });
    }
    
    // 檢查用戶權限（需要是管理員）
    const userId = req.user.userId;
    
    // ✅ 從 user_family_trees 表獲取用戶的家族權限
    const userFamilies = await new Promise((resolve, reject) => {
      db.all('SELECT family_tree_id, role FROM user_family_trees WHERE user_id = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // 檢查是否有至少一個家族的管理權限
    const hasAdminRole = userFamilies.some(f => 
      f.role === 'admin' || f.role === 'family_admin'
    );
    
    if (!hasAdminRole) {
      return res.status(403).json({ error: '權限不足，需要管理員權限' });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 批量更新每個成員
    for (const memberId of memberIds) {
      try {
        const member = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!member) {
          errorCount++;
          errors.push({ memberId, error: '成員不存在' });
          continue;
        }
        
        // 解析當前families
        let currentFamilies = [];
        if (member.families) {
          try {
            currentFamilies = JSON.parse(member.families);
          } catch (e) {
            currentFamilies = [];
          }
        }
        
        let newFamilies = [...currentFamilies];
        
        // 根據操作類型處理
        switch (operation) {
          case 'add':
            // 使用 Set 避免重複
            const familiesSet = new Set(currentFamilies);
            familiesSet.add(targetFamilyId);
            newFamilies = Array.from(familiesSet);
            break;
          case 'remove':
            newFamilies = newFamilies.filter(fid => fid !== targetFamilyId);
            break;
          case 'replace':
            newFamilies = [targetFamilyId];
            break;
        }
        
        // 更新數據庫(帶重試機制)
        console.log(`[Batch Labels] 準備更新成員 ${memberId} (${member.name}):`);
        console.log(`  操作: ${operation}`);
        console.log(`  目標家族: ${targetFamilyId}`);
        console.log(`  當前families: ${JSON.stringify(currentFamilies)}`);
        console.log(`  新families: ${JSON.stringify(newFamilies)}`);
        
        // ✅ 重試邏輯(最多3次,指數退避)
        let retries = 0;
        const maxRetries = 3;
        let updateSuccess = false;
        
        while (retries < maxRetries && !updateSuccess) {
          try {
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE members SET families = ? WHERE id = ?',
                [JSON.stringify(newFamilies), memberId],
                function(err) {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
            updateSuccess = true;
            console.log(`[Batch Labels] ✅ 數據庫更新成功, 影響行數: ${this.changes}`);
          } catch (err) {
            if (err.message.includes('SQLITE_BUSY') && retries < maxRetries - 1) {
              retries++;
              const delay = 100 * Math.pow(2, retries); // 100ms, 200ms, 400ms
              console.warn(`[Batch Labels] ⚠️ 數據庫被鎖, ${delay}ms後重試 (${retries}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw err;
            }
          }
        }
        
        if (!updateSuccess) {
          throw new Error('更新失敗：重試次數已用盡');
        }
        
        successCount++;
        
        // 記錄操作日誌
        console.log(`[Batch Labels] ${operation} ${targetFamilyId} to member ${memberId} (${member.name})`);
        console.log(`  Before: ${JSON.stringify(currentFamilies)}`);
        console.log(`  After: ${JSON.stringify(newFamilies)}`);
        
      } catch (memberError) {
        errorCount++;
        errors.push({ memberId, error: memberError.message });
        console.error(`[Batch Labels] Error updating member ${memberId}:`, memberError);
      }
    }
    
    // 記錄完整操作日誌
    console.log(`[Batch Labels] Operation completed by user ${userId}`);
    console.log(`  Operation: ${operation}`);
    console.log(`  Target Family: ${targetFamilyId}`);
    console.log(`  Members processed: ${memberIds.length}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    
    res.json({
      success: true,
      message: `批量更新完成：成功 ${successCount} 個，失敗 ${errorCount} 個`,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('[Batch Labels Execute] Error:', error);
    res.status(500).json({ error: '批量更新失敗: ' + error.message });
  }
});

// Start the server
const serverPort = process.env.PORT || port;
app.listen(serverPort, () => {
    console.log(`Server running on port ${serverPort}`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`Static files served from: ${staticPath}`);
        console.log(`Database path: ${dbPath}`);
        console.log(`Upload directory: ${uploadDir}`);
    }
});