import React, { useState, useMemo } from 'react';
import { Lunar, Solar } from 'lunar-javascript';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Heart, Bell, Info, Globe, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// 計算下一次日期距離今天的差值（天數）及具體陽曆日期
const getNextOccurrence = (month, day, isLunar) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  let nextDate;
  
  if (isLunar) {
    try {
      const lunarThisYear = Lunar.fromYmd(currentYear, month, day);
      const solarThisYear = lunarThisYear.getSolar();
      const dateThisYear = new Date(solarThisYear.getYear(), solarThisYear.getMonth() - 1, solarThisYear.getDay());
      dateThisYear.setHours(0, 0, 0, 0);
      
      if (dateThisYear >= today) {
        nextDate = dateThisYear;
      } else {
        const lunarNextYear = Lunar.fromYmd(currentYear + 1, month, day);
        const solarNextYear = lunarNextYear.getSolar();
        nextDate = new Date(solarNextYear.getYear(), solarNextYear.getMonth() - 1, solarNextYear.getDay());
      }
    } catch (e) {
      console.warn('Lunar date error:', e);
      return null;
    }
  } else {
    nextDate = new Date(currentYear, month - 1, day);
    nextDate.setHours(0, 0, 0, 0);
    if (nextDate < today) {
      nextDate = new Date(currentYear + 1, month - 1, day);
    }
  }
  
  const diffTime = Math.abs(nextDate - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return { nextDate, diffDays };
};

