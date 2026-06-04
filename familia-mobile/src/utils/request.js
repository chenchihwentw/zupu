export const SERVER_URL = 'https://zupu.up.railway.app';
export const BASE_URL = `${SERVER_URL}/api`;

export const getFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${SERVER_URL}${path}`;
  return `${SERVER_URL}/${path}`;
};

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    
    // 自動附加 family_tree_id，避免抓到其他家族的資料
    let finalUrl = options.url;
    try {
      const userStr = uni.getStorageSync('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.familyTrees && user.familyTrees.length > 0) {
          let fid = uni.getStorageSync('activeFamilyTreeId');
          if (!fid) {
            // 如果還沒選擇過，優先選有管理員權限的，最後才選第一個
            const primaryTree = user.familyTrees.find(f => f.role === 'family_admin') || user.familyTrees[0];
            fid = primaryTree.id;
            uni.setStorageSync('activeFamilyTreeId', fid);
          }
          const separator = finalUrl.includes('?') ? '&' : '?';
          finalUrl += `${separator}family_tree_id=${fid}`;
        }
      }
    } catch (e) {
      console.error('Failed to parse user for family_tree_id', e);
    }
    
    uni.request({
      url: BASE_URL + finalUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        // Handle common errors like 401 Unauthorized
        if (res.statusCode === 401 || res.statusCode === 403) {
          uni.removeStorageSync('token');
          uni.showToast({
            title: '登入已過期，請重新登入',
            icon: 'none'
          });
          setTimeout(() => {
            uni.reLaunch({ url: '/pages/login/index' });
          }, 1500);
          reject(res.data);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          uni.showToast({
            title: res.data?.error || '網路請求錯誤',
            icon: 'none'
          });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '網路連線失敗',
          icon: 'error'
        });
        reject(err);
      }
    });
  });
};

export default {
  get: (url, data, header) => request({ url, method: 'GET', data, header }),
  post: (url, data, header) => request({ url, method: 'POST', data, header }),
  put: (url, data, header) => request({ url, method: 'PUT', data, header }),
  delete: (url, data, header) => request({ url, method: 'DELETE', data, header }),
  getFullUrl
};
