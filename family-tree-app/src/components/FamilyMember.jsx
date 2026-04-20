import React from 'react';
import * as OpenCC from 'opencc-js';
import { motion } from 'framer-motion';
import { Edit2, Plus, User, Repeat, Award } from 'lucide-react';

const FamilyMember = ({ 
    id,
    member, 
    onEdit, 
    onAddRelative, 
    isInLaw, 
    isExternal,
    onViewPerspective, 
    isHighlighted, 
    onFocus,
    isTraditional, 
    canEdit = true,
    orientation = 'vertical' // 'vertical' (fine strip) | 'horizontal' (pro card)
}) => {
    const converter = isTraditional ? OpenCC.Converter({ from: 'cn', to: 'tw' }) : null;
    const isMale = member.gender === 'male';
    const isDeceased = !!member.is_deceased;
    const isShared = isExternal && !isInLaw; // 既不是姻親但又來自外部（例如共享的祖先）

    const calculateAge = () => {
        if (member.birth_date && member.birth_date.trim()) {
            try {
                const birthDate = new Date(member.birth_date);
                if (!isNaN(birthDate.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    return age > 0 ? age : null;
                }
            } catch (e) {}
        }
        if (member.birth_year) {
            const currentYear = new Date().getFullYear();
            const age = currentYear - member.birth_year;
            return age > 0 ? age : null;
        }
        return null;
    };
    
    const age = calculateAge();
    const isHorizontal = orientation === 'horizontal';

    const getAvatar = () => {
        if (member.avatar_url && member.avatar_url.trim()) {
            return (
                <img 
                    src={member.avatar_url} 
                    alt={member.name}
                    style={{
                        width: isHorizontal ? '48px' : '36px',
                        height: isHorizontal ? '48px' : '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid white',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                />
            );
        }
        const name = member.name || '';
        let emoji = isMale ? '👦' : '👧';
        if (name.includes('爺') || name.includes('公')) emoji = '👴';
        if (name.includes('奶') || name.includes('婆')) emoji = '👵';
        if (name.includes('父') || name.includes('爸')) emoji = '👨';
        if (name.includes('母') || name.includes('媽')) emoji = '👩';
        
        return (
            <div style={{
                width: isHorizontal ? '48px' : '36px',
                height: isHorizontal ? '48px' : '36px',
                borderRadius: '50%',
                backgroundColor: isMale ? '#e0f2fe' : '#fce7f3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isHorizontal ? '24px' : '20px',
                border: '2px solid white',
                boxShadow: 'var(--shadow-sm)'
            }}>
                {emoji}
            </div>
        );
    };

    const containerStyle = {
        position: 'relative',
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: 'center',
        gap: isHorizontal ? '12px' : '4px',
        padding: isHorizontal ? '10px 16px' : '8px 4px',
        width: isHorizontal ? '200px' : '44px',
        height: isHorizontal ? '80px' : '150px',
        borderRadius: isHorizontal ? 'var(--radius-md)' : 'var(--radius-sm)',
        backgroundColor: isDeceased ? '#f3f4f6' : 'white',
        border: '1px solid',
        borderColor: isHighlighted ? 'var(--primary-color)' : (isDeceased ? '#e5e7eb' : 'rgba(255,255,255,0.8)'),
        boxShadow: isHighlighted ? '0 0 0 2px var(--primary-color), var(--shadow-md)' : 'var(--shadow-md)',
        cursor: 'pointer',
        transition: 'var(--transition)',
        zIndex: 10,
        filter: isDeceased ? 'grayscale(40%) opacity(0.8)' : 'none',
        borderBottom: `4px solid ${isMale ? '#3b82f6' : '#ec4899'}`
    };

    return (
        <motion.div 
            id={id || member.id}
            whileHover={{ y: -4, boxShadow: 'var(--shadow-xl)', backgroundColor: 'rgba(255,255,255,1)' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={containerStyle}
            onClick={(e) => {
            if (e.target.closest('.action-btn')) return;
            onFocus && onFocus(member);
        }}
    >
        {/* Biography Icon (Top Right) */}
        {!!member.has_biography && (
            <div 
                style={{ 
                    position: 'absolute', 
                    top: '4px', 
                    right: '4px', 
                    color: 'var(--accent-color)', 
                    zIndex: 5,
                    backgroundColor: 'rgba(255,215,0,0.2)',
                    padding: '2px',
                    borderRadius: '4px'
                }}
            >
                <Award size={12} fill="currentColor" />
            </div>
        )}

        {/* Action Layer (Visible on Hover) */}
        <motion.div 
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                pointerEvents: 'none'
            }}
        >
            {/* Four-Way Add Buttons */}
            {canEdit && !isHorizontal && (
                <div style={{ pointerEvents: 'auto' }}>
                    {/* Top: Parent (Hide if both parents exist) */}
                    {(member.parents?.length || 0) < 2 && (
                        <button 
                            className="action-btn"
                            onClick={(e) => { e.stopPropagation(); onAddRelative(member, 'parent'); }}
                            style={{
                                ...edgeButtonStyle,
                                top: '-10px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                backgroundColor: '#6366f1',
                            }}
                            title="添加父母"
                        >
                            <Plus size={11} />
                        </button>
                    )}
                    {/* Bottom: Child */}
                    <button 
                        className="action-btn"
                        onClick={(e) => { e.stopPropagation(); onAddRelative(member, 'child'); }}
                        style={{
                            ...edgeButtonStyle,
                            bottom: '-10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#10b981',
                        }}
                        title="添加子女"
                    >
                        <Plus size={11} />
                    </button>
                    {/* Left: Sibling (Hide if no parents) */}
                    {(member.parents?.length || 0) > 0 && (
                        <button 
                            className="action-btn"
                            onClick={(e) => { e.stopPropagation(); onAddRelative(member, 'sibling'); }}
                            style={{
                                ...edgeButtonStyle,
                                left: '-10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#f59e0b',
                            }}
                            title="添加兄弟姐妹"
                        >
                            <Plus size={11} />
                        </button>
                    )}
                    {/* Right: Spouse (Hide if already has a spouse) */}
                    {(member.spouses?.length || 0) === 0 && (
                        <button 
                            className="action-btn"
                            onClick={(e) => { e.stopPropagation(); onAddRelative(member, 'spouse'); }}
                            style={{
                                ...edgeButtonStyle,
                                right: '-10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: '#ec4899',
                            }}
                            title="添加配偶"
                        >
                            <Plus size={11} />
                        </button>
                    )}
                </div>
            )}
        </motion.div>

            {/* Shared Member Badge */}
            {isShared && (
                <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '-8px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    zIndex: 10,
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid white'
                }}>
                    聯
                </div>
            )}

            {/* In-Law Badge */}
            {isInLaw && (
                <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '-8px',
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    zIndex: 10,
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid white'
                }}>
                    姻
                </div>
            )}

            {/* Biography Medal */}
            {!!member.has_biography && (
                <div 
                    className="action-btn"
                    style={{ 
                        position: 'absolute', 
                        top: '4px', 
                        right: '4px', 
                        color: 'var(--accent-color)', 
                        zIndex: 5,
                        backgroundColor: 'rgba(255,215,0,0.1)',
                        padding: '2px',
                        borderRadius: '4px'
                    }}
                    onClick={(e) => { e.stopPropagation(); window.location.href = `/member/${member.id}`; }}
                >
                    <Award size={12} fill="currentColor" />
                </div>
            )}

            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
                {getAvatar()}
            </div>

            {/* Info */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: isHorizontal ? 'flex-start' : 'center',
                textAlign: isHorizontal ? 'left' : 'center',
                flexGrow: 1,
                overflow: 'hidden'
            }}>
                <h4 style={{ 
                    fontSize: isHorizontal ? '15px' : '13px', 
                    fontWeight: 700,
                    color: '#1f2937',
                    writingMode: isHorizontal ? 'horizontal-tb' : 'vertical-rl',
                    textOrientation: 'upright',
                    letterSpacing: isHorizontal ? '0' : '1px',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis'
                }}>
                    {converter ? converter(member.name) : member.name}
                </h4>
                {age && (
                    <span style={{ 
                        fontSize: '10px', 
                        color: 'var(--text-light)',
                        marginTop: isHorizontal ? '0' : '2px'
                    }}>
                        {age} 歲
                    </span>
                )}
            </div>
        </motion.div>
    );
};

const edgeButtonStyle = {
    position: 'absolute',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    color: 'white',
    border: '2px solid white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-md)',
    zIndex: 25,
    cursor: 'pointer'
};

const actionBtnIconStyle = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-main)',
    color: 'white',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition)'
};

export default FamilyMember;
