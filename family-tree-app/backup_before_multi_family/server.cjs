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
  origin: ['http://localhost:5173', 'http://localhost:5174'],
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

// Serve static files - Support both local and Railway deployment
const staticPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'family-tree-app/dist')
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
      user_id TEXT             -- 關聯的用戶 ID（用於登入系統）
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
                    `ALTER TABLE members ADD COLUMN created_at TEXT`,
                    `ALTER TABLE members ADD COLUMN father_id TEXT`,
                    `ALTER TABLE members ADD COLUMN mother_id TEXT`,
                    `ALTER TABLE members ADD COLUMN surname TEXT`
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
      surname TEXT,              -- 家族姓氏（如：陳、林、黃）
      ancestral_home TEXT,       -- 祖籍位置（如：福建泉州）
      hall_name TEXT,            -- 堂號（如：潁川堂）
      description TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      is_public INTEGER DEFAULT 0,
      password TEXT,
      cover_image TEXT,
      invite_code TEXT,
      invite_code_expires_at TEXT
    )`, (err) => {
            if (err) {
                console.error('Error creating family_trees table', err.message);
            } else {
                // 添加新字段（如果表已存在）
                const alterStatements = [
                    `ALTER TABLE family_trees ADD COLUMN invite_code TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN invite_code_expires_at TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN surname TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN ancestral_home TEXT`,
                    `ALTER TABLE family_trees ADD COLUMN hall_name TEXT`
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
      invited_by TEXT,           -- 邀請人 ID
      invite_code_used TEXT,     -- 使用的邀請碼
      linkedMemberId TEXT        -- 關聯的成員 ID
    )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                // 添加缺失的字段（如果表已存在）
                db.run(`ALTER TABLE users ADD COLUMN linkedMemberId TEXT`, (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Error adding linkedMemberId column:', err.message);
                    }
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

        // Create member_spouses table (replaces spouse_id field)
        db.run(`CREATE TABLE IF NOT EXISTS member_spouses (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      spouse_member_id TEXT NOT NULL,
      marriage_date TEXT,
      divorce_date TEXT,
      is_current INTEGER DEFAULT 1,
      children_ids TEXT,
      created_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (spouse_member_id) REFERENCES members(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating member_spouses table', err.message);
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

        // Create generation_names table
        db.run(`CREATE TABLE IF NOT EXISTS generation_names (
      id TEXT PRIMARY KEY,
      family_tree_id TEXT,
      generation_number INTEGER,
      character TEXT,
      meaning TEXT,
      created_at TEXT,
      FOREIGN KEY (family_tree_id) REFERENCES family_trees(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating generation_names table', err.message);
            }
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

        // Create change_history table
        db.run(`CREATE TABLE IF NOT EXISTS change_history (
      id TEXT PRIMARY KEY,
      family_tree_id TEXT,
      table_name TEXT,
      record_id TEXT,
      operation TEXT,
      old_values TEXT,
      new_values TEXT,
      changed_by TEXT,
      changed_at TEXT,
      FOREIGN KEY (family_tree_id) REFERENCES family_trees(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    )`, (err) => {
            if (err) {
                console.error('Error creating change_history table', err.message);
            }
        });

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
          status TEXT DEFAULT 'searching',
          visible_to_family_ids TEXT DEFAULT '[]'
        )`, (err) => {
            if (err) {
                console.error('Error creating reunion table', err.message);
            } else {
                // 添加新字段
                db.run(`ALTER TABLE reunion_posts ADD COLUMN visible_to_family_ids TEXT DEFAULT '[]'`, (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                        console.error('Error adding column:', err.message);
                    }
                });
            }
        });

        // Create Family Merge Requests table
        db.run(`CREATE TABLE IF NOT EXISTS family_merge_requests (
          id TEXT PRIMARY KEY,
          source_family_id TEXT NOT NULL,
          target_family_id TEXT NOT NULL,
          initiated_by TEXT NOT NULL,
          source_admin_approved INTEGER DEFAULT 0,
          target_admin_approved INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          conflict_resolution TEXT,
          created_at TEXT,
          completed_at TEXT,
          FOREIGN KEY (source_family_id) REFERENCES family_trees(id),
          FOREIGN KEY (target_family_id) REFERENCES family_trees(id)
        )`, (err) => {
            if (err) {
                console.error('Error creating family_merge_requests table:', err.message);
            }
        });

        // Create Family Merges table
        db.run(`CREATE TABLE IF NOT EXISTS family_merges (
          id TEXT PRIMARY KEY,
          source_family_id TEXT,
          target_family_id TEXT,
          new_family_id TEXT,
          merged_at TEXT,
          post_migration_log TEXT,
          memorial_migration_log TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating family_merges table:', err.message);
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
    const { family_tree_id, target_member_id, default_role = 'user', expires_in_days, max_uses } = req.body;
    
    // TODO: Check if user is admin
    const creatorId = req.user.userId;
    
    // Generate unique invite code
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invite_code = `CHEN_${timestamp}_${random}`;
    
    const id = `invite_${timestamp}`;
    const expires_at = expires_in_days 
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;
    
    const sql = `
        INSERT INTO invitations (id, invite_code, creator_id, family_tree_id, target_member_id, default_role, max_uses, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [id, invite_code, creatorId, family_tree_id, target_member_id, default_role, max_uses, expires_at, new Date().toISOString(), new Date().toISOString()], function(err) {
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
                target_member_id,
                default_role,
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
    
    db.get(`SELECT * FROM invitations WHERE invite_code = ? AND is_active = 1`, [code], async (err, invitation) => {
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
                family_tree_name: invitation.family_tree_id === 'chen_family' ? '陳家族譜' : invitation.family_tree_id,
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
        
        // Link to member if target_member_id exists, otherwise auto-create member
        let linkedMemberId = null;
        if (invitation.target_member_id) {
            linkedMemberId = invitation.target_member_id;
            await new Promise((resolve, reject) => {
                db.run(`UPDATE members SET user_id = ? WHERE id = ?`, [userId, invitation.target_member_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } else {
            // Auto-create member for new user
            const memberId = `member_${Date.now()}`;
            const surname = name.charAt(0); // Extract surname from name
            
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO members (id, name, surname, gender, user_id, father_id, mother_id, created_at)
                    VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
                `, [memberId, name, surname, 'unknown', userId, new Date().toISOString()], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            linkedMemberId = memberId;
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

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    try {
        // Find user
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE email = ? AND is_active != 0`, [email], (err, row) => {
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
        
        // Get user's family trees and roles
        const familyTrees = await new Promise((resolve, reject) => {
            db.all(`SELECT family_tree_id, role FROM user_family_trees WHERE user_id = ?`, [user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get linked member ID
        const linkedMember = await new Promise((resolve, reject) => {
            db.get(`SELECT id as member_id FROM members WHERE user_id = ?`, [user.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Update last login
        db.run(`UPDATE users SET last_login = ? WHERE id = ?`, [new Date().toISOString(), user.id]);
        
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
                email: user.email,
                name: user.full_name,
                role: familyTrees[0]?.role || 'user',
                linkedMemberId: linkedMember?.member_id,
                familyTrees: familyTrees.map(ft => ft.family_tree_id)
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
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
        
        const familyTrees = await new Promise((resolve, reject) => {
            db.all(`SELECT family_tree_id, role FROM user_family_trees WHERE user_id = ?`, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const linkedMember = await new Promise((resolve, reject) => {
            db.get(`SELECT id as member_id FROM members WHERE user_id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            id: user.id,
            email: user.email,
            name: user.full_name,
            avatar: user.avatar,
            role: familyTrees[0]?.role || 'user',
            linkedMemberId: linkedMember?.member_id,
            familyTrees: familyTrees.map(ft => ft.family_tree_id),
            createdAt: user.created_at,
            lastLogin: user.last_login
        });
        
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get my family tree (auto-determine based on paternal family logic) - MUST be before /api/family
app.get('/api/my-family-tree', authenticateToken, async (req, res) => {
    console.log('[DEBUG] /api/my-family-tree called, userId:', req.user?.userId);
    try {
        const userId = req.user.userId;
        const { view_member_id, include_related } = req.query;
        console.log('[DEBUG] Query params:', { view_member_id, include_related });
        
        // Step 1: Get user's member record
        let userMember;
        if (view_member_id) {
            // Use specified view member
            userMember = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM members WHERE id = ?`, [view_member_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } else {
            // Get member linked to current user
            userMember = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM members WHERE user_id = ?`, [userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        
        if (!userMember) {
            return res.status(404).json({ 
                error: '未找到Member記錄',
                canCreateMember: true 
            });
        }
        
        // Step 2: Find paternal family (through father)
        let targetFamilyId = null;
        let isSpouseFamily = false;
        let viewContext = {
            view_member_id: userMember.id,
            view_member_name: userMember.name,
            is_spouse_family: false,
            can_create_family: false
        };
        
        if (userMember.father_id) {
            const father = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM members WHERE id = ?`, [userMember.father_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (father && father.family_tree_id) {
                targetFamilyId = father.family_tree_id;
            }
        }
        
        // Step 3: Use member's own family_tree_id ONLY if they have a father (native family member)
        // For married-in members (no father_id), don't use family_tree_id as it belongs to their spouse's family
        if (!targetFamilyId && userMember.family_tree_id && userMember.father_id) {
            targetFamilyId = userMember.family_tree_id;
        }
        
        // Step 4: Fallback to spouse's family ONLY for login user's own view
        // When viewing another member's perspective, don't fallback to their spouse's family
        if (!targetFamilyId && !view_member_id) {
            // Only for login user's own view, check spouse's family
            const currentSpouse = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT ms.*, m.name as spouse_name 
                    FROM member_spouses ms 
                    JOIN members m ON ms.spouse_member_id = m.id
                    WHERE ms.member_id = ? AND ms.is_current = 1
                `, [userMember.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (currentSpouse) {
                const spouseFather = await new Promise((resolve, reject) => {
                    db.get(`
                        SELECT m.family_tree_id 
                        FROM members m 
                        WHERE m.id = (SELECT father_id FROM members WHERE id = ?)
                    `, [currentSpouse.spouse_member_id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                
                if (spouseFather && spouseFather.family_tree_id) {
                    targetFamilyId = spouseFather.family_tree_id;
                    isSpouseFamily = true;
                    viewContext.is_spouse_family = true;
                    viewContext.spouse_id = currentSpouse.spouse_member_id;
                    viewContext.spouse_name = currentSpouse.spouse_name;
                }
            }
        }
        
        // Step 4: If no family found, check if parents have a family
        if (!targetFamilyId && userMember.parents) {
            try {
                const parents = JSON.parse(userMember.parents);
                for (const parentId of parents) {
                    const parentFamily = await new Promise((resolve, reject) => {
                        db.get(`SELECT family_tree_id FROM members WHERE id = ?`, [parentId], (err, row) => {
                            if (err) reject(err);
                            else resolve(row?.family_tree_id);
                        });
                    });
                    if (parentFamily) {
                        targetFamilyId = parentFamily;
                        viewContext.is_parent_family = true;
                        viewContext.parent_id = parentId;
                        break;
                    }
                }
            } catch (e) {}
        }
        
        // Step 5: Check if user can create their own family
        if (!targetFamilyId || isSpouseFamily) {
            viewContext.can_create_family = true;
        }
        
        // If still no family found, return the member and their immediate family (parents, spouse, children)
        if (!targetFamilyId) {
            // Get the member and their immediate relatives
            const memberIds = new Set([userMember.id]);
            
            // Add parents
            if (userMember.parents) {
                try {
                    const parents = JSON.parse(userMember.parents);
                    parents.forEach(pid => memberIds.add(pid));
                } catch (e) {}
            }
            
            // Add spouses
            if (userMember.spouses) {
                try {
                    const spouses = JSON.parse(userMember.spouses);
                    spouses.forEach(sid => memberIds.add(sid));
                } catch (e) {}
            }
            
            // Add children (members who have this member as parent)
            const childrenRows = await new Promise((resolve, reject) => {
                db.all(`SELECT id FROM members WHERE parents LIKE ?`, [`%"${userMember.id}"%`], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            childrenRows.forEach(row => memberIds.add(row.id));
            
            // Get all member details
            const members = await new Promise((resolve, reject) => {
                const placeholders = Array.from(memberIds).map(() => '?').join(',');
                db.all(`SELECT * FROM members WHERE id IN (${placeholders})`, Array.from(memberIds), (err, rows) => {
                    if (err) reject(err);
                    else {
                        const parsed = rows.map(row => ({
                            ...row,
                            spouses: JSON.parse(row.spouses || "[]"),
                            children: JSON.parse(row.children || "[]"),
                            parents: JSON.parse(row.parents || "[]"),
                            aliases: JSON.parse(row.aliases || "[]"),
                            achievements: JSON.parse(row.achievements || "[]")
                        }));
                        resolve(parsed);
                    }
                });
            });
            
            return res.json({
                family_info: {
                    id: 'unknown',
                    name: userMember.name + '的家族'
                },
                view_context: viewContext,
                members: members,
                notice: '當前顯示個人視角，您可以創建自己的家族'
            });
        }
        
        // Step 6: Get family info
        const familyInfo = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM family_trees WHERE id = ?`, [targetFamilyId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Step 7: Get family members
        let membersSql;
        let params;
        
        if (include_related === 'true') {
            membersSql = `
                SELECT DISTINCT m.* FROM members m
                WHERE m.id IN (
                    -- 1. 目標家族的所有成員
                    SELECT id FROM members WHERE family_tree_id = ?
                    UNION
                    -- 2. 這些成員的配偶
                    SELECT DISTINCT json_each.value as spouse_id
                    FROM members, json_each(members.spouses)
                    WHERE members.family_tree_id = ?
                    UNION
                    -- 3. 這些成員的父母
                    SELECT DISTINCT json_each.value as parent_id
                    FROM members, json_each(members.parents)
                    WHERE members.family_tree_id = ?
                    UNION
                    -- 4. 這些成員的子女（第一代）
                    SELECT DISTINCT target.id
                    FROM members target, json_each(target.parents)
                    WHERE json_each.value IN (
                        SELECT id FROM members WHERE family_tree_id = ?
                    )
                    UNION
                    -- 5. 子女的配偶（第二代）
                    SELECT DISTINCT json_each.value as spouse_id
                    FROM members, json_each(members.spouses)
                    WHERE members.id IN (
                        SELECT DISTINCT target.id
                        FROM members target, json_each(target.parents)
                        WHERE json_each.value IN (
                            SELECT id FROM members WHERE family_tree_id = ?
                        )
                    )
                    UNION
                    -- 6. 子女的子女（第三代）
                    SELECT DISTINCT target.id
                    FROM members target, json_each(target.parents)
                    WHERE json_each.value IN (
                        SELECT DISTINCT target.id
                        FROM members target, json_each(target.parents)
                        WHERE json_each.value IN (
                            SELECT id FROM members WHERE family_tree_id = ?
                        )
                    )
                    -- Include view member's spouse and children when viewing parent's family
                    UNION
                    SELECT DISTINCT json_each.value as spouse_id
                    FROM members, json_each(members.spouses)
                    WHERE members.id = ?
                    UNION
                    SELECT DISTINCT target.id
                    FROM members target, json_each(target.parents)
                    WHERE json_each.value = ?
                )
            `;
            params = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, userMember.id, userMember.id];
        } else {
            membersSql = "SELECT * FROM members WHERE family_tree_id = ?";
            params = [targetFamilyId];
        }
        
        const members = await new Promise((resolve, reject) => {
            db.all(membersSql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    const parsed = rows.map(row => ({
                        ...row,
                        spouses: JSON.parse(row.spouses || "[]"),
                        children: JSON.parse(row.children || "[]"),
                        parents: JSON.parse(row.parents || "[]"),
                        aliases: JSON.parse(row.aliases || "[]"),
                        achievements: JSON.parse(row.achievements || "[]")
                    }));
                    resolve(parsed);
                }
            });
        });
        
        // Determine notice message
        let notice = null;
        if (isSpouseFamily) {
            notice = '當前顯示配偶家族，您可以創建自己的家族';
        } else if (viewContext.is_parent_family) {
            notice = '當前顯示父母家族，您可以創建自己的家族';
        }
        
        res.json({
            family_info: familyInfo || {
                id: targetFamilyId,
                name: '未知家族'
            },
            view_context: viewContext,
            members: members,
            notice: notice
        });
        
    } catch (error) {
        console.error('Get my family tree error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all members
app.get('/api/family', authenticateToken, (req, res) => {
    // Set proper encoding headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // 從 token 中獲取用戶的家族ID列表
    const userFamilyTrees = req.user.familyTrees || [];
    
    // 支持按 family_tree_id 過濾（優先使用 query 參數，否則使用用戶的第一個家族）
    const { family_tree_id, include_related } = req.query;
    const targetFamilyId = family_tree_id || userFamilyTrees[0];
    
    // 如果沒有指定家族ID，返回錯誤
    if (!targetFamilyId) {
        return res.status(400).json({ error: '未指定家族ID' });
    }
    
    // 檢查用戶是否有權訪問該家族
    if (!userFamilyTrees.includes(targetFamilyId)) {
        return res.status(403).json({ error: '無權訪問此家族數據' });
    }
    
    // 查詢指定家族的成員，以及關聯家族的成員（父母、配偶的家族）
    let sql;
    let params;
    
    if (include_related === 'true') {
        // 包含關聯家族：返回目標家族成員 + 與他們有直接關係的其他家族成員
        sql = `
            SELECT DISTINCT m.* FROM members m
            WHERE m.id IN (
                -- 1. 目標家族的所有成員
                SELECT id FROM members WHERE family_tree_id = ?
                UNION
                -- 2. 目標家族成員的配偶（可能在其他家族）
                SELECT DISTINCT json_each.value as spouse_id
                FROM members, json_each(members.spouses)
                WHERE members.family_tree_id = ?
                UNION
                -- 3. 目標家族成員的父母（可能在其他家族）
                SELECT DISTINCT json_each.value as parent_id
                FROM members, json_each(members.parents)
                WHERE members.family_tree_id = ?
                UNION
                -- 4. 目標家族成員的子女（通過父母欄位反向查找，可能在其他家族）
                SELECT DISTINCT target.id
                FROM members target, json_each(target.parents)
                WHERE json_each.value IN (
                    SELECT id FROM members WHERE family_tree_id = ?
                )
            )
        `;
        params = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId];
    } else {
        // 只查詢指定家族
        sql = "SELECT * FROM members WHERE family_tree_id = ?";
        params = [targetFamilyId];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        // Parse JSON strings back to arrays and ensure all fields are properly formatted
        const members = rows.map(row => ({
            ...row,
            spouses: JSON.parse(row.spouses || "[]"),
            children: JSON.parse(row.children || "[]"),
            parents: JSON.parse(row.parents || "[]"),
            aliases: JSON.parse(row.aliases || "[]"),
            achievements: JSON.parse(row.achievements || "[]"),
            is_deceased: !!row.is_deceased, // Convert to boolean
            // Ensure email and avatar_url are included
            email: row.email || null,
            avatar_url: row.avatar_url || null,
            // Add biography info (calculated from biography_md, NOT from has_biography column)
            has_biography: !!row.biography_md,
            tags: JSON.parse(row.biography_tags || '[]'),
            // Add family fields
            family_id: row.family_id || 'chen_family',
            primaryFamily: row.primaryFamily || 'chen_family',
            families: JSON.parse(row.families || '["chen_family"]')
        }));
        res.json(members);
    });
});

// Add a new member
app.post('/api/family', (req, res) => {
    const { id, family_tree_id, name, gender, spouses, children, parents,
        birth_date, birth_year, birth_month, birth_day, birth_calendar,
        death_date, death_year, death_month, death_day, death_calendar,
        is_deceased, phone, email, address, remark, generation, clan_name,
        ancestral_home, courtesy_name, pseudonym, aliases, education,
        occupation, achievements, biography, avatar_url, biography_md, privacy_settings,
        family_id, primaryFamily, families } = req.body;

    const sql = "INSERT INTO members (id, family_tree_id, name, gender, spouses, children, parents, birth_date, birth_year, birth_month, birth_day, birth_calendar, death_date, death_year, death_month, death_day, death_calendar, is_deceased, phone, email, address, remark, generation, clan_name, ancestral_home, courtesy_name, pseudonym, aliases, education, occupation, achievements, biography, avatar_url, biography_md, privacy_settings, family_id, primaryFamily, families) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const params = [
        id,
        family_tree_id,
        name,
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
        family_id || 'chen_family',
        primaryFamily || 'chen_family',
        JSON.stringify(families || ['chen_family'])
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

// 更新家族信息（必须放在 /api/family/:id 之前）
app.put('/api/family/:id/info', authenticateToken, async (req, res) => {
    try {
        const familyId = req.params.id;
        const { name, surname, ancestral_home, hall_name, description } = req.body;
        const userId = req.user.userId;
        
        // 检查权限
        const roleSql = 'SELECT role FROM user_family_trees WHERE user_id = ? AND family_tree_id = ?';
        db.get(roleSql, [userId, familyId], (err, row) => {
            if (err || !row) {
                return res.status(403).json({ error: '無權修改此家族信息' });
            }
            
            const adminRoles = ['admin', 'family_admin', 'super_admin'];
            if (!adminRoles.includes(row.role)) {
                return res.status(403).json({ error: '僅管理員可修改家族信息' });
            }
            
            const updateSql = `
                UPDATE family_trees 
                SET name = ?, surname = ?, ancestral_home = ?, hall_name = ?, description = ?, updated_at = ?
                WHERE id = ?
            `;
            const now = new Date().toISOString();
            
            db.run(updateSql, [name, surname, ancestral_home, hall_name, description, now, familyId], function(err) {
                if (err) {
                    console.error('Error updating family info:', err);
                    return res.status(500).json({ error: '更新家族信息失敗' });
                }
                
                res.json({
                    success: true,
                    message: '家族信息已更新'
                });
            });
        });
    } catch (error) {
        console.error('Error in PUT /api/family/:id/info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a member
app.put('/api/family/:id', (req, res) => {
    const { family_tree_id, name, gender, spouses, children, parents,
        birth_date, birth_year, birth_month, birth_day, birth_calendar,
        death_date, death_year, death_month, death_day, death_calendar,
        is_deceased, phone, email, address, remark, generation, clan_name,
        ancestral_home, courtesy_name, pseudonym, aliases, education,
        occupation, achievements, biography, avatar_url, biography_md, privacy_settings,
        family_id, primaryFamily, families } = req.body;

    const sql = `UPDATE members set 
      family_tree_id = COALESCE(?,family_tree_id),
      name = COALESCE(?,name), 
      gender = COALESCE(?,gender), 
      spouses = COALESCE(?,spouses), 
      children = COALESCE(?,children), 
      parents = COALESCE(?,parents),
      birth_date = COALESCE(?,birth_date),
      birth_year = COALESCE(?,birth_year),
      birth_month = COALESCE(?,birth_month),
      birth_day = COALESCE(?,birth_day),
      birth_calendar = COALESCE(?,birth_calendar),
      death_date = COALESCE(?,death_date),
      death_year = COALESCE(?,death_year),
      death_month = COALESCE(?,death_month),
      death_day = COALESCE(?,death_day),
      death_calendar = COALESCE(?,death_calendar),
      is_deceased = COALESCE(?,is_deceased),
      phone = COALESCE(?,phone),
      email = COALESCE(?,email),
      address = COALESCE(?,address),
      remark = COALESCE(?,remark),
      generation = COALESCE(?,generation),
      clan_name = COALESCE(?,clan_name),
      ancestral_home = COALESCE(?,ancestral_home),
      courtesy_name = COALESCE(?,courtesy_name),
      pseudonym = COALESCE(?,pseudonym),
      aliases = COALESCE(?,aliases),
      education = COALESCE(?,education),
      occupation = COALESCE(?,occupation),
      achievements = COALESCE(?,achievements),
      biography = COALESCE(?,biography),
      avatar_url = COALESCE(?,avatar_url),
      biography_md = COALESCE(?,biography_md),
      privacy_settings = COALESCE(?,privacy_settings),
      family_id = COALESCE(?,family_id),
      primaryFamily = COALESCE(?,primaryFamily),
      families = COALESCE(?,families)
      WHERE id = ?`;

    const params = [
        family_tree_id,
        name,
        gender,
        spouses ? JSON.stringify(spouses) : null,
        children ? JSON.stringify(children) : null,
        parents ? JSON.stringify(parents) : null,
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
        is_deceased !== undefined ? (is_deceased ? 1 : 0) : null,
        phone,
        email,
        address,
        remark,
        generation,
        clan_name,
        ancestral_home,
        courtesy_name,
        pseudonym,
        aliases ? JSON.stringify(aliases) : null,
        education,
        occupation,
        achievements ? JSON.stringify(achievements) : null,
        biography,
        avatar_url,
        biography_md,
        privacy_settings ? JSON.stringify(privacy_settings) : null,
        family_id,
        primaryFamily,
        families ? JSON.stringify(families) : null,
        req.params.id
    ];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            message: "success",
            data: req.body,
            changes: this.changes
        });
    });
});

// Delete a member
app.delete('/api/family/:id', (req, res) => {
    const sql = 'DELETE FROM members WHERE id = ?';
    const params = [req.params.id];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            message: "deleted",
            changes: this.changes
        });
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
        const { member_a_id, member_b_id, divorce_date } = req.body;
        
        if (!member_a_id || !member_b_id) {
            return res.status(400).json({ error: '需要指定雙方Member ID' });
        }
        
        const now = new Date().toISOString();
        const divorceDate = divorce_date || now;
        
        // Step 1: Update member_spouses table
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE member_spouses 
                SET divorce_date = ?, is_current = 0 
                WHERE (member_id = ? AND spouse_member_id = ?) 
                   OR (member_id = ? AND spouse_member_id = ?)
            `, [divorceDate, member_a_id, member_b_id, member_b_id, member_a_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Step 2: Update marriages table
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE marriages 
                SET divorce_date = ?, is_divorced = 1 
                WHERE (husband_id = ? AND wife_id = ?) 
                   OR (husband_id = ? AND wife_id = ?)
            `, [divorceDate, member_a_id, member_b_id, member_b_id, member_a_id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Step 3: Determine which member is the "married-in" spouse (needs family cleanup)
        // The one whose father's family matches the current family_tree_id is the host
        // The other one is the married-in spouse
        const memberA = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM members WHERE id = ?`, [member_a_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const memberB = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM members WHERE id = ?`, [member_b_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Step 4: Clear family_tree_id for the married-in member
        // Logic: If member's father has the same family_tree_id, they are the host
        // Otherwise, they are the married-in spouse and need cleanup
        
        let cleanedUpMember = null;
        
        if (memberA && memberA.father_id) {
            const fatherA = await new Promise((resolve, reject) => {
                db.get(`SELECT family_tree_id FROM members WHERE id = ?`, [memberA.father_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            // If memberA's father doesn't have this family, memberA is married-in
            if (fatherA && fatherA.family_tree_id !== memberA.family_tree_id) {
                await new Promise((resolve, reject) => {
                    db.run(`UPDATE members SET family_tree_id = NULL WHERE id = ?`, [member_a_id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                cleanedUpMember = memberA;
            }
        }
        
        if (memberB && memberB.father_id) {
            const fatherB = await new Promise((resolve, reject) => {
                db.get(`SELECT family_tree_id FROM members WHERE id = ?`, [memberB.father_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            // If memberB's father doesn't have this family, memberB is married-in
            if (fatherB && fatherB.family_tree_id !== memberB.family_tree_id) {
                await new Promise((resolve, reject) => {
                    db.run(`UPDATE members SET family_tree_id = NULL WHERE id = ?`, [member_b_id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                cleanedUpMember = memberB;
            }
        }
        
        res.json({
            success: true,
            message: '離婚處理完成',
            divorced_members: [member_a_id, member_b_id],
            cleaned_up_member: cleanedUpMember ? {
                id: cleanedUpMember.id,
                name: cleanedUpMember.name,
                action: '已清除家族屬性'
            } : null
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
        
        // 解析標籤和事蹟狀態
        const tags = JSON.parse(row.biography_tags || '[]');
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

// Update/Create biography (creates new version)
app.put('/api/member/:id/biography', (req, res) => {
    const { id } = req.params;
    const { content_md, content_html, tags, images, edited_by } = req.body;
    
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
                     JSON.stringify(tags || []), JSON.stringify(images || []), edited_by || 'anonymous'],
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
                            has_biography = 1
                            WHERE id = ?`,
                            [content_md, content_html, JSON.stringify(tags || []), id],
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
        sql += " WHERE member_id = ?";
        params = [member_id];
    } else if (family_tree_id) {
        sql += " WHERE family_tree_id = ?";
        params = [family_tree_id];
    }

    sql += " ORDER BY upload_date DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/media', (req, res) => {
    const { id, member_id, family_tree_id, file_path, media_type, title,
        description, uploaded_by, metadata, is_featured } = req.body;
    const upload_date = new Date().toISOString();

    const sql = "INSERT INTO media (id, member_id, family_tree_id, file_path, media_type, title, description, upload_date, uploaded_by, metadata, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, member_id, family_tree_id, file_path, media_type, title, description, upload_date, uploaded_by, metadata, is_featured ? 1 : 0];

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

// File upload endpoint for biography images and avatars
app.post('/api/upload', upload.single('file'), async (req, res) => {
    console.log('[Upload] Received file upload request');
    console.log('[Upload] File:', req.file);
    console.log('[Upload] Type:', req.body.type);
    
    if (!req.file) {
        console.error('[Upload] No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
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
    db.all("SELECT * FROM face_embeddings WHERE media_id = ?", [req.params.media_id], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json(rows);
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
    const { id, name, description, created_by, is_public, password, cover_image, surname, ancestral_home, hall_name } = req.body;
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    const sql = "INSERT INTO family_trees (id, name, description, created_by, created_at, updated_at, is_public, password, cover_image, surname, ancestral_home, hall_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, name, description, created_by, created_at, updated_at, is_public ? 1 : 0, password, cover_image, surname, ancestral_home, hall_name];

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
    const { id, husband_id, wife_id, marriage_date, marriage_year, marriage_month,
        marriage_day, marriage_calendar, divorce_date, is_divorced, notes } = req.body;

    const sql = "INSERT INTO marriages (id, husband_id, wife_id, marriage_date, marriage_year, marriage_month, marriage_day, marriage_calendar, divorce_date, is_divorced, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const params = [id, husband_id, wife_id, marriage_date, marriage_year, marriage_month, marriage_day, marriage_calendar, divorce_date, is_divorced ? 1 : 0, notes];

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
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'family-tree-app/dist', 'index.html'));
  });
}

// ========== 家族管理 API ==========

// 生成6位数字邀请码
function generateInviteCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 获取家族信息（包含邀请码）
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
                    is_admin: true
                });
            });
        });
    } catch (error) {
        console.error('Error in /api/family/:id/manage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
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

// 通过邀请码查找家族
app.get('/api/family/find-by-code', authenticateToken, async (req, res) => {
    try {
        const { code } = req.query;
        
        if (!code || !/^\d{6}$/.test(code.replace(/\s/g, ''))) {
            return res.status(400).json({ error: '請輸入6位數字邀請碼' });
        }
        
        const cleanCode = code.replace(/\s/g, '');
        const sql = 'SELECT id, name, description, created_at FROM family_trees WHERE invite_code = ?';
        
        db.get(sql, [cleanCode], (err, row) => {
            if (err) {
                console.error('Error finding family:', err);
                return res.status(500).json({ error: '查找失敗' });
            }
            
            if (!row) {
                return res.status(404).json({ error: '找不到該家族，請檢查邀請碼是否正確' });
            }
            
            res.json(row);
        });
    } catch (error) {
        console.error('Error in /api/family/find-by-code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 创建新家族（无需认证，用于全新用户）
app.post('/api/family/create', async (req, res) => {
    try {
        const { surname, ancestralHome, hallName, founderName, founderEmail, founderPassword } = req.body;
        
        // 验证必填字段
        if (!surname || !founderName || !founderEmail || !founderPassword) {
            return res.status(400).json({ error: '請填寫所有必填欄位' });
        }
        
        // 检查邮箱是否已存在
        const checkEmailSql = 'SELECT id FROM users WHERE email = ?';
        db.get(checkEmailSql, [founderEmail], async (err, existingUser) => {
            if (err) {
                console.error('Error checking email:', err);
                return res.status(500).json({ error: '檢查郵箱失敗' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: '該郵箱已被註冊，請直接登入或使用其他郵箱' });
            }
            
            // 生成家族ID（使用姓氏+时间戳）
            const familyId = `${surname.toLowerCase()}_family_${Date.now()}`;
            const familyName = hallName ? `${surname}氏${hallName}` : `${surname}氏家族`;
            const now = new Date().toISOString();
            
            // 生成用户ID
            const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 加密密码
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash(founderPassword, 10);
            
            // 开始事务
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('Error starting transaction:', err);
                    return res.status(500).json({ error: '創建失敗' });
                }
                
                // 1. 创建家族
                const createFamilySql = `
                    INSERT INTO family_trees (id, name, surname, ancestral_home, hall_name, description, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                
                db.run(createFamilySql, [familyId, familyName, surname, ancestralHome || null, hallName || null, null, userId, now, now], function(err) {
                    if (err) {
                        console.error('Error creating family:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: '創建家族失敗' });
                    }
                    
                    // 2. 创建用户
                    const createUserSql = `
                        INSERT INTO users (id, username, email, password_hash, full_name, created_at, last_login, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.run(createUserSql, [userId, founderEmail, founderEmail, passwordHash, founderName, now, now, 1], function(err) {
                        if (err) {
                            console.error('Error creating user:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: '創建用戶失敗' });
                        }
                        
                        // 3. 关联用户和家族（设置为管理员）
                        const linkUserSql = `
                            INSERT INTO user_family_trees (user_id, family_tree_id, role, joined_at)
                            VALUES (?, ?, ?, ?)
                        `;
                        
                        db.run(linkUserSql, [userId, familyId, 'family_admin', now], function(err) {
                            if (err) {
                                console.error('Error linking user to family:', err);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: '關聯用戶失敗' });
                            }
                            
                            // 4. 创建创始人为家族成员
                            const memberId = `m_${Date.now()}`;
                            const createMemberSql = `
                                INSERT INTO members (id, family_tree_id, name, gender, generation, created_at)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `;
                            
                            db.run(createMemberSql, [memberId, familyId, founderName, 'unknown', 1, now], function(err) {
                                if (err) {
                                    console.error('Error creating member:', err);
                                    console.error('SQL:', createMemberSql);
                                    console.error('Params:', [memberId, familyId, founderName, 'unknown', 1, now]);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: '創建成員失敗: ' + err.message });
                                }
                                
                                // 5. 更新用户的 linkedMemberId
                                const updateUserSql = 'UPDATE users SET linkedMemberId = ? WHERE id = ?';
                                db.run(updateUserSql, [memberId, userId], function(err) {
                                    if (err) {
                                        console.error('Error updating user linkedMemberId:', err);
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: '更新用戶關聯失敗' });
                                    }
                                    
                                    // 提交事务
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Error committing transaction:', err);
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: '創建失敗' });
                                        }
                                        
                                        res.status(201).json({
                                            success: true,
                                            message: '家族創建成功',
                                            family: {
                                                id: familyId,
                                                name: familyName,
                                                surname,
                                                ancestralHome,
                                                hallName
                                            },
                                            user: {
                                                id: userId,
                                                email: founderEmail,
                                                name: founderName
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error in POST /api/family/create:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== 尋親啟事 API ==========

// 獲取所有尋親帖子
app.get('/api/reunion', optionalAuth, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let sql = `
      SELECT rp.*, u.full_name as author_name
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
    
    if (!req.user || !req.user.userId) {
      console.error('[ERROR] No user in request');
      return res.status(401).json({ error: '未授權：用戶信息缺失' });
    }
    
    const userId = req.user.userId;
    
    // 檢查用戶是否已有活躍帖子（status 不是 'closed'）
    const checkActiveSql = `
      SELECT COUNT(*) as count FROM reunion_posts 
      WHERE user_id = ? AND status != 'closed'
    `;
    
    const activeCount = await new Promise((resolve, reject) => {
      db.get(checkActiveSql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    if (activeCount > 0) {
      return res.status(400).json({ 
        error: '您已有一條活躍的尋親啟事，請先關閉或刪除現有帖子後再發布',
        code: 'ACTIVE_POST_EXISTS'
      });
    }
    
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        SELECT rp.*, u.full_name as author_name
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
      const isAuthor = row.user_id === req.user.userId;
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
          SELECT rp.*, u.full_name as author_name
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
      
      // 檢查權限：作者、家族管理員、超級管理員
      const isAuthor = row.user_id === req.user.userId;
      const isSuperAdmin = req.user.role === 'super_admin';
      const isFamilyAdmin = req.user.role === 'family_admin';
      
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