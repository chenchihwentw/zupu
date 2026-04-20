const axios = require('axios');

async function test() {
  try {
    // 登入
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'limeiling@gmail.com',
      password: 'password123'
    });
    
    console.log('✓ 登入成功');
    const token = loginRes.data.token;
    
    // 獲取族譜
    const familyRes = await axios.get('http://localhost:3001/api/my-family-tree?include_related=true', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\n族譜數據：');
    console.log(JSON.stringify(familyRes.data, null, 2));
    
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

test();
