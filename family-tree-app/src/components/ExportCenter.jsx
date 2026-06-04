import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';
import { Loader2, Download, Printer, FileText, Database, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ExportCenter = () => {
    const { currentFamilyId, hasPermission } = useAuth();
    const { isTraditional } = useLanguage();
    const navigate = useNavigate();
    const [family, setFamily] = useState([]);
    const [loading, setLoading] = useState(true);

    const isFamilyAdmin = hasPermission('family_admin');

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
                console.error("Error fetching family for export:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchFamily();
    }, [currentFamilyId]);

    // 匯出 CSV
    const handleExportCSV = () => {
        if (family.length === 0) return;
        
        const headers = ['ID', '姓名', '性別', '世代', '父親ID', '母親ID', '配偶ID', '出生年', '逝世年', '聯絡電話'];
        const csvRows = [headers.join(',')];
        
        family.forEach(m => {
            // 解析父母
            let fatherId = '', motherId = '';
            if (m.parents && Array.isArray(m.parents) && m.parents.length > 0) {
                const p1 = family.find(f => f.id === m.parents[0]);
                const p2 = family.find(f => f.id === m.parents[1]);
                if (p1) {
                    if (p1.gender === 'male') fatherId = p1.id;
                    else if (p1.gender === 'female') motherId = p1.id;
                }
                if (p2) {
                    if (p2.gender === 'male') fatherId = p2.id;
                    else if (p2.gender === 'female') motherId = p2.id;
                }
            }

            const row = [
                m.id,
                `"${m.name || ''}"`,
                m.gender === 'male' ? '男' : (m.gender === 'female' ? '女' : ''),
                m.generation || '',
                fatherId,
                motherId,
                (m.spouses || []).join(';'),
                m.birth_year || '',
                m.death_year || '',
                `"${m.phone || ''}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = "\uFEFF" + csvRows.join('\n'); // Add BOM for Excel
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `familia_members_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 匯出 GEDCOM 5.5
    const handleExportGEDCOM = () => {
        if (family.length === 0) return;

        let gedcom = `0 HEAD\n1 SOUR Familia_App\n1 CHAR UTF-8\n`;
        
        // Individuals
        family.forEach(m => {
            gedcom += `0 @${m.id}@ INDI\n`;
            // 姓名 (格式: 名 /姓/)
            const surname = m.surname || '';
            const givenName = m.given_name || m.name || '';
            gedcom += `1 NAME ${givenName} /${surname}/\n`;
            // 性別
            if (m.gender === 'male') gedcom += `1 SEX M\n`;
            else if (m.gender === 'female') gedcom += `1 SEX F\n`;
            
            // 出生
            if (m.birth_year) {
                gedcom += `1 BIRT\n`;
                if (m.birth_month && m.birth_day) {
                    gedcom += `2 DATE ${m.birth_year}-${String(m.birth_month).padStart(2, '0')}-${String(m.birth_day).padStart(2, '0')}\n`;
                } else {
                    gedcom += `2 DATE ${m.birth_year}\n`;
                }
            }
            
            // 逝世
            if (m.is_deceased) {
                gedcom += `1 DEAT\n`;
                if (m.death_year) {
                    if (m.death_month && m.death_day) {
                        gedcom += `2 DATE ${m.death_year}-${String(m.death_month).padStart(2, '0')}-${String(m.death_day).padStart(2, '0')}\n`;
                    } else {
                        gedcom += `2 DATE ${m.death_year}\n`;
                    }
                }
            }
        });

        // Families (Marriages / Parent-Child relationships)
        const exportedFamilies = new Set();
        let famCounter = 1;

        family.forEach(m => {
            if (m.spouses && m.spouses.length > 0) {
                m.spouses.forEach(spouseId => {
                    // 為了避免重複建立 Family (A-B 和 B-A)
                    const pairKey = [m.id, spouseId].sort().join('_');
                    if (!exportedFamilies.has(pairKey)) {
                        exportedFamilies.add(pairKey);
                        gedcom += `0 @F${famCounter}@ FAM\n`;
                        
                        if (m.gender === 'male') {
                            gedcom += `1 HUSB @${m.id}@\n1 WIFE @${spouseId}@\n`;
                        } else {
                            gedcom += `1 HUSB @${spouseId}@\n1 WIFE @${m.id}@\n`;
                        }
                        
                        // 尋找這對配偶的共同小孩
                        const children = family.filter(child => 
                            child.parents && 
                            child.parents.includes(m.id) && 
                            child.parents.includes(spouseId)
                        );
                        children.forEach(c => {
                            gedcom += `1 CHIL @${c.id}@\n`;
                        });
                        
                        famCounter++;
                    }
                });
            }
        });

        gedcom += `0 TRLR\n`;

        const blob = new Blob([gedcom], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `familia_export_${new Date().getTime()}.ged`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
                    {isTraditional ? '匯出與列印中心' : '汇出与打印中心'}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>
                    {isTraditional ? '將家族資料永久保存，或轉換為國際通用格式' : '将家族资料永久保存，或转换为国际通用格式'}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* 列印紙本族譜 */}
                <motion.div 
                    whileHover={{ y: -5 }}
                    className="glass-card"
                    style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e5e7eb' }}
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                        <Printer size={32} color="#3b82f6" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                        {isTraditional ? '列印紙本族譜' : '打印纸本族谱'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', flex: 1 }}>
                        {isTraditional ? '為您的家族生成一份排版精美的 A4 實體書本，適合於家族聚會時傳閱。' : '为您的家族生成一份排版精美的 A4 实体书本，适合于家族聚会时传阅。'}
                    </p>
                    <button 
                        onClick={() => navigate('/tree')}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {isTraditional ? '前往家族樹列印' : '前往家族树打印'}
                    </button>
                </motion.div>

                {/* 匯出 GEDCOM */}
                <motion.div 
                    whileHover={{ y: -5 }}
                    className="glass-card"
                    style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e5e7eb', opacity: isFamilyAdmin ? 1 : 0.6 }}
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                        <Share2 size={32} color="#10b981" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                        {isTraditional ? '匯出 GEDCOM 檔案' : '汇出 GEDCOM 档案'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', flex: 1 }}>
                        {isTraditional ? '將資料匯出為國際標準 .ged 格式，可匯入至 MyHeritage 等專業族譜軟體。' : '将资料汇出为国际标准 .ged 格式，可汇入至 MyHeritage 等专业族谱软件。'}
                    </p>
                    <button 
                        onClick={handleExportGEDCOM}
                        disabled={!isFamilyAdmin}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: isFamilyAdmin ? '#10b981' : '#d1d5db', color: 'white', fontWeight: 600, cursor: isFamilyAdmin ? 'pointer' : 'not-allowed' }}
                    >
                        {isTraditional ? (isFamilyAdmin ? '下載 .ged' : '需要管理員權限') : (isFamilyAdmin ? '下载 .ged' : '需要管理员权限')}
                    </button>
                </motion.div>

                {/* 匯出 CSV */}
                <motion.div 
                    whileHover={{ y: -5 }}
                    className="glass-card"
                    style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e5e7eb', opacity: isFamilyAdmin ? 1 : 0.6 }}
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fff7ed', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
                        <Database size={32} color="#f97316" />
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                        {isTraditional ? '匯出人員名冊 (CSV)' : '汇出人员名册 (CSV)'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', flex: 1 }}>
                        {isTraditional ? '下載包含姓名、聯絡方式與基本資料的 Excel 相容名單，方便日常聯絡。' : '下载包含姓名、联络方式与基本资料的 Excel 相容名单，方便日常联络。'}
                    </p>
                    <button 
                        onClick={handleExportCSV}
                        disabled={!isFamilyAdmin}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: isFamilyAdmin ? '#f97316' : '#d1d5db', color: 'white', fontWeight: 600, cursor: isFamilyAdmin ? 'pointer' : 'not-allowed' }}
                    >
                        {isTraditional ? (isFamilyAdmin ? '下載 CSV' : '需要管理員權限') : (isFamilyAdmin ? '下载 CSV' : '需要管理员权限')}
                    </button>
                </motion.div>

            </div>
        </div>
    );
};

export default ExportCenter;
