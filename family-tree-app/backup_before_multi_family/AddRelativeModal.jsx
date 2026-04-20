import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AddRelativeModal = ({ baseMember, relativeType, allMembers, onSave, onCancel }) => {
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

    // Pre-filled values based on relative type
    const [fatherId, setFatherId] = useState('');
    const [motherId, setMotherId] = useState('');
    const [spouseId, setSpouseId] = useState('');

    // Set default values based on relative type when component mounts
    useEffect(() => {
        switch (relativeType) {
            case 'parent':
                // Parents: no pre-filled parents, gender can be either
                setFatherId('');
                setMotherId('');
                setSpouseId('');
                break;
                
            case 'child':
                // Child: base member is a parent
                if (baseMember.gender === 'male') {
                    setFatherId(baseMember.id);
                    setMotherId('');
                } else {
                    setFatherId('');
                    setMotherId(baseMember.id);
                }
                // Try to find spouse as the other parent
                if (baseMember.spouses && baseMember.spouses.length > 0) {
                    const spouse = allMembers.find(m => m.id === baseMember.spouses[0]);
                    if (spouse) {
                        if (baseMember.gender === 'male') {
                            setMotherId(spouse.id);
                        } else {
                            setFatherId(spouse.id);
                        }
                    }
                }
                break;
                
            case 'spouse':
                // Spouse: pre-fill the spouse field
                setSpouseId(baseMember.id);
                // Set opposite gender by default
                setGender(baseMember.gender === 'male' ? 'female' : 'male');
                break;
                
            case 'sibling':
                // Sibling: copy parents from base member
                const parents = baseMember.parents || [];
                const father = parents.find(pid => {
                    const p = allMembers.find(m => m.id === pid);
                    return p && p.gender === 'male';
                });
                const mother = parents.find(pid => {
                    const p = allMembers.find(m => m.id === pid);
                    return p && p.gender === 'female';
                });
                setFatherId(father || '');
                setMotherId(mother || '');
                break;
                
            default:
                break;
        }
    }, [baseMember, relativeType, allMembers]);

    const getTitle = () => {
        switch (relativeType) {
            case 'parent': return `为 ${baseMember.name} 添加父母`;
            case 'child': return `为 ${baseMember.name} 添加子女`;
            case 'spouse': return `为 ${baseMember.name} 添加配偶`;
            case 'sibling': return `为 ${baseMember.name} 添加兄弟姐妹`;
            default: return '添加成员';
        }
    };

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
        
        const newMember = {
            id: Date.now().toString(),
            name,
            gender,
            birth_year: birthYear ? parseInt(birthYear) : null,
            birth_month: birthMonth ? parseInt(birthMonth) : null,
            birth_day: birthDay ? parseInt(birthDay) : null,
            death_year: deathYear ? parseInt(deathYear) : null,
            death_month: deathMonth ? parseInt(deathMonth) : null,
            death_day: deathDay ? parseInt(deathDay) : null,
            is_deceased: isDeceased,
            email,
            phone,
            address,
            remark,
            avatar_url: avatarUrl,
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

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

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

    // Check if trying to add sibling without any parent
    const hasFather = baseMember.father_id || (baseMember.parents?.some(pid => {
        const p = allMembers.find(m => m.id === pid);
        return p?.gender === 'male';
    }));
    const hasMother = baseMember.mother_id || (baseMember.parents?.some(pid => {
        const p = allMembers.find(m => m.id === pid);
        return p?.gender === 'female';
    }));
    
    if (relativeType === 'sibling' && !hasFather && !hasMother) {
        return (
            <div style={styles.overlay}>
                <div style={styles.modal}>
                    <h3>無法添加兄弟姐妹</h3>
                    <div style={{ 
                        backgroundColor: '#fff2f0', 
                        border: '1px solid #ffccc7', 
                        borderRadius: '8px', 
                        padding: '20px', 
                        margin: '20px 0',
                        textAlign: 'center'
                    }}>
                        <p style={{ color: '#cf1322', margin: '0 0 15px 0' }}>
                            ⚠️ {baseMember.name} 沒有父母記錄
                        </p>
                        <p style={{ color: '#666', margin: '0 0 20px 0', fontSize: '14px' }}>
                            請先為 {baseMember.name} 添加父親或母親，然後才能添加兄弟姐妹。
                        </p>
                        <button 
                            onClick={onCancel}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#1890ff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            知道了
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const styles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        },
        modal: {
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '350px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxHeight: '90vh',
            overflowY: 'auto'
        },
        inputGroup: {
            marginBottom: '15px'
        },
        label: {
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold'
        },
        input: {
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            boxSizing: 'border-box'
        },
        select: {
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            boxSizing: 'border-box'
        },
        checkbox: {
            marginRight: '8px'
        },
        actions: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px'
        },
        button: {
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
        },
        saveBtn: {
            backgroundColor: '#1890ff',
            color: 'white'
        },
        cancelBtn: {
            backgroundColor: '#ccc',
            color: 'black'
        },
        infoBox: {
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '15px',
            fontSize: '13px',
            color: '#52c41a'
        }
    };

    // Filter potential parents
    const potentialFathers = allMembers.filter(m => m.gender === 'male');
    const potentialMothers = allMembers.filter(m => m.gender === 'female');

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h3>{getTitle()}</h3>
                
                <div style={styles.infoBox}>
                    💡 基于成员: <strong>{baseMember.name}</strong> ({baseMember.id})
                    <br/>
                    关系类型: <strong>
                        {relativeType === 'parent' && '父母'}
                        {relativeType === 'child' && '子女'}
                        {relativeType === 'spouse' && '配偶'}
                        {relativeType === 'sibling' && '兄弟姐妹'}
                    </strong>
                </div>

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

                    {/* Father - show for child and sibling types */}
                    {(relativeType === 'child' || relativeType === 'sibling') && (
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
                    )}

                    {/* Mother - show for child and sibling types */}
                    {(relativeType === 'child' || relativeType === 'sibling') && (
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
                    )}

                    {/* Spouse - show only for spouse type */}
                    {relativeType === 'spouse' && (
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Spouse (Auto-filled)</label>
                            <input
                                style={{ ...styles.input, backgroundColor: '#f5f5f5' }}
                                type="text"
                                value={baseMember.name}
                                disabled
                            />
                        </div>
                    )}

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

export default AddRelativeModal;
