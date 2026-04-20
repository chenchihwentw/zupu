import React, { useState } from 'react';
import axios from 'axios';

const AddMemberModal = ({ allMembers, onSave, onCancel }) => {
    const [name, setName] = useState('');
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
    const [address, setAddress] = useState('');
    const [remark, setRemark] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nationality, setNationality] = useState('');
    const [birthPlace, setBirthPlace] = useState('');

    const [fatherId, setFatherId] = useState('');
    const [motherId, setMotherId] = useState('');
    const [spouseId, setSpouseId] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Please enter a name');
            return;
        }
        
        setSaving(true);
        
        // Combine father and mother into parents array
        const newParents = [];
        if (fatherId) newParents.push(fatherId);
        if (motherId) newParents.push(motherId);
        
        // 組合死亡日期為 YYYY-MM-DD 格式
        let deathDate = null;
        if (deathYear || deathMonth || deathDay) {
            const year = deathYear || '0000';
            const month = deathMonth ? String(deathMonth).padStart(2, '0') : '01';
            const day = deathDay ? String(deathDay).padStart(2, '0') : '01';
            deathDate = `${year}-${month}-${day}`;
        }
        
        // 組合出生日期為 YYYY-MM-DD 格式
        let birthDate = null;
        if (birthYear || birthMonth || birthDay) {
            const year = birthYear || '0000';
            const month = birthMonth ? String(birthMonth).padStart(2, '0') : '01';
            const day = birthDay ? String(birthDay).padStart(2, '0') : '01';
            birthDate = `${year}-${month}-${day}`;
        }
        
        const newMember = {
            id: Date.now().toString(),
            name,
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
            phone,
            address,
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

    // Handle avatar upload with compression
    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size should be less than 5MB');
            return;
        }

        setAvatarUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'avatar');

        try {
            const response = await axios.post('/api/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setAvatarUrl(response.data.url);
                alert('Avatar uploaded successfully!');
            }
        } catch (error) {
            console.error('Avatar upload failed:', error);
            alert('Upload failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setAvatarUploading(false);
            e.target.value = '';
        }
    };

    const styles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
        },
        modal: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '32px',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--glass-border)',
            fontFamily: 'var(--font-body)'
        },
        title: {
            fontFamily: 'var(--font-heading)',
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '24px',
            color: 'var(--text-main)',
            textAlign: 'center'
        },
        inputGroup: {
            marginBottom: '20px'
        },
        label: {
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            fontSize: '14px',
            color: 'var(--text-main)'
        },
        input: {
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e5e7eb',
            boxSizing: 'border-box',
            fontSize: '15px',
            transition: 'var(--transition)',
            outline: 'none'
        },
        select: {
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e5e7eb',
            boxSizing: 'border-box',
            fontSize: '15px',
            appearance: 'none',
            backgroundColor: 'white',
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '16px'
        },
        checkboxContainer: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
        },
        checkbox: {
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            cursor: 'pointer'
        },
        actions: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #f3f4f6'
        },
        button: {
            padding: '10px 24px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'var(--transition)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
        },
        saveBtn: {
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
        },
        cancelBtn: {
            backgroundColor: '#f3f4f6',
            color: 'var(--text-main)',
            border: '1px solid #e5e7eb'
        }
    };

    // Filter potential parents
    const potentialFathers = allMembers.filter(m => m.gender === 'male');
    const potentialMothers = allMembers.filter(m => m.gender === 'female');
    const potentialSpouses = allMembers;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h3>添加新成员</h3>
                <form onSubmit={handleSubmit}>
                    {/* Name */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Name *</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Enter name"
                            required
                        />
                    </div>

                    {/* Gender */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Gender</label>
                        <select
                            style={styles.select}
                            value={gender}
                            onChange={e => setGender(e.target.value)}
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>

                    {/* Avatar Upload */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Avatar Photo</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            {avatarUrl && (
                                <img 
                                    src={avatarUrl} 
                                    alt="Avatar Preview" 
                                    style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e8e8e8' }} 
                                />
                            )}
                            <label style={{ ...styles.button, backgroundColor: '#52c41a', color: 'white', cursor: 'pointer', display: 'inline-block' }}>
                                📷 Upload Avatar
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    style={{ display: 'none' }}
                                    disabled={avatarUploading}
                                />
                            </label>
                            {avatarUploading && <span style={{ color: '#faad14', fontSize: '13px' }}>Uploading...</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            Max 5MB. Will be compressed to 40x40 for avatar.
                        </div>
                    </div>

                    {/* Birth Date */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Birth Date</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                                style={{ ...styles.input, flex: 2 }}
                                type="number"
                                placeholder="YYYY"
                                value={birthYear}
                                onChange={e => setBirthYear(e.target.value)}
                            />
                            <input
                                style={{ ...styles.input, flex: 1 }}
                                type="number"
                                placeholder="MM"
                                min="1"
                                max="12"
                                value={birthMonth}
                                onChange={e => setBirthMonth(e.target.value)}
                            />
                            <input
                                style={{ ...styles.input, flex: 1 }}
                                type="number"
                                placeholder="DD"
                                min="1"
                                max="31"
                                value={birthDay}
                                onChange={e => setBirthDay(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Is Deceased */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>
                            <input
                                type="checkbox"
                                style={styles.checkbox}
                                checked={isDeceased}
                                onChange={e => setIsDeceased(e.target.checked)}
                            />
                            Deceased
                        </label>
                    </div>

                    {/* Death Date (only if deceased) */}
                    {isDeceased && (
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Death Date</label>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                    style={{ ...styles.input, flex: 2 }}
                                    type="number"
                                    placeholder="YYYY"
                                    value={deathYear}
                                    onChange={e => setDeathYear(e.target.value)}
                                />
                                <input
                                    style={{ ...styles.input, flex: 1 }}
                                    type="number"
                                    placeholder="MM"
                                    min="1"
                                    max="12"
                                    value={deathMonth}
                                    onChange={e => setDeathMonth(e.target.value)}
                                />
                                <input
                                    style={{ ...styles.input, flex: 1 }}
                                    type="number"
                                    placeholder="DD"
                                    min="1"
                                    max="31"
                                    value={deathDay}
                                    onChange={e => setDeathDay(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Email */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            style={styles.input}
                            type="email"
                            placeholder="For login"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Phone */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>
                            Phone
                            <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                                Format: +886-912-345-678
                            </span>
                        </label>
                        <input
                            style={styles.input}
                            type="tel"
                            placeholder="+886-912-345-678"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                        />
                    </div>

                    {/* Education / Occupation */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={styles.label}>Nationality</label>
                            <input
                                style={styles.input}
                                value={nationality}
                                onChange={e => setNationality(e.target.value)}
                                placeholder="China"
                            />
                        </div>
                        <div>
                            <label style={styles.label}>Birth Place</label>
                            <input
                                style={styles.input}
                                value={birthPlace}
                                onChange={e => setBirthPlace(e.target.value)}
                                placeholder="Beijing"
                            />
                        </div>
                    </div>

                    {/* Father */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Father</label>
                        <select
                            style={styles.select}
                            value={fatherId}
                            onChange={e => setFatherId(e.target.value)}
                        >
                            <option value="">None</option>
                            {potentialFathers.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} -- {p.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Mother */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Mother</label>
                        <select
                            style={styles.select}
                            value={motherId}
                            onChange={e => setMotherId(e.target.value)}
                        >
                            <option value="">None</option>
                            {potentialMothers.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} -- {p.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Spouse */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Spouse</label>
                        <select
                            style={styles.select}
                            value={spouseId}
                            onChange={e => setSpouseId(e.target.value)}
                        >
                            <option value="">None</option>
                            {potentialSpouses.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} -- {p.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Address */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Address</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                        />
                    </div>

                    {/* Remark */}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Remark</label>
                        <textarea
                            style={{ ...styles.input, height: '60px' }}
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                        />
                    </div>

                    {/* Buttons */}
                    <div style={styles.actions}>
                        <button type="button" style={{ ...styles.button, ...styles.cancelBtn }} onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" style={{ ...styles.button, ...styles.saveBtn }} disabled={saving}>
                            {saving ? 'Saving...' : 'Add Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMemberModal;
