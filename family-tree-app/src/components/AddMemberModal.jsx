import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Camera, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SearchableSelector = ({ label, value, onSelect, placeholder, gender, allMembers, compact = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

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

    const selectedMember = allMembers.find(m => m.id === value) || searchResults.find(m => m.id === value);

    return (
        <div style={{ marginBottom: compact ? '4px' : '10px', position: 'relative' }}>
            {label && <label style={{ display: 'block', marginBottom: '2px', fontWeight: 'bold', fontSize: '10px', color: '#64748b' }}>{label}</label>}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: compact ? '4px 8px' : '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: compact ? '28px' : '36px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {selectedMember ? (
                        <span style={{ fontSize: compact ? '12px' : '13px' }}>{selectedMember.name}</span>
                    ) : (
                        <span style={{ color: '#9ca3af', fontSize: compact ? '11px' : '13px' }}>{placeholder || '搜尋...'}</span>
                    )}
                </div>
                <Search size={compact ? 12 : 14} color="#9ca3af" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            backgroundColor: 'white', border: '1px solid #e5e7eb',
                            borderRadius: '8px', marginTop: '4px', zIndex: 100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden'
                        }}
                    >
                        <input 
                            autoFocus placeholder="輸入姓名搜尋..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f3f4f6', outline: 'none', fontSize: '13px' }}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {searching ? <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>搜尋中...</div> : 
                                searchResults.length > 0 ? searchResults.map(m => (
                                    <div key={m.id} onClick={(e) => { e.stopPropagation(); onSelect(m.id); setIsOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            {m.avatar_url ? <img src={m.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={12} />}
                                        </div>
                                        {m.name} <small style={{ color: '#9ca3af' }}>({m.id})</small>
                                    </div>
                                )) : <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>查無結果</div>
                            }
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AddMemberModal = ({ allMembers, onSave, onCancel }) => {
    const [surname, setSurname] = useState('');
    const [givenName, setGivenName] = useState('');
    const [gender, setGender] = useState('male');
    
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
    const [phone2, setPhone2] = useState('');
    const [phone3, setPhone3] = useState('');
    const [wechat, setWechat] = useState('');
    const [line, setLine] = useState('');
    const [province, setProvince] = useState('');
    const [city, setCity] = useState('');
    const [address, setAddress] = useState('');
    const [remark, setRemark] = useState('');
    const [nationality, setNationality] = useState('');
    const [birthPlace, setBirthPlace] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [fatherId, setFatherId] = useState('');
    const [motherId, setMotherId] = useState('');
    const [spouseId, setSpouseId] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fullName = (surname + givenName).trim();
        if (!fullName) {
            alert('請輸入姓名（姓或名）');
            return;
        }
        
        setSaving(true);
        
        const newParents = [];
        if (fatherId) newParents.push(fatherId);
        if (motherId) newParents.push(motherId);
        
        let deathDate = null;
        if (deathYear || deathMonth || deathDay) {
            const year = deathYear || '0000';
            const month = deathMonth ? String(deathMonth).padStart(2, '0') : '01';
            const day = deathDay ? String(deathDay).padStart(2, '0') : '01';
            deathDate = `${year}-${month}-${day}`;
        }
        
        let birthDate = null;
        if (birthYear || birthMonth || birthDay) {
            const year = birthYear || '0000';
            const month = birthMonth ? String(birthMonth).padStart(2, '0') : '01';
            const day = birthDay ? String(birthDay).padStart(2, '0') : '01';
            birthDate = `${year}-${month}-${day}`;
        }
        
        const newMember = {
            id: Date.now().toString(),
            name: fullName,
            surname,
            given_name: givenName,
            gender,
            birth_date: birthDate,
            birth_year: birthYear ? parseInt(birthYear) : null,
            birth_month: birthMonth ? parseInt(birthMonth) : null,
            birth_day: birthDay ? parseInt(birthDay) : null,
            death_date: deathDate,
            death_year: deathYear ? parseInt(deathYear) : null,
            death_month: deathMonth ? parseInt(deathMonth) : null,
            death_day: deathDay ? parseInt(deathDay) : null,
            is_deceased: isDeceased,
            email,
            phone, phone2, phone3,
            wechat, line,
            province, city, address,
            remark,
            avatar_url: avatarUrl,
            nationality,
            birth_place: birthPlace,
            parents: newParents,
            spouses: spouseId ? [spouseId] : [],
            children: []
        };
        
        await onSave(newMember);
        setSaving(false);
    };

    const handleCopyParentAddress = (type) => {
        const parentId = type === 'father' ? fatherId : motherId;
        const parent = allMembers.find(m => m.id === parentId);
        if (!parent) return alert(`請先選擇${type === 'father' ? '父親' : '母親'}`);
        
        if (parent.province) setProvince(parent.province);
        if (parent.city) setCity(parent.city);
        if (parent.address) setAddress(parent.address);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAvatarUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'avatar');
        try {
            const response = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                setAvatarUrl(response.data.url);
            }
        } catch (error) {
            console.error('Avatar upload failed:', error);
            alert('上傳失敗');
        } finally {
            setAvatarUploading(false);
        }
    };

    const styles = {
        overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'flex-start', zIndex: 1100, 
            padding: '2vh 0', overflowY: 'auto'
        },
        modal: {
            backgroundColor: 'white', padding: '12px 18px', borderRadius: '16px',
            width: '95%', maxWidth: '750px', maxHeight: 'none', minHeight: 'min-content',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #ddd',
            margin: '20px auto'
        },
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #eee'
        },
        gridRow: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
            gap: '8px', marginBottom: '6px'
        },
        inputGroup: { display: 'flex', flexDirection: 'column', gap: '1px' },
        label: { fontSize: '10px', fontWeight: 'bold', color: '#64748b' },
        input: { padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none' },
        actions: { 
            display: 'flex', justifyContent: 'flex-end', gap: '8px', 
            marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' 
        }
    };

    return (
        <div style={styles.overlay} onClick={onCancel}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '15px' }}>新增家族成員</h3>
                    <button onClick={onCancel} style={{ background: '#f1f5f9', border: 'none', padding: '5px', borderRadius: '50%', cursor: 'pointer' }}><X size={14} /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* 頂部：姓名與頭像 */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '6px', borderRadius: '8px' }}>
                         <div style={{ position: 'relative', width: '50px', height: '50px' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '10px', overflow: 'hidden', border: '2px solid white', background: '#fff' }}>
                                {avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}><User size={20} /></div>}
                            </div>
                            <input type="file" hidden id="avatar-up" onChange={handleAvatarUpload} />
                            <label htmlFor="avatar-up" style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--primary-color)', color: 'white', padding: '3px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={10} /></label>
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr auto', gap: '8px', alignItems: 'center' }}>
                            <div style={styles.inputGroup}><label style={styles.label}>姓</label><input style={styles.input} value={surname} onChange={e => setSurname(e.target.value)} required /></div>
                            <div style={styles.inputGroup}><label style={styles.label}>名</label><input style={styles.input} value={givenName} onChange={e => setGivenName(e.target.value)} required /></div>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>性別</label>
                                <select style={styles.input} value={gender} onChange={e => setGender(e.target.value)}>
                                    <option value="male">男</option>
                                    <option value="female">女</option>
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', marginTop: '12px' }}>
                                <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} /> 已卒
                            </label>
                        </div>
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(2, 1fr)', background: '#f8fafc', padding: '6px', borderRadius: '8px' }}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>出生日期</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input style={{ ...styles.input, width: '55px' }} placeholder="年" value={birthYear} onChange={e => setBirthYear(e.target.value)} />
                                <input style={{ ...styles.input, width: '30px' }} placeholder="月" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} />
                                <input style={{ ...styles.input, width: '30px' }} placeholder="日" value={birthDay} onChange={e => setBirthDay(e.target.value)} />
                            </div>
                        </div>
                        {isDeceased && (
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>死亡日期</label>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <input style={{ ...styles.input, width: '55px' }} placeholder="年" value={deathYear} onChange={e => setDeathYear(e.target.value)} />
                                    <input style={{ ...styles.input, width: '30px' }} placeholder="月" value={deathMonth} onChange={e => setDeathMonth(e.target.value)} />
                                    <input style={{ ...styles.input, width: '30px' }} placeholder="日" value={deathDay} onChange={e => setDeathDay(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <label style={styles.label}>居住地址</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button type="button" onClick={() => handleCopyParentAddress('father')} style={{ border: 'none', background: '#f0f9ff', color: '#0369a1', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🏠 同父</button>
                            <button type="button" onClick={() => handleCopyParentAddress('mother')} style={{ border: 'none', background: '#fdf2f8', color: '#be185d', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🏠 同母</button>
                        </div>
                    </div>
                    <div style={{ ...styles.gridRow, gridTemplateColumns: '0.7fr 0.7fr 2.6fr', gap: '6px' }}>
                        <div style={styles.inputGroup}><label style={styles.label}>省/州</label><input style={styles.input} value={province} onChange={e => setProvince(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>市</label><input style={styles.input} value={city} onChange={e => setCity(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>詳細地址</label><input style={styles.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="詳細地址..." /></div>
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div style={styles.inputGroup}><label style={styles.label}>WeChat</label><input style={styles.input} value={wechat} onChange={e => setWechat(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Line</label><input style={styles.input} value={line} onChange={e => setLine(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Email</label><input style={styles.input} value={email} onChange={e => setEmail(e.target.value)} /></div>
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(3, 1fr)', background: '#f1f5f9', padding: '6px', borderRadius: '8px' }}>
                        <SearchableSelector label="父親" value={fatherId} allMembers={allMembers} onSelect={setFatherId} gender="male" compact />
                        <SearchableSelector label="母親" value={motherId} allMembers={allMembers} onSelect={setMotherId} gender="female" compact />
                        <SearchableSelector label="主要配偶" value={spouseId} allMembers={allMembers} onSelect={setSpouseId} compact />
                    </div>

                    <div style={{ ...styles.inputGroup, marginTop: '2px' }}>
                        <label style={styles.label}>備註</label>
                        <input style={{ ...styles.input, width: '100%' }} value={remark} onChange={e => setRemark(e.target.value)} placeholder="備註說明..." />
                    </div>

                    <div style={styles.actions}>
                        <button type="button" onClick={onCancel} style={{ padding: '4px 12px', borderRadius: '6px', background: 'white', border: '1px solid #e2e8f0', fontSize: '12px', cursor: 'pointer' }}>取消</button>
                        <button type="submit" disabled={saving} style={{ padding: '5px 24px', borderRadius: '6px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            {saving ? '...' : '確認添加'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMemberModal;
