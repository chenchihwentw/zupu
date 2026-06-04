import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import { Loader2, Baby, Cross, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FamilyTimeline = () => {
    const { currentFamilyId } = useAuth();
    const { isTraditional } = useLanguage();
    const navigate = useNavigate();
    const [family, setFamily] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFamily = async () => {
            setLoading(true);
            try {
                const url = `/api/my-family-tree?family_id=${encodeURIComponent(currentFamilyId || '')}`;
                const res = await axios.get(url, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.data && res.data.members) {
                    setFamily(res.data.members);
                }
            } catch (err) {
                console.error("Error fetching family for timeline:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchFamily();
    }, [currentFamilyId]);

    // 將所有人的生卒事件抽出並排序
    const timelineEvents = useMemo(() => {
        const events = [];
        family.forEach(m => {
            // 出生事件
            if (m.birth_year) {
                events.push({
                    id: `${m.id}-birth`,
                    memberId: m.id,
                    year: m.birth_year,
                    month: m.birth_month,
                    day: m.birth_day,
                    type: 'birth',
                    title: isTraditional ? `${m.name} 誕生` : `${m.name} 诞生`,
                    description: isTraditional ? `${m.name} 出生於 ${m.birth_year} 年` : `${m.name} 出生于 ${m.birth_year} 年`,
                    member: m
                });
            }
            // 逝世事件
            if (m.is_deceased && m.death_year) {
                const age = m.birth_year ? m.death_year - m.birth_year : '?';
                events.push({
                    id: `${m.id}-death`,
                    memberId: m.id,
                    year: m.death_year,
                    month: m.death_month,
                    day: m.death_day,
                    type: 'death',
                    title: isTraditional ? `${m.name} 辭世` : `${m.name} 辞世`,
                    description: isTraditional ? `享年 ${age} 歲` : `享年 ${age} 岁`,
                    member: m
                });
            }
        });

        // 依年份與月份排序 (由古至今)
        return events.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            const aMonth = a.month || 0;
            const bMonth = b.month || 0;
            if (aMonth !== bMonth) return aMonth - bMonth;
            const aDay = a.day || 0;
            const bDay = b.day || 0;
            return aDay - bDay;
        });
    }, [family, isTraditional]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary-color)" />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                    {isTraditional ? '家族大事記' : '家族大事记'}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    {isTraditional ? '回顧家族的世代傳承與歷史足跡' : '回顾家族的世代传承与历史足迹'}
                </p>
            </div>

            {timelineEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                    {isTraditional ? '暫無家族事件紀錄，請先完善成員的出生與逝世年份。' : '暂无家族事件纪录，请先完善成员的出生与逝世年份。'}
                </div>
            ) : (
                <div style={{ position: 'relative', paddingLeft: '20px' }}>
                    {/* Vertical Line */}
                    <div style={{
                        position: 'absolute',
                        left: '42px',
                        top: '0',
                        bottom: '0',
                        width: '4px',
                        background: 'linear-gradient(to bottom, var(--primary-color), var(--secondary-color))',
                        borderRadius: '2px',
                        opacity: 0.3
                    }}></div>

                    {timelineEvents.map((ev, index) => {
                        const isBirth = ev.type === 'birth';
                        const Icon = isBirth ? Baby : Cross;
                        const iconColor = isBirth ? '#10b981' : '#6b7280';
                        const bgColor = isBirth ? '#ecfdf5' : '#f3f4f6';

                        return (
                            <motion.div
                                key={ev.id}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.4, delay: index % 10 * 0.05 }}
                                style={{ display: 'flex', gap: '24px', marginBottom: '32px', position: 'relative' }}
                            >
                                {/* Year Badge */}
                                <div style={{
                                    width: '80px',
                                    textAlign: 'right',
                                    paddingTop: '8px',
                                    fontWeight: 900,
                                    fontSize: '24px',
                                    color: 'var(--primary-color)',
                                    opacity: 0.8
                                }}>
                                    {ev.year}
                                </div>

                                {/* Icon Node */}
                                <div style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    border: `3px solid ${iconColor}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10,
                                    flexShrink: 0,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                }}>
                                    <Icon size={20} color={iconColor} />
                                </div>

                                {/* Content Card */}
                                <div 
                                    className="glass-card"
                                    onClick={() => navigate(`/member/${ev.memberId}`)}
                                    style={{
                                        flex: 1,
                                        padding: '16px 20px',
                                        borderRadius: '16px',
                                        backgroundColor: bgColor,
                                        border: `1px solid ${isBirth ? '#d1fae5' : '#e5e7eb'}`,
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    {/* Avatar */}
                                    {ev.member.avatar_url ? (
                                        <img 
                                            src={ev.member.avatar_url}
                                            alt={ev.member.name}
                                            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={24} color="#94a3b8" />
                                        </div>
                                    )}

                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {ev.title}
                                        </div>
                                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {ev.month && ev.day ? `${ev.month}月${ev.day}日 · ` : ''}{ev.description}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FamilyTimeline;
