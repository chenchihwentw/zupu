import React, { useState, useEffect, useRef } from 'react';
import * as lunar from 'lunar-javascript';
import html2canvas from 'html2canvas';

/**
 * 多信仰祭祀牌位生成器
 * 支持：傳統儒家、佛教、基督教、天主教
 */
const AncestorTablet = ({ id, member, religion = 'TRADITIONAL', generation = 0 }) => {
  const tabletRef = useRef(null);
  const [lunarDate, setLunarDate] = useState(null);

  // 調試：打印成員數據
  useEffect(() => {
    console.log('🪦 牌位成員數據:', member);
    console.log('📅 death_date:', member.death_date);
    console.log('📅 birth_date:', member.birth_date);
  }, [member]);

  // 轉換農曆日期
  useEffect(() => {
    if (member.death_date && religion !== 'CHRISTIANITY' && religion !== 'CATHOLICISM') {
      try {
        const date = new Date(member.death_date);
        // 使用 lunar-javascript 的正確 API
        const solar = lunar.Solar.fromYmd(
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate()
        );
        const lunarDate_obj = solar.getLunar();
        
        // 使用傳統農曆格式：農曆X年X月X日
        const monthNames = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];
        let lunarMonth = lunarDate_obj.getMonth(); // 返回 1-12，閏月為負數（如閏四月 = -4）
        
        // 處理閏月：取絕對值並標記
        const isLeapMonth = lunarMonth < 0;
        const monthIndex = Math.abs(lunarMonth);
        const monthName = (isLeapMonth ? '閏' : '') + (monthNames[monthIndex] || `${monthIndex}`);
        
        const dayName = lunarDate_obj.getDayInChinese();
        const yearName = lunarDate_obj.getYearInGanZhi(); // 天干地支年
        
        setLunarDate({
          year: lunarDate_obj.getYear(),
          month: lunarDate_obj.getMonth(),
          day: lunarDate_obj.getDay(),
          full: `農曆${yearName}年${monthName}月${dayName}`
        });
      } catch (e) {
        console.error('農曆轉換失敗:', e);
        setLunarDate({ full: member.death_date });
      }
    }
  }, [member.death_date, religion]);

  // 生成牌位文字（根據信仰）
  const getTabletText = () => {
    const isMale = member.gender === 'male';
    const nameLastChar = member.name.slice(-1);
    const surname = member.name.charAt(0);

    switch (religion) {
      case 'BUDDHISM':
        // 佛教：縱向一整排，顯示佛力超薦 + 名字 + 之蓮位
        let buddhistText;
        if (generation === 1) {
          buddhistText = isMale ? `佛力超薦${member.name}居士之蓮位` : `佛力超薦${member.name}居士之蓮位`;
        } else if (generation === 2) {
          buddhistText = isMale ? `佛力超薦${member.name}居士之蓮位` : `佛力超薦${member.name}居士之蓮位`;
        } else if (generation === 3) {
          buddhistText = isMale ? `佛力超薦${member.name}居士之蓮位` : `佛力超薦${member.name}居士之蓮位`;
        } else {
          buddhistText = `佛力超薦${member.name}居士之蓮位`;
        }
        
        return {
          fullText: buddhistText,
          datePrefix: '圓寂於'
        };
      case 'CHRISTIANITY':
        return {
          prefix: '蒙主寵召',
          main: isMale ? `${member.name} 弟兄` : `${member.name} 姊妹`,
          suffix: '安息主懷',
          datePrefix: '睡於'
        };
      case 'CATHOLICISM':
        return {
          prefix: '主內安息',
          main: `${member.name}`,
          suffix: '蒙主恩召',
          datePrefix: '安息於'
        };
      default: // TRADITIONAL - 縱向一整排
        // 根據代數調整稱謂，組合成完整的一行文字
        let fullText;
        if (generation === 1) {
          // 父母
          fullText = isMale ? `顯考${surname}公${member.name}老大人之神位` : `顯妣${surname}母${member.name}老孺人之神位`;
        } else if (generation === 2) {
          // 祖父母
          fullText = isMale ? `顯祖考${surname}公${member.name}老大人之神位` : `顯祖妣${surname}母${member.name}老孺人之神位`;
        } else if (generation === 3) {
          // 曾祖父母
          fullText = isMale ? `顯曾祖考${surname}公${member.name}老大人之神位` : `顯曾祖妣${surname}母${member.name}老孺人之神位`;
        } else {
          // 更高代數
          fullText = isMale ? `遠祖顯考${surname}公${member.name}老大人之神位` : `遠祖顯妣${surname}母${member.name}老孺人之神位`;
        }
        
        return {
          fullText, // 完整的一整排文字
          datePrefix: '卒於'
        };
    }
  };

  const tabletText = getTabletText();

  // 獲取缺省圖標（無照片時顯示）
  const getFallbackIcon = () => {
    const surname = member.name.charAt(0);
    switch (religion) {
      case 'BUDDHISM':
        // 使用 SVG 蓮花（豎向）
        return (
          <svg width="60" height="70" viewBox="0 0 60 70" style={{ display: 'block' }}>
            {/* 花瓣 - 中 */}
            <ellipse cx="30" cy="35" rx="8" ry="20" fill="#FF6B6B" opacity="0.9"/>
            {/* 花瓣 - 左 */}
            <ellipse cx="22" cy="40" rx="7" ry="18" fill="#FF6B6B" opacity="0.8" transform="rotate(-20 22 40)"/>
            {/* 花瓣 - 右 */}
            <ellipse cx="38" cy="40" rx="7" ry="18" fill="#FF6B6B" opacity="0.8" transform="rotate(20 38 40)"/>
            {/* 花瓣 - 左外 */}
            <ellipse cx="15" cy="45" rx="6" ry="15" fill="#FF6B6B" opacity="0.7" transform="rotate(-35 15 45)"/>
            {/* 花瓣 - 右外 */}
            <ellipse cx="45" cy="45" rx="6" ry="15" fill="#FF6B6B" opacity="0.7" transform="rotate(35 45 45)"/>
            {/* 花蕊 */}
            <circle cx="30" cy="25" r="4" fill="#FFD700"/>
            {/* 荷葉 */}
            <ellipse cx="30" cy="62" rx="18" ry="5" fill="#4CAF50" opacity="0.6"/>
          </svg>
        );
      case 'CHRISTIANITY':
      case 'CATHOLICISM':
        return '✝️'; // 十字架
      default: // TRADITIONAL
        return surname; // 姓氏
    }
  };

  // 導出為圖片
  const exportAsImage = async (size = 'standard') => {
    if (!tabletRef.current) return;

    try {
      // 等待字體加載
      await document.fonts.ready;

      // 4x6 吋導出 (300dpi = 1200x1800px)
      const targetWidth = size === '4x6' ? 1200 : undefined;
      const targetHeight = size === '4x6' ? 1800 : undefined;

      const canvas = await html2canvas(tabletRef.current, {
        scale: size === '4x6' ? 3 : 3,
        width: targetWidth,
        height: targetHeight,
        useCORS: true,
        logging: false,
        backgroundColor: religion === 'CHRISTIANITY' ? '#FFFFFF' : 
                         religion === 'BUDDHISM' ? '#FFF8DC' : 
                         religion === 'CATHOLICISM' ? '#F8F8FF' : '#8B4513'
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${member.name}_${religion}_牌位${size === '4x6' ? '_4x6' : ''}.png`;
      link.href = image;
      link.click();
    } catch (error) {
      console.error('導出圖片失敗:', error);
      alert('導出圖片失敗，請重試');
    }
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  // 根據信仰獲取樣式
  const getTabletStyle = () => {
    switch (religion) {
      case 'BUDDHISM':
        return {
          background: 'linear-gradient(135deg, #FFF8DC 0%, #F5DEB3 100%)',
          border: '3px solid #DAA520',
          color: '#8B4513',
          fontFamily: "'Noto Serif TC', 'Noto Serif SC', 'SimSun', serif",
          writingMode: 'vertical-rl',
          width: '140px',
          height: '800px',
          padding: '30px 10px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
        };
      case 'CHRISTIANITY':
        return {
          background: '#FFFFFF',
          border: '2px solid #4682B4',
          color: '#2F4F4F',
          fontFamily: "'Noto Serif TC', 'Noto Serif SC', 'SimSun', serif", // 支持簡繁
          writingMode: 'horizontal-tb',
          width: '200px',
          height: '280px',
          padding: '20px 15px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          textAlign: 'center',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(70, 130, 180, 0.15)'
        };
      case 'CATHOLICISM':
        return {
          background: '#F8F8FF',
          border: '2px solid #8E44AD',
          color: '#2C3E50',
          fontFamily: "'Noto Serif TC', 'Noto Serif SC', 'SimSun', serif", // 支持簡繁
          writingMode: 'horizontal-tb',
          width: '200px',
          height: '280px',
          padding: '20px 15px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          textAlign: 'center',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(142, 68, 173, 0.15)'
        };
      default: // TRADITIONAL
        return {
          background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
          border: '3px solid #FFD700',
          color: '#FFD700',
          fontFamily: "'Noto Serif TC', 'Noto Serif SC', 'SimSun', serif", // 支持簡繁的通用字體
          writingMode: 'vertical-rl',
          width: '140px',
          height: '800px', // 增加高度，提供更大的顯示空間
          padding: '30px 10px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
        };
    }
  };

  const tabletStyle = getTabletStyle();

  return (
    <div className="tablet-container">
      {/* 牌位主體 */}
      <div 
        id={id}
        ref={tabletRef}
        className="tablet-box"
        style={tabletStyle}
      >
        {/* 成員照片 - 始終在最上方 */}
        <div className="member-photo" style={{
          width: '90px',
          height: '115px',
          border: `2px solid ${religion === 'TRADITIONAL' ? '#FFD700' : religion === 'BUDDHISM' ? '#B8860B' : '#4682B4'}`,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: religion === 'TRADITIONAL' || religion === 'BUDDHISM' ? '0' : '50%',
          marginBottom: '10px'
        }}>
          {member.avatar_url ? (
            <img 
              src={member.avatar_url} 
              alt={member.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = getFallbackIcon();
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              background: religion === 'TRADITIONAL' ? '#8B4513' : religion === 'BUDDHISM' ? '#FFF8DC' : '#F0F8FF',
              color: religion === 'TRADITIONAL' ? '#FFD700' : religion === 'BUDDHISM' ? '#B8860B' : '#4682B4'
            }}>
              {getFallbackIcon()}
            </div>
          )}
        </div>

        {religion === 'TRADITIONAL' || religion === 'BUDDHISM' ? (
          /* 傳統/佛教：縱向一整排文字 */
          <div className="tablet-text" style={{ 
            fontSize: religion === 'TRADITIONAL' ? '22px' : '20px',
            fontWeight: 'bold',
            letterSpacing: religion === 'TRADITIONAL' ? '4px' : '3px',
            flexGrow: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            whiteSpace: 'nowrap', // 強制不換行
            color: religion === 'BUDDHISM' ? '#5D4037' : undefined // 佛教使用更深的棕色
          }}>
            {tabletText.fullText}
          </div>
        ) : (
          /* 基督教/天主教：分段顯示 */
          <>
            {/* 前綴 */}
            <div className="tablet-prefix" style={{ 
              fontSize: '14px', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#666'
            }}>
              {tabletText.prefix}
            </div>

            {/* 主文 */}
            <div className="tablet-main" style={{ 
              fontSize: '18px', 
              margin: '10px 0', 
              fontWeight: 'bold',
              lineHeight: '1.6'
            }}>
              {tabletText.main}
            </div>

            {/* 結尾 */}
            <div className="tablet-suffix" style={{ 
              fontSize: '14px', 
              marginBottom: '10px',
              color: '#666'
            }}>
              {tabletText.suffix}
            </div>
          </>
        )}

        {/* 日期 */}
        {member.death_date && member.death_date.trim() !== '' && (
          <div className="tablet-date" style={{ 
            fontSize: '13px',
            flexShrink: 0,
            letterSpacing: '1px',
            marginBottom: '15px',
            whiteSpace: 'nowrap' // 強制不換行
          }}>
            {tabletText.datePrefix}{' '}
            {religion === 'CHRISTIANITY' || religion === 'CATHOLICISM' 
              ? member.death_date 
              : lunarDate?.full || member.death_date}
          </div>
        )}
        
        {/* 如果已過世但沒有死亡日期，顯示提示 */}
        {!member.death_date || member.death_date.trim() === '' ? (
          member.is_deceased === 1 || member.is_deceased === true ? (
            <div className="tablet-date tablet-date-missing" style={{ 
              fontSize: '14px',
              flexShrink: 0,
              letterSpacing: '2px',
              marginBottom: '10px',
              whiteSpace: 'nowrap',
              color: '#999',
              fontStyle: 'italic'
            }}>
              {religion === 'TRADITIONAL' || religion === 'BUDDHISM' ? '忌日待補' : 'Date of death unknown'}
            </div>
          ) : null
        ) : null}
      </div>
    </div>
  );
};

export default AncestorTablet;