const RemindersPanel = ({ family, viewAsMemberId, isTraditional, user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('birthdays'); // 'birthdays' | 'anniversaries'
  const [calendarMode, setCalendarMode] = useState('original'); // 'original' | 'lunar' | 'solar'

  // 物理轉換輔助函數：獲取在目標曆法下的正確月、日坐標
  const getPhysicalCoordinates = (m, type, targetMode) => {
    const isBirthday = type === 'birthday';
    const originalYear = isBirthday ? m.birth_year : m.death_year;
    const originalMonth = isBirthday ? m.birth_month : m.death_month;
    const originalDay = isBirthday ? m.birth_day : m.death_day;
    const originalIsLunar = (isBirthday ? m.birth_calendar : m.death_calendar) === 'lunar';

    // 如果沒有年份或不需要轉換，直接返回原始坐標
    if (!originalYear || targetMode === 'original') {
      return { month: originalMonth, day: originalDay, isLunar: originalIsLunar };
    }

    try {
      if (targetMode === 'lunar' && !originalIsLunar) {
        // 新曆轉農曆 (基於出生年份)
        const d = new Date(originalYear, originalMonth - 1, originalDay);
        const l = Lunar.fromDate(d);
        return { month: l.getMonth(), day: l.getDay(), isLunar: true };
      }
      if (targetMode === 'solar' && originalIsLunar) {
        // 農曆轉新曆 (基於出生年份)
        const s = Lunar.fromYmd(originalYear, originalMonth, originalDay).getSolar();
        return { month: s.getMonth(), day: s.getDay(), isLunar: false };
      }
    } catch (e) {
      console.warn("Date conversion failed:", e);
    }

    return { month: originalMonth, day: originalDay, isLunar: originalIsLunar };
  };

  const birthdays = useMemo(() => {
    return family
      .filter(m => !m.is_deceased && m.birth_month && m.birth_day)
      .map(m => {
        const { month, day, isLunar } = getPhysicalCoordinates(m, 'birthday', calendarMode);
        const occurrence = getNextOccurrence(month, day, isLunar);
        if (!occurrence) return null;
        
        let turningAge = null;
        if (m.birth_year) {
          turningAge = occurrence.nextDate.getFullYear() - m.birth_year;
        }
        
        return { 
          ...m, 
          ...occurrence, 
          turningAge, 
          isLunar,
          displayMonth: month,
          displayDay: day,
          type: 'birthday'
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [family, calendarMode]);

  const anniversaries = useMemo(() => {
    const ancestors = new Set();
    const queue = [];
    const loggedInMember = user ? family.find(m => m.user_id === user.id) : null;
    const effectiveViewId = viewAsMemberId || (loggedInMember ? loggedInMember.id : null);

    if (effectiveViewId) {
      queue.push(effectiveViewId);
    } else {
      family.forEach(m => {
        if (!family.some(child => child.parents?.includes(m.id))) {
          queue.push(m.id);
        }
      });
    }

    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentMember = family.find(m => m.id === currentId);
      if (currentMember && currentMember.parents) {
        currentMember.parents.forEach(pid => {
          if (!ancestors.has(pid)) {
            ancestors.add(pid);
            queue.push(pid);
          }
        });
      }
    }
    
    return Array.from(ancestors)
      .map(id => family.find(m => m.id === id))
      .filter(m => m && m.is_deceased && m.death_month && m.death_day)
      .map(m => {
        const { month, day, isLunar } = getPhysicalCoordinates(m, 'anniversary', calendarMode);
        const occurrence = getNextOccurrence(month, day, isLunar);
        if (!occurrence) return null;
        let passedYears = null;
        if (m.death_year) passedYears = occurrence.nextDate.getFullYear() - m.death_year;
        return { 
          ...m, 
          ...occurrence, 
          passedYears, 
          isLunar,
          displayMonth: month,
          displayDay: day,
          type: 'anniversary'
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [family, viewAsMemberId, calendarMode]);

  // 工具函數：根據顯示模式格式化日期文字
  const getFormattedDateContent = (item) => {
    if (calendarMode === 'lunar') {
      const l = Lunar.fromDate(item.nextDate);
      return `農曆 ${l.getMonth()}月${l.getDayInChinese()}`;
    } else if (calendarMode === 'solar') {
      return `新曆 ${item.nextDate.getMonth() + 1}月${item.nextDate.getDate()}日`;
    } else {
      // 原始模式：使用計算出的座標渲染
      return `${item.isLunar ? '農曆' : '新曆'} ${item.displayMonth}月${item.displayDay}${item.isLunar ? '' : '日'}`;
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0' }}>
      {/* Category Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px', gap: '8px' }}>
        {[
          { id: 'birthdays', label: isTraditional ? '即將到來的生辰' : '即将到来的生辰', icon: Calendar, color: 'var(--primary-color)' },
          { id: 'anniversaries', label: isTraditional ? '直系先人忌辰追思' : '直系先人忌辰追思', icon: Heart, color: '#ef4444' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: activeTab === tab.id ? tab.color : 'white',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: activeTab === tab.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '4px' }}>
        {[
          { id: 'original', label: '設為預設', icon: Globe },
          { id: 'lunar', label: '全農曆', icon: Moon },
          { id: 'solar', label: '全新曆', icon: Sun }
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setCalendarMode(mode.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(0,0,0,0.05)',
              background: calendarMode === mode.id ? 'var(--text-main)' : 'white',
              color: calendarMode === mode.id ? 'white' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <mode.icon size={12} />
            {mode.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{ padding: '10px' }}
        >
          {activeTab === 'anniversaries' && !viewAsMemberId && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              backgroundColor: '#eff6ff', 
              padding: '12px 20px', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: '20px', 
              color: '#3b82f6', 
              fontSize: '14px',
              border: '1px solid #dbeafe'
            }}>
              <Info size={16} />
              <span>{isTraditional 
                ? (user && family.find(m => m.user_id === user.id) ? '目前以您的帳號關聯成員作為追溯起點' : '目前未選擇特定成員視角，預設追溯家族所有長輩') 
                : (user && family.find(m => m.user_id === user.id) ? '目前以您的帳号关联成员作为追溯起点' : '目前未选择特定成员视角，预设追溯家族所有长辈')}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
            {((activeTab === 'birthdays' ? birthdays : anniversaries)).length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-light)', padding: '60px', backgroundColor: 'white', borderRadius: 'var(--radius-lg)' }}>
                暫無相關提醒資料
              </div>
            ) : (
              (activeTab === 'birthdays' ? birthdays : anniversaries).map(m => (
                <motion.div 
                  key={m.id}
                  whileHover={{ y: -4 }}
                  className="glass-card"
                  style={{ 
                    padding: '20px', 
                    borderRadius: 'var(--radius-lg)', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderLeft: `6px solid ${m.diffDays <= 7 ? (activeTab === 'birthdays' ? '#f59e0b' : '#ef4444') : '#e5e7eb'}`
                  }}
                >
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.name}
                      {m.diffDays <= 7 && <Bell size={14} color={activeTab === 'birthdays' ? '#f59e0b' : '#ef4444'} />}
                      {activeTab === 'anniversaries' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/memorial/${m.id}`);
                          }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#ef4444',
                            border: '1px solid #fecaca',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            marginLeft: '10px'
                          }}
                        >
                          🙏 {isTraditional ? '前往祭奠' : '前往祭奠'}
                        </button>
                      )}
                    </div>
                    
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                      {getFormattedDateContent(m)}
                      {calendarMode === 'original' && (
                        <span style={{ marginLeft: '8px', opacity: 0.6 }}>
                          (國曆 {m.nextDate.getMonth() + 1}月{m.nextDate.getDate()}日)
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      {activeTab === 'birthdays' && m.turningAge !== null && (
                        <span style={{ 
                          backgroundColor: '#fef3c7', 
                          color: '#92400e', 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          padding: '2px 8px', 
                          borderRadius: 'var(--radius-full)' 
                        }}>
                          {isTraditional ? `即將邁入 ${m.turningAge} 歲` : `即将迈入 ${m.turningAge} 岁`}
                        </span>
                      )}
                      {activeTab === 'anniversaries' && m.passedYears !== null && (
                        <span style={{ 
                          backgroundColor: '#fee2e2', 
                          color: '#991b1b', 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          padding: '2px 8px', 
                          borderRadius: 'var(--radius-full)' 
                        }}>
                          {isTraditional ? `逝世 ${m.passedYears} 週年` : `逝世 ${m.passedYears} 周年`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {m.diffDays === 0 ? (
                      <div style={{ color: activeTab === 'birthdays' ? '#f59e0b' : '#ef4444', fontWeight: 800, fontSize: '15px' }}>
                        {activeTab === 'birthdays' ? '🎂 就是今天！' : '🕯️ 正值忌辰'}
                      </div>
                    ) : (
                      <div style={{ fontSize: '14px', fontWeight: 600, color: m.diffDays <= 7 ? 'var(--text-main)' : 'var(--text-light)' }}>
                        還有 <span style={{ fontSize: '24px', fontWeight: 800, color: m.diffDays <= 7 ? (activeTab === 'birthdays' ? '#f59e0b' : '#ef4444') : 'inherit' }}>{m.diffDays}</span> 天
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RemindersPanel;
