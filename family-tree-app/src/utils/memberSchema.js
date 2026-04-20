/**
 * 成員屬性定義與格式化工具
 * 用於確保詳情頁與編輯面板的顯示一致性
 */

export const MEMBER_FIELDS = {
    surname: { label: '姓', group: 'core' },
    given_name: { label: '名', group: 'core' },
    name: { label: '姓名', group: 'core' },
    gender: { label: '性別', group: 'core' },
    courtesy_name: { label: '字', group: 'personal' },
    pseudonym: { label: '號', group: 'personal' },
    aliases: { label: '曾用名', group: 'personal' },
    nationality: { label: '國籍', group: 'personal' },
    birth_place: { label: '出生地', group: 'personal' },
    education: { label: '學歷', group: 'personal' },
    occupation: { label: '曾經任職', group: 'personal' },
    clan_name: { label: '堂號', group: 'heritage' },
    ancestral_home: { label: '祖籍', group: 'heritage' },
    birth_date_full: { label: '出生日期', group: 'time' },
    death_date_full: { label: '過世日期', group: 'time' },
    phone: { label: '電話', group: 'contact' },
    email: { label: '郵件', group: 'contact' },
    address: { label: '地址', group: 'contact' },
    remark: { label: '備註', group: 'misc' }
};

export const formatMemberValue = (key, value, member = {}) => {
    if (value === null || value === undefined || value === '') return '-';

    switch (key) {
        case 'gender':
            return value === 'male' ? '男' : (value === 'female' ? '女' : value);
        case 'is_deceased':
            return !!value ? '已過世' : '健在';
        case 'aliases':
            if (Array.isArray(value)) return value.join('、');
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.join('、') : value;
            } catch (e) {
                return String(value).replace(/[\[\]"]/g, '');
            }
        default:
            return value;
    }
};

export const getFullDateString = (member, type = 'birth') => {
    const y = member[`${type}_year`];
    const m = member[`${type}_month`];
    const d = member[`${type}_day`];
    
    if (!y && !m && !d) return '-';
    
    let parts = [];
    if (y) parts.push(`${y}年`);
    if (m) parts.push(`${m}月`);
    if (d) parts.push(`${d}日`);
    
    return parts.join('') || '-';
};

export const GENDER_OPTIONS = [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' }
];
