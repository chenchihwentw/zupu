import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import RemindersPanel from './RemindersPanel';
import { Loader2 } from 'lucide-react';

const CalendarPage = () => {
    const { currentFamilyId, user } = useAuth();
    const { isTraditional } = useLanguage();
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
                console.error("Error fetching family for calendar:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchFamily();
    }, [currentFamilyId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary-color)" />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                    {isTraditional ? '重要日子行事曆' : '重要日子行事历'}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    {isTraditional ? '追蹤家族成員的生辰與祭祖忌日' : '追踪家族成员的生辰与祭祖忌日'}
                </p>
            </div>
            
            <RemindersPanel 
                family={family} 
                isTraditional={isTraditional} 
                user={user} 
            />
        </div>
    );
};

export default CalendarPage;
