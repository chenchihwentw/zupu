const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const dbPath = 'i:/proj/zupu/family-tree-app/family.db';
const db = new sqlite3.Database(dbPath);

async function testLogin() {
    const email = 'superadmin';
    const password = 'Admin123!';
    
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active != 0`, [email, email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('User found:', user ? 'Yes' : 'No');
        if (!user) return;
        
        console.log('Stored hash:', user.password_hash);
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log('Password valid:', validPassword);
        
        // Check family trees
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
        console.log('Family trees count:', familyTrees.length);
        
        // Test JWT sign
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = 'zupu_family_tree_secret_key_2026_change_in_production';
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: familyTrees[0]?.role || 'user',
                familyTrees: familyTrees.map(ft => ft.family_tree_id),
                linkedMemberId: null
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        console.log('JWT signed successfully');
        
    } catch (err) {
        console.error('Error during test:', err);
        console.error(err.stack);
    } finally {
        db.close();
    }
}

testLogin();
