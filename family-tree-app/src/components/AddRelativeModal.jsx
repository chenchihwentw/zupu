import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Search, Camera, X, Check } from 'lucide-react';

const SearchableSelector = ({ label, value, onSelect, placeholder, gender, allMembers }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Fetch missing member details if value is provided but not found locally
    const [extraMember, setExtraMember] = useState(null);
    useEffect(() => {
        if (!value) {
            setExtraMember(null);
            return;
        }
        
        const exists = searchResults.find(m => m.id === value) || allMembers.find(m => m.id === value);
        
        if (!exists) {
            const fetchOne = async () => {
                try {
                    const res = await axios.get(`/api/member/${value}`);
                    if (res.data) setExtraMember(res.data);
                } catch (err) {
                    console.error('Fetch missing member failed in modal:', err);
                }
            };
            fetchOne();
        } else {
            setExtraMember(null);
        }
    }, [value, searchResults, allMembers]);

    const selectedMember = useMemo(() => {
        if (!value) return null;
        return searchResults.find(m => m.id === value) || allMembers.find(m => m.id === value) || extraMember;
    }, [value, searchResults, allMembers, extraMember]);

    // Global search effect
    useEffect(() => {
        if (searchTerm.length < 1) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await axios.get(`/api/members/search?q=${encodeURIComponent(searchTerm)}${gender ? `&gender=${gender}` : ''}`);
                setSearchResults(res.data);
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, gender]);

    return (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#4b5563' }}>{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '42px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {selectedMember ? (
                        <>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {selectedMember.avatar_url ? <img src={selectedMember.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={14} />}
                            </div>
                            <span style={{ fontSize: '14px' }}>{selectedMember.name} <small style={{ color: '#9ca3af' }}>({selectedMember.id})</small></span>
                        </>
                    ) : (
                        <span style={{ color: '#9ca3af', fontSize: '14px' }}>{placeholder || '搜尋或選擇...'}</span>
                    )}
                </div>
                <Search size={16} color="#9ca3af" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            marginTop: '4px',
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                            border: '1px solid #e5e7eb',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                            <input 
                                autoFocus
                                type="text"
                                placeholder="輸入姓名或 ID 進行庫存搜尋..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb',
                                    outline: 'none',
                                    fontSize: '14px'
                                }}
                            />
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <div 
                                onClick={() => { onSelect(''); setIsOpen(false); }}
                                style={{ padding: '10px 12px', fontSize: '13px', cursor: 'pointer', color: '#ef4444', borderBottom: '1px solid #f9fafb' }}
                            >
                                無 / 移除關聯
                            </div>
                            
                            {searching && <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>搜尋中...</div>}
                            
                            {/* Combined local and remote results */}
                            {searchResults.length === 0 && searchTerm === '' && allMembers.filter(m => !gender || m.gender === gender).slice(0, 10).map(member => (
                                <SearchItem key={member.id} member={member} onSelect={(id) => { onSelect(id); setIsOpen(false); }} />
                            ))}
                            {searchResults.map(member => (
                                <SearchItem key={member.id} member={member} onSelect={(id) => { onSelect(id); setIsOpen(false); }} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SearchItem = ({ member, onSelect }) => (
    <div 
        onClick={() => onSelect(member.id)}
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.2s' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f3f4f6', overflow: 'hidden' }}>
            {member.avatar_url ? <img src={member.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}><User size={16} color="#94a3b8" /></div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{member.name}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>ID: {member.id} {member.birth_year ? `· ${member.birth_year}` : ''}</span>
        </div>
    </div>
);

const AddRelativeModal = ({ baseMember, relativeType, allMembers, onSave, onCancel }) => {
    const [surname, setSurname] = useState('');
    const [givenName, setGivenName] = useState('');
    const [gender, setGender] = useState('male');
    const [nationality, setNationality] = useState('');
    const [birthPlace, setBirthPlace] = useState('');
    const [ancestralHome, setAncestralHome] = useState('');
    const [courtesyName, setCourtesyName] = useState('');
    const [occupation, setOccupation] = useState('');
    
    // Birth date fields
    const [birthYear, setBirthYear] = useState('');
    const [birthMonth, setBirthMonth] = useState('');
    const [birthDay, setBirthDay] = useState('');
    
    // Death date fields
    const [deathYear, setDeathYear] = useState('');
    const [deathMonth, setDeathMonth] = useState('');
    const [deathDay, setDeathDay] = useState('');
    
    const [isDeceased, setIsDeceased] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [remark, setRemark] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Relatives selection
    const [fatherId, setFatherId] = useState('');
    const [motherId, setMotherId] = useState('');
    const [spouseId, setSpouseId] = useState('');
    const [marriageDate, setMarriageDate] = useState(''); // ✨ 新增婚姻日期

    // Pre-fill logic correctly
    useEffect(() => {
        switch (relativeType) {
            case 'child':
                if (baseMember.gender === 'male') setFatherId(baseMember.id);
                else setMotherId(baseMember.id);
                
                if (baseMember.spouses?.length > 0) {
                    const spouse = allMembers.find(m => m.id === baseMember.spouses[0]);
                    if (spouse) {
                        if (baseMember.gender === 'male') setMotherId(spouse.id);
                        else setFatherId(spouse.id);
                    }
                }
                break;
            case 'spouse':
                setSpouseId(baseMember.id);
                setGender(baseMember.gender === 'male' ? 'female' : 'male');
                break;
            case 'sibling':
                const parents = baseMember.parents || [];
                const father = allMembers.find(m => parents.includes(m.id) && m.gender === 'male');
                const mother = allMembers.find(m => parents.includes(m.id) && m.gender === 'female');
                if (father) setFatherId(father.id);
                if (mother) setMotherId(mother.id);
                break;
            default: break;
        }
    }, [baseMember, relativeType, allMembers]);

    const getTitle = () => {
        switch (relativeType) {
            case 'parent': return `為 ${baseMember.name} 添加父母`;
            case 'child': return `為 ${baseMember.name} 添加子女`;
            case 'spouse': return `為 ${baseMember.name} 添加配偶`;
            case 'sibling': return `為 ${baseMember.name} 添加兄弟姐妹`;
            default: return '添加成員';
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        const fullName = (surname + givenName).trim();
        if (!fullName) return alert('請輸入姓名（至少填寫「姓」或「名」）');
        
        setSaving(true);
        const newParents = [];
        if (fatherId) newParents.push(fatherId);
        if (motherId) newParents.push(motherId);
        
        const newMember = {
            id: Date.now().toString(),
            name: fullName,
            surname,
            given_name: givenName,
            gender,
            nationality,
            birth_place: birthPlace,
            ancestral_home: ancestralHome,
            courtesy_name: courtesyName,
            occupation,
            birth_year: birthYear ? parseInt(birthYear) : null,
            birth_month: birthMonth ? parseInt(birthMonth) : null,
            birth_day: birthDay ? parseInt(birthDay) : null,
            death_year: deathYear ? parseInt(deathYear) : null,
            death_month: deathMonth ? parseInt(deathMonth) : null,
            death_day: deathDay ? parseInt(deathDay) : null,
            is_deceased: isDeceased,
            email, phone, address, remark,
            avatar_url: avatarUrl,
            parents: newParents,
            father_id: fatherId || null,
            mother_id: motherId || null,
            spouses: spouseId ? [spouseId] : [],
            children: [],
            marriage_date: marriageDate // ✨ 傳遞婚姻日期
        };
        
        await onSave(newMember);
        setSaving(false);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAvatarUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'avatar');
        try {
            const res = await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) setAvatarUrl(res.data.url);
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setAvatarUploading(false);
        }
    };

    const styles = {
        overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
        modal: { backgroundColor: 'white', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '600px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #f3f4f6' },
        group: { marginBottom: '20px' },
        label: { display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#374151' },
        input: { width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' },
        infoBox: { background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '14px', color: '#0369a1', border: '1px solid #bae6fd' },
        sectionTitle: { fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }
    };

    return (
        <div style={styles.overlay}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.modal}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>{getTitle()}</h2>
                    <button onClick={onCancel} style={{ background: '#f3f4f6', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                
                <div style={styles.infoBox}>
                    已選定基準成員: <strong>{baseMember.name}</strong>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* ── 基本資料 ── */}
                    <p style={styles.sectionTitle}>基本資料</p>

                    {/* 姓 + 名 + 性別 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={styles.label}>姓 *</label>
                            <input style={styles.input} value={surname} onChange={e => setSurname(e.target.value)} placeholder="如：陳" />
                        </div>
                        <div>
                            <label style={styles.label}>名 *</label>
                            <input style={styles.input} value={givenName} onChange={e => setGivenName(e.target.value)} placeholder="如：志明" />
                        </div>
                        <div>
                            <label style={styles.label}>性別</label>
                            <select style={styles.input} value={gender} onChange={e => setGender(e.target.value)}>
                                <option value="male">男</option>
                                <option value="female">女</option>
                            </select>
                        </div>
                    </div>

                    {/* 字/號 + 祖籍 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={styles.label}>字 / 號</label>
                            <input style={styles.input} value={courtesyName} onChange={e => setCourtesyName(e.target.value)} placeholder="如：懷遠" />
                        </div>
                        <div>
                            <label style={styles.label}>祖籍</label>
                            <input style={styles.input} value={ancestralHome} onChange={e => setAncestralHome(e.target.value)} placeholder="如：福建泉州" />
                        </div>
                    </div>

                    {/* 國籍 + 出生地 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={styles.label}>國籍</label>
                            <input style={styles.input} value={nationality} onChange={e => setNationality(e.target.value)} placeholder="如：中國" />
                        </div>
                        <div>
                            <label style={styles.label}>出生地</label>
                            <input style={styles.input} value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="如：廈門" />
                        </div>
                    </div>

                    {/* 職業 */}
                    <div style={styles.group}>
                        <label style={styles.label}>職業</label>
                        <input style={styles.input} value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="如：商人、農民、教師" />
                    </div>

                    {/* ── 出生/過世 ── */}
                    <p style={styles.sectionTitle}>生卒日期</p>

                    <div style={styles.group}>
                        <label style={styles.label}>出生日期</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input style={{ ...styles.input, flex: 2 }} type="number" placeholder="年 (YYYY)" value={birthYear} onChange={e => setBirthYear(e.target.value)} />
                            <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="月" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} />
                            <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="日" value={birthDay} onChange={e => setBirthDay(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} id="deceased-check" />
                        <label htmlFor="deceased-check" style={{ fontSize: '14px', fontWeight: '500' }}>已過世</label>
                    </div>

                    {isDeceased && (
                        <div style={styles.group}>
                            <label style={styles.label}>過世日期</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input style={{ ...styles.input, flex: 2 }} type="number" placeholder="年 (YYYY)" value={deathYear} onChange={e => setDeathYear(e.target.value)} />
                                <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="月" value={deathMonth} onChange={e => setDeathMonth(e.target.value)} />
                                <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="日" value={deathDay} onChange={e => setDeathDay(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {/* ── 關聯鏈結 ── */}
                    <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '16px', marginBottom: '24px' }}>
                        <p style={{ ...styles.sectionTitle, borderBottom: 'none', marginBottom: '12px' }}>鏈結現有成員 (可選)</p>
                        
                        {(relativeType === 'child' || relativeType === 'sibling' || relativeType === 'parent') && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <SearchableSelector 
                                    label="父親" value={fatherId} onSelect={setFatherId} gender="male" 
                                    allMembers={allMembers} placeholder="搜尋父親..."
                                />
                                <SearchableSelector 
                                    label="母親" value={motherId} onSelect={setMotherId} gender="female" 
                                    allMembers={allMembers} placeholder="搜尋母親..."
                                />
                            </div>
                        )}
                        
                        {relativeType === 'spouse' && (
                            <>
                                <SearchableSelector 
                                    label="配偶(自動填寫)" value={spouseId} onSelect={()=>{}} gender={gender ==='male'?'female':'male'}
                                    allMembers={allMembers} placeholder="已選定基準成員"
                                />
                                <div style={styles.group}>
                                    <label style={styles.label}>婚姻日期 (可選)</label>
                                    <input 
                                        type="date" 
                                        style={styles.input} 
                                        value={marriageDate} 
                                        onChange={e => setMarriageDate(e.target.value)} 
                                    />
                                </div>
                            </>
                        )}
                        
                        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                            💡 提示：輸入姓名搜尋已在數據庫中的人員，可避免重複創建。
                        </p>
                    </div>

                    {/* ── 聯繫資料 ── */}
                    <p style={styles.sectionTitle}>聯繫資料（可選）</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={styles.group}>
                            <label style={styles.label}>聯繫電話</label>
                            <input style={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+886..." />
                        </div>
                        <div style={styles.group}>
                            <label style={styles.label}>電子郵件</label>
                            <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
                        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '600', cursor: 'pointer' }}>取消</button>
                        <button type="submit" disabled={saving} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--primary-color)', color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)' }}>
                            {saving ? '保存中...' : '確認添加'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddRelativeModal;
