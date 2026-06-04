import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Search, Camera, X, Check } from 'lucide-react';

const SearchableSelector = ({ label, value, onSelect, placeholder, gender, allMembers, compact = false }) => {
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
        <div style={{ marginBottom: compact ? '4px' : '16px', position: 'relative' }}>
            {label && <label style={{ display: 'block', marginBottom: '2px', fontWeight: '600', fontSize: '10px', color: '#4b5563' }}>{label}</label>}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: compact ? '4px 8px' : '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: compact ? '28px' : '42px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {selectedMember ? (
                        <>
                            <div style={{ width: compact ? '18px' : '24px', height: compact ? '18px' : '24px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {selectedMember.avatar_url ? <img src={selectedMember.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <User size={compact ? 10 : 14} />}
                            </div>
                            <span style={{ fontSize: compact ? '12px' : '14px' }}>{selectedMember.name}</span>
                        </>
                    ) : (
                        <span style={{ color: '#9ca3af', fontSize: compact ? '11px' : '14px' }}>{placeholder || '搜尋...'}</span>
                    )}
                </div>
                <Search size={compact ? 12 : 16} color="#9ca3af" />
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
    const [province, setProvince] = useState('');
    const [city, setCity] = useState('');
    const [wechat, setWechat] = useState('');
    const [line, setLine] = useState('');
    const [phone2, setPhone2] = useState('');
    const [phone3, setPhone3] = useState('');
    
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
    const [marriageDate, setMarriageDate] = useState('');

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

    const handleCopyParentAddress = (type) => {
        const parentId = type === 'father' ? fatherId : motherId;
        const parent = allMembers.find(m => m.id === parentId);
        if (!parent) return alert(`請先選擇${type === 'father' ? '父親' : '母親'}`);
        
        if (parent.province) setProvince(parent.province);
        if (parent.city) setCity(parent.city);
        if (parent.address) setAddress(parent.address);
    };

    const handleCopyBaseAddress = () => {
        if (baseMember.province) setProvince(baseMember.province);
        if (baseMember.city) setCity(baseMember.city);
        if (baseMember.address) setAddress(baseMember.address);
    };

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
        if (!fullName) return alert('請輸入姓名');
        
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
            province, city,
            wechat, line,
            phone2, phone3,
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
            spouses: spouseId ? [spouseId] : [],
            marriage_date: marriageDate
        };
        
        await onSave(newMember);
        setSaving(false);
    };

    const styles = {
        overlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'flex-start', zIndex: 2000, 
            padding: '2vh 0', overflowY: 'auto'
        },
        modal: {
            backgroundColor: 'white', padding: '12px 18px', borderRadius: '16px',
            width: '95%', maxWidth: '780px', maxHeight: 'none', minHeight: 'min-content',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #eee',
            margin: '20px auto'
        },
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #eee'
        },
        gridRow: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
            gap: '8px', marginBottom: '6px'
        },
        inputGroup: { display: 'flex', flexDirection: 'column', gap: '1px' },
        label: { fontSize: '10px', fontWeight: 'bold', color: '#666' },
        input: { padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', outline: 'none' },
        actions: { 
            display: 'flex', justifyContent: 'flex-end', gap: '8px', 
            marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' 
        }
    };

    return (
        <div style={styles.overlay} onClick={onCancel}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '16px' }}>{getTitle()}</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999' }}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.gridRow}>
                        <div style={styles.inputGroup}><label style={styles.label}>姓</label><input style={styles.input} value={surname} onChange={e => setSurname(e.target.value)} required /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>名</label><input style={styles.input} value={givenName} onChange={e => setGivenName(e.target.value)} required /></div>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>性別</label>
                            <select style={styles.input} value={gender} onChange={e => setGender(e.target.value)}>
                                <option value="male">男</option>
                                <option value="female">女</option>
                            </select>
                        </div>
                        <div style={{ ...styles.inputGroup, height: '100%', justifyContent: 'center' }}>
                            <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '14px' }}>
                                <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
                                已過世
                            </label>
                        </div>
                    </div>

                    <div style={styles.gridRow}>
                        <div style={styles.inputGroup}><label style={styles.label}>國籍</label><input style={styles.input} value={nationality} onChange={e => setNationality(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>職業</label><input style={styles.input} value={occupation} onChange={e => setOccupation(e.target.value)} /></div>
                        <div style={{ ...styles.inputGroup, gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                <label style={styles.label}>居住地址</label>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button type="button" onClick={handleCopyBaseAddress} style={{ border: 'none', background: '#f0fdf4', color: '#166534', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🏠 同 {baseMember.name}</button>
                                    <button type="button" onClick={() => handleCopyParentAddress('father')} style={{ border: 'none', background: '#f0f9ff', color: '#0369a1', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🏠 同父</button>
                                    <button type="button" onClick={() => handleCopyParentAddress('mother')} style={{ border: 'none', background: '#fdf2f8', color: '#be185d', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🏠 同母</button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 0.7fr 2.6fr', gap: '8px' }}>
                                <div style={styles.inputGroup}><label style={styles.label}>省/州</label><input style={styles.input} value={province} onChange={e => setProvince(e.target.value)} /></div>
                                <div style={styles.inputGroup}><label style={styles.label}>市</label><input style={styles.input} value={city} onChange={e => setCity(e.target.value)} /></div>
                                <div style={styles.inputGroup}><label style={styles.label}>詳細地址</label><input style={styles.input} value={address} onChange={e => setAddress(e.target.value)} /></div>
                            </div>
                        </div>
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(2, 1fr)', background: '#f9fafb', padding: '6px', borderRadius: '8px' }}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>出生日期</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input style={{ ...styles.input, width: '60px' }} placeholder="年" value={birthYear} onChange={e => setBirthYear(e.target.value)} />
                                <input style={{ ...styles.input, width: '35px' }} placeholder="月" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} />
                                <input style={{ ...styles.input, width: '35px' }} placeholder="日" value={birthDay} onChange={e => setBirthDay(e.target.value)} />
                            </div>
                        </div>
                        {isDeceased && (
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>死亡日期</label>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <input style={{ ...styles.input, width: '60px' }} placeholder="年" value={deathYear} onChange={e => setDeathYear(e.target.value)} />
                                    <input style={{ ...styles.input, width: '35px' }} placeholder="月" value={deathMonth} onChange={e => setDeathMonth(e.target.value)} />
                                    <input style={{ ...styles.input, width: '35px' }} placeholder="日" value={deathDay} onChange={e => setDeathDay(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div style={styles.inputGroup}><label style={styles.label}>WeChat</label><input style={styles.input} value={wechat} onChange={e => setWechat(e.target.value)} /></div>
                        <div style={styles.inputGroup}><label style={styles.label}>Line</label><input style={styles.input} value={line} onChange={e => setLine(e.target.value)} /></div>
                    </div>

                    <div style={{ ...styles.gridRow, gridTemplateColumns: 'repeat(2, 1fr)', background: '#f8fafc', padding: '6px', borderRadius: '8px' }}>
                        <div style={styles.inputGroup}>
                            <SearchableSelector label="父親" value={fatherId} allMembers={allMembers} onSelect={setFatherId} gender="male" compact />
                        </div>
                        <div style={styles.inputGroup}>
                            <SearchableSelector label="母親" value={motherId} allMembers={allMembers} onSelect={setMotherId} gender="female" compact />
                        </div>
                    </div>

                    <div style={{ ...styles.inputGroup, marginTop: '2px' }}>
                        <label style={styles.label}>備註</label>
                        <input style={styles.input} value={remark} onChange={e => setRemark(e.target.value)} placeholder="補充說明..." />
                    </div>

                    <div style={styles.actions}>
                        <button type="button" onClick={onCancel} style={{ padding: '5px 15px', borderRadius: '6px', background: 'white', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>取消</button>
                        <button type="submit" disabled={saving} style={{ padding: '6px 25px', borderRadius: '6px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            {saving ? '...' : '確認添加'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddRelativeModal;
