import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, User, Trash2, Save, FileText, Camera, HeartOff, Heart, History } from 'lucide-react';
import { MEMBER_FIELDS } from '../utils/memberSchema';
import { useAuth } from '../context/AuthContext';

const SearchableSelector = ({ label, value, options, onChange, placeholder, gender, horizontal = false, allMembers = [] }) => {
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
        
        const exists = options.find(m => m.id === value) || 
                       searchResults.find(m => m.id === value) || 
                       allMembers.find(m => m.id === value);
        
        if (!exists) {
            const fetchOne = async () => {
                try {
                    const res = await axios.get(`/api/member/${value}`);
                    if (res.data) setExtraMember(res.data);
                } catch (err) {
                    console.error('Fetch missing member failed:', err);
                }
            };
            fetchOne();
        } else {
            setExtraMember(null);
        }
    }, [value, options, searchResults, allMembers]);

    const selectedMember = useMemo(() => {
        return options.find(m => m.id === value) || 
               searchResults.find(m => m.id === value) || 
               allMembers.find(m => m.id === value) || 
               extraMember;
    }, [options, value, searchResults, allMembers, extraMember]);

    // Global Search Effect
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
                console.error('Global search error:', err);
            } finally {
                setSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, gender]);

    const content = (
        <div style={{ position: 'relative', flex: horizontal ? 1 : 'none' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '38px'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    {selectedMember ? (
                        <>
                            <div style={{ minWidth: '20px', height: '20px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={12} />
                            </div>
                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selectedMember.name} <small style={{ color: '#94a3b8' }}>({selectedMember.id})</small>
                            </span>
                        </>
                    ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{placeholder || '請選擇...'}</span>
                    )}
                </div>
                <Search size={14} color="#94a3b8" />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="search-dropdown"
                        style={{ zIndex: 1000 }}
                    >
                        <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                            <input 
                                autoFocus
                                type="text"
                                placeholder="搜尋姓名或 ID - 全庫搜尋支持"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    outline: 'none',
                                    fontSize: '13px'
                                }}
                            />
                        </div>
                        <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            <div 
                                className="search-item" 
                                onClick={() => { onChange(''); setIsOpen(false); }}
                                style={{ fontStyle: 'italic', color: '#ef4444', padding: '8px 12px', fontSize: '13px' }}
                            >
                                無 / 移除關聯
                            </div>
                            
                            {searching && <div style={{ padding: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>搜尋全庫中...</div>}
                            
                            {/* Local Members */}
                            {searchTerm === '' && options.map(m => (
                                <SearchItem key={m.id} member={m} onClick={(id) => { onChange(id); setIsOpen(false); }} />
                            ))}
                            
                            {/* Search Results */}
                            {searchResults.map(m => (
                                <SearchItem key={m.id} member={m} onClick={(id) => { onChange(id); setIsOpen(false); }} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    if (horizontal) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontWeight: '600', fontSize: '13px' }}>{label}</label>
                {content}
            </div>
        );
    }

    return (
        <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>{label}</label>
            {content}
        </div>
    );
};

const SearchItem = ({ member, onClick }) => (
    <div 
        className="search-item"
        onClick={() => onClick(member.id)}
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
    >
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9' }}>
            {member.avatar_url ? (
                <img src={member.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={12} />
                </div>
            )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>{member.name}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {member.id}</span>
        </div>
    </div>
);

const EditMemberPanel = ({ member, allMembers, onSave, onDelete, onCancel, currentFamilyId }) => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const [surname, setSurname] = useState(member.surname || '');
    const [givenName, setGivenName] = useState(member.given_name || (member.surname ? '' : member.name) || '');
    const [gender, setGender] = useState(member.gender);
    
    // Birth date fields
    const [birthYear, setBirthYear] = useState(member.birth_year || '');
    const [birthMonth, setBirthMonth] = useState(member.birth_month || '');
    const [birthDay, setBirthDay] = useState(member.birth_day || '');
    
    // Death date fields
    const [deathYear, setDeathYear] = useState(member.death_year || '');
    const [deathMonth, setDeathMonth] = useState(member.death_month || '');
    const [deathDay, setDeathDay] = useState(member.death_day || '');
    
    const [isDeceased, setIsDeceased] = useState(member.is_deceased || false);
    const [email, setEmail] = useState(member.email || '');
    const [phone, setPhone] = useState(member.phone || '');
    const [address, setAddress] = useState(member.address || '');
    const [remark, setRemark] = useState(member.remark || '');
    const [avatarUrl, setAvatarUrl] = useState(member.avatar_url || '');
    const [biographyMd, setBiographyMd] = useState(member.biography_md || '');
    const [courtesyName, setCourtesyName] = useState(member.courtesy_name || '');
    const [pseudonym, setPseudonym] = useState(member.pseudonym || '');
    const [clanName, setClanName] = useState(member.clan_name || '');
    const [ancestralHome, setAncestralHome] = useState(member.ancestral_home || '');
    const [education, setEducation] = useState(member.education || '');
    const [occupation, setOccupation] = useState(member.occupation || '');
    const [aliases, setAliases] = useState(() => {
        let val = member.aliases || '';
        try {
            if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('"'))) {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed.join('、') : parsed;
            }
        } catch (e) {
            val = val.replace(/[\\"[\]]/g, '').trim();
        }
        return val;
    });
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nationality, setNationality] = useState(member.nationality || '');
    const [birthPlace, setBirthPlace] = useState(member.birth_place || '');

    // Divorce management
    const [divorceDate, setDivorceDate] = useState('');
    const [isDivorcing, setIsDivorcing] = useState(false);

    // Helper to find parent by gender - supports cross-family members
    const findParentIdByGender = (targetGender) => {
        if (!member.parents || member.parents.length === 0) return '';
        // First try finding within current family members list
        const found = member.parents.find(pid => {
            const p = allMembers.find(m => m.id === pid);
            return p && p.gender === targetGender;
        });
        if (found) return found;
        // Fallback: if only 1 parent and gender unknown, skip
        // If 2 parents: conventional assumption b[n]1=father(male), _old suffix or second=mother(female)
        if (member.parents.length === 2) {
            if (targetGender === 'male') return member.parents[0];
            if (targetGender === 'female') return member.parents[1];
        }
        return '';
    };

    const [fatherId, setFatherId] = useState(findParentIdByGender('male'));
    const [motherId, setMotherId] = useState(findParentIdByGender('female'));

    // Async fix: if any parent is not found in allMembers (cross-family),
    // fetch their gender from backend and reassign fatherId/motherId correctly
    useEffect(() => {
        if (!member.parents || member.parents.length === 0) return;

        const missingParents = member.parents.filter(
            pid => !allMembers.find(m => m.id === pid)
        );
        if (missingParents.length === 0) return;

        const fetchMissing = async () => {
            const results = await Promise.all(
                missingParents.map(pid =>
                    axios.get(`/api/member/${pid}`).then(r => r.data).catch(() => null)
                )
            );
            results.forEach(p => {
                if (!p) return;
                if (p.gender === 'male') setFatherId(p.id);
                else if (p.gender === 'female') setMotherId(p.id);
            });
        };
        fetchMissing();
    }, [member.id]);

    const [spouses, setSpouses] = useState(member.spouses || []);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
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
        
        const { privacy_settings, ...memberWithoutPrivacy } = member;
        
        const updatedMember = {
            ...memberWithoutPrivacy,
            surname,
            given_name: givenName,
            name: (surname + givenName) || name || member.name,
            gender,
            nationality,
            birth_place: birthPlace,
            birth_date: birthDate,
            birth_year: birthYear ? parseInt(birthYear) : null,
            birth_month: birthMonth ? parseInt(birthMonth) : null,
            birth_day: birthDay ? parseInt(birthDay) : null,
            death_date: deathDate,
            death_year: deathYear ? parseInt(deathYear) : null,
            death_month: deathMonth ? parseInt(deathMonth) : null,
            death_day: deathDay ? parseInt(deathDay) : null,
            is_deceased: isDeceased,
            email, phone, address, remark,
            avatar_url: avatarUrl,
            biography_md: biographyMd,
            courtesy_name: courtesyName,
            pseudonym: pseudonym,
            clan_name: clanName,
            ancestral_home: ancestralHome,
            education: education,
            occupation: occupation,
            aliases: aliases ? aliases.split(/[、,，]/).map(s => s.trim()).filter(Boolean) : [],
            parents: newParents,
            father_id: fatherId || null,
            mother_id: motherId || null,
            spouses: spouses
        };
        
        await onSave(updatedMember);
        setSaving(false);
    };

    const handleDivorce = async () => {
        if (!spouses[0]) return;
        if (!window.confirm('確定要維護這段離婚關係嗎？\n這將更新婚姻狀態，但保留與子女的血緣聯繫。')) return;

        setIsDivorcing(true);
        try {
            const spouseId = spouses[0];
            await axios.post('/api/marriages/divorce', {
                husband_id: gender === 'male' ? member.id : spouseId,
                wife_id: gender === 'female' ? member.id : spouseId,
                divorce_date: divorceDate || new Date().toISOString().split('T')[0],
                family_id: currentFamilyId // ✨ 傳遞當前家族 ID
            });
            
            // Optionally remove from current family tree view if it's an in-law
            if (window.confirm('是否同時將該配偶從當前家族視角中移除？\n(移除後仍可在搜尋庫中找到)')) {
                setSpouses([]); // Remove from current spouse list
            }
            
            alert('離婚手續維護成功。');
        } catch (err) {
            console.error('Divorce handle failed:', err);
            alert('處裡失敗。');
        } finally {
            setIsDivorcing(false);
        }
    };

    const handleAvatarChange = async (e) => {
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
            alert('上傳失敗：' + (error.response?.data?.error || error.message));
        } finally {
            setAvatarUploading(false);
            e.target.value = '';
        }
    };

    const handleBiographyEdit = async () => {
        await handleSubmit();
        navigate(`/member/${member.id}/biography/edit`);
    };

    const maleMembers = useMemo(() => allMembers.filter(m => m.gender === 'male' && m.id !== member.id), [allMembers, member.id]);
    const femaleMembers = useMemo(() => allMembers.filter(m => m.gender === 'female' && m.id !== member.id), [allMembers, member.id]);
    const otherMembers = useMemo(() => allMembers.filter(m => m.id !== member.id), [allMembers, member.id]);

    return (
        <div className="side-panel-overlay" onClick={onCancel}>
            <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="side-panel"
                style={{ 
                    width: window.innerWidth < 768 ? '100vw' : '700px', 
                    maxWidth: '100vw', 
                    height: window.innerWidth < 768 ? '100vh' : 'auto', 
                    maxHeight: window.innerWidth < 768 ? '100vh' : '800px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: window.innerWidth < 768 ? '0' : '12px 0 0 12px'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="panel-header" style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>編輯成員資訊</h3>
                        <small style={{ color: '#94a3b8', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>ID: {member.id}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleBiographyEdit}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '6px', 
                                padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                background: 'white', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
                            }}
                        >
                            <FileText size={14} /> 編輯生平
                        </button>
                        <button 
                            onClick={onCancel}
                            style={{ background: '#f8fafc', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="panel-content">
                    {/* 頂部：頭像 + 核心狀態 */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                        <User size={32} color="#94a3b8" />
                                    </div>
                                )}
                            </div>
                            <label style={{ 
                                position: 'absolute', bottom: '-4px', right: '-4px', width: '28px', height: '28px', 
                                background: 'var(--accent-color)', borderRadius: '50%', border: '2px solid white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white'
                            }}>
                                <Camera size={14} />
                                <input type="file" hidden onChange={handleAvatarChange} accept="image/*" />
                            </label>
                        </div>

                        <div style={{ 
                            flex: 1, 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(4, 1fr)', 
                            gap: '12px' 
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{MEMBER_FIELDS.surname.label}</label>
                                <input style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }} value={surname} onChange={e => setSurname(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{MEMBER_FIELDS.given_name.label}</label>
                                <input style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }} value={givenName} onChange={e => setGivenName(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{MEMBER_FIELDS.gender.label}</label>
                                <select style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white' }} value={gender} onChange={e => setGender(e.target.value)}>
                                    <option value="male">男</option>
                                    <option value="female">女</option>
                                </select>
                                {hasPermission('super_admin') && (
                                    <button
                                        onClick={() => navigate(`/admin/dashboard?target_id=${member.id}`)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 'var(--radius-full)',
                                            background: 'rgba(79, 70, 229, 0.05)',
                                            color: 'var(--primary-color)',
                                            border: '1px solid rgba(79, 70, 229, 0.1)',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <History size={14} /> 查看歷史記錄
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '16px' }}>
                                    <input type="checkbox" checked={isDeceased} onChange={e => setIsDeceased(e.target.checked)} />
                                    已過世
                                </label>
                            </div>
                        </div>
                    </div>

                    <form style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* 第二排：字/號/曾用名 */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr 1.5fr', 
                            gap: '12px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '30px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.courtesy_name.label}</label>
                                <input style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={courtesyName} onChange={e => setCourtesyName(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '30px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.pseudonym.label}</label>
                                <input style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={pseudonym} onChange={e => setPseudonym(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '50px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.aliases.label}</label>
                                <input placeholder="逗號分隔" style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={aliases} onChange={e => setAliases(e.target.value)} />
                            </div>
                        </div>

                        {/* 第三排：國籍/出生地/最高學歷 */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1.5fr 1fr', 
                            gap: '12px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '30px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.nationality.label}</label>
                                <input style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={nationality} onChange={e => setNationality(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '50px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.birth_place.label}</label>
                                <input style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={birthPlace} onChange={e => setBirthPlace(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '30px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.education.label}</label>
                                <input style={{ flex: 1, padding: '7px', borderRadius: '4px', border: '1px solid #e5e7eb' }} value={education} onChange={e => setEducation(e.target.value)} />
                            </div>
                        </div>

                        {/* 第四排：曾經任職 (Strong) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ minWidth: '80px', fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>{MEMBER_FIELDS.occupation.label}</label>
                            <input 
                                style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }} 
                                placeholder="歷史職稱、官銜或社會貢獻核心內容..." 
                                value={occupation} onChange={e => setOccupation(e.target.value)} 
                            />
                        </div>

                        {/* 第五排：堂號/祖籍 (Secondary) */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', 
                            gap: '12px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '40px', fontSize: '12px', color: '#94a3b8' }}>{MEMBER_FIELDS.clan_name.label}</label>
                                <input style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9', fontSize: '12px' }} value={clanName} onChange={e => setClanName(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '40px', fontSize: '12px', color: '#94a3b8' }}>{MEMBER_FIELDS.ancestral_home.label}</label>
                                <input style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #f1f5f9', fontSize: '12px' }} value={ancestralHome} onChange={e => setAncestralHome(e.target.value)} />
                            </div>
                        </div>

                        {/* 日期區域 (Two Column) */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', 
                            gap: '16px', 
                            background: '#f8fafc', 
                            padding: '10px', 
                            borderRadius: '8px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '60px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.birth_date_full.label}</label>
                                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                    <input style={{ width: '75px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="年份" value={birthYear} onChange={e => setBirthYear(e.target.value)} /> /
                                    <input style={{ width: '45px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="月" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} /> /
                                    <input style={{ width: '45px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="日" value={birthDay} onChange={e => setBirthDay(e.target.value)} />
                                </div>
                            </div>
                            {isDeceased && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ minWidth: '60px', fontSize: '13px', color: '#64748b' }}>{MEMBER_FIELDS.death_date_full.label}</label>
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        <input style={{ width: '75px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="年份" value={deathYear} onChange={e => setDeathYear(e.target.value)} /> /
                                        <input style={{ width: '45px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="月" value={deathMonth} onChange={e => setDeathMonth(e.target.value)} /> /
                                        <input style={{ width: '45px', padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'center' }} placeholder="日" value={deathDay} onChange={e => setDeathDay(e.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 鏈結區域 (Grid) */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', 
                            gap: '12px' 
                        }}>
                            <SearchableSelector label="父親" value={fatherId} options={maleMembers} allMembers={allMembers} onChange={setFatherId} gender="male" horizontal />
                            <SearchableSelector label="母親" value={motherId} options={femaleMembers} allMembers={allMembers} onChange={setMotherId} gender="female" horizontal />
                        </div>
                        
                        {/* 配偶維護 + 離婚功能 */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                            <div style={{ flex: 1 }}>
                                <SearchableSelector 
                                    label="配偶" value={spouses[0] || ''} options={otherMembers} allMembers={allMembers} 
                                    onChange={(val) => setSpouses(val ? [val] : [])} horizontal 
                                />
                            </div>
                            {spouses[0] && (
                                <button 
                                    type="button"
                                    onClick={() => setIsDivorcing(!isDivorcing)}
                                    style={{ 
                                        marginTop: '10px', padding: '6px 12px', borderRadius: '6px', 
                                        border: '1px solid #f97316', background: isDivorcing ? '#f97316' : 'white', 
                                        color: isDivorcing ? 'white' : '#f97316', fontSize: '12px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    <HeartOff size={14} /> 辦理離婚
                                </button>
                            )}
                        </div>

                        {isDivorcing && (
                             <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ padding: '10px', background: '#fff', border: '1px dashed #f97316', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', color: '#f97316' }}>離婚日期:</label>
                                    <input type="date" value={divorceDate} onChange={e => setDivorceDate(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }} />
                                    <button 
                                        type="button" onClick={handleDivorce}
                                        style={{ padding: '6px 16px', background: '#f97316', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        確認離婚登記
                                    </button>
                                </div>
                             </motion.div>
                        )}

                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1.5fr', 
                            gap: '12px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '40px', fontSize: '13px' }}>{MEMBER_FIELDS.phone.label}</label>
                                <input style={{ flex: 1, padding: '7px', border: '1px solid #e5e7eb', borderRadius: '4px' }} value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ minWidth: '40px', fontSize: '13px' }}>{MEMBER_FIELDS.email.label}</label>
                                <input style={{ flex: 1, padding: '7px', border: '1px solid #e5e7eb', borderRadius: '4px' }} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ minWidth: '40px', fontSize: '13px' }}>{MEMBER_FIELDS.remark.label}</label>
                            <input style={{ flex: 1, padding: '7px', border: '1px solid #e5e7eb', borderRadius: '4px' }} value={remark} onChange={e => setRemark(e.target.value)} />
                        </div>

                        <div style={{ 
                            marginTop: '4px', paddingTop: '12px', borderTop: '1px solid #f1f5f9',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <button 
                                type="button"
                                onClick={() => onDelete(member.id)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', 
                                    borderRadius: '8px', background: '#fff1f2', color: '#e11d48', border: 'none',
                                    fontWeight: '600', cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} /> 刪除成員
                            </button>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={onCancel} style={{ padding: '8px 20px', borderRadius: '8px', background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}>取消</button>
                                <button 
                                    type="button" onClick={handleSubmit} disabled={saving}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 30px', 
                                        borderRadius: '8px', background: 'var(--accent-color)', color: 'white', border: 'none',
                                        fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <Save size={16} /> {saving ? '保存中...' : '保存內容'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default EditMemberPanel;
