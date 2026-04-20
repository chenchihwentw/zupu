import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { 
  Heart, 
  User, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  ArrowLeft,
  Sparkles,
  Camera
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AncestorTablet from './AncestorTablet';
import HelpLink from './HelpLink';

const MemorialHall = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ritualMode, setRitualMode] = useState('TRADITIONAL'); // TRADITIONAL, CHRISTIAN, MODERN
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ritualCount, setRitualCount] = useState(0);
  const [isRitualActive, setIsRitualActive] = useState(false);
  const [taggedPhotos, setTaggedPhotos] = useState([]);
  const [showRitualDrawer, setShowRitualDrawer] = useState(false);
  const audioRef = useRef(null);

  // 🖱️ 3D Parallax Mouse Tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for premium feel
  const springConfig = { damping: 30, stiffness: 80 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Transforms for different layers
  // Layer 1: Background (Moves least)
  const bgX = useTransform(smoothX, [-500, 500], [5, -5]);
  const bgY = useTransform(smoothY, [-500, 500], [4, -4]);
  
  // Layer 2: Middle Altar (Main interaction)
  const midX = useTransform(smoothX, [-500, 500], [11, -11]);
  const midY = useTransform(smoothY, [-500, 500], [8, -8]);
  
  // Layer 3: Foreground Items (Moves most)
  const fgX = useTransform(smoothX, [-500, 500], [18, -18]);
  const fgY = useTransform(smoothY, [-500, 500], [12, -12]);

  // Lighting tracking
  const lightX = useTransform(smoothX, [-500, 500], ["40%", "60%"]);
  const lightY = useTransform(smoothY, [-500, 500], ["40%", "60%"]);

  // 3D Rotation for the tablet (more aggressive for physical effect)
  const tabletRotateX = useTransform(smoothY, [-500, 500], [1, -4]); // Extreme subtle tilt
  const tabletRotateY = useTransform(smoothX, [-500, 500], [-3, 3]);

  // Glass Glare transforms (Moved to top level to comply with Rules of Hooks)
  const glareX = useTransform(smoothX, [-500, 500], [-12, 12]);
  const glareY = useTransform(smoothY, [-500, 500], [-8, 8]);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set(clientX - innerWidth / 2);
    mouseY.set(clientY - innerHeight / 2);
  };

  // 🎵 使用本地音源 (徹底解決外部連結 403/CORS 跨域報錯)
  const musicSources = {
    TRADITIONAL: '/audio/traditional.mp3', 
    CHRISTIAN: '/audio/christian.mp3', 
    MODERN: '/audio/modern.mp3'
  };

  const themeConfigs = {
    TRADITIONAL: {
      title: '祭祖',
      ritualLabel: '進行祭祀',
      ritualIcon: '🔥',
      color: '#c41e3a',
      bg: '#0a0a0a',
      bgImage: '/assets/memorial/traditional_bg.png',
      accent: 'rgba(196, 30, 58, 0.4)',
      chant: '慎終追遠，民德歸厚',
      items: ['三炷清香', '時令果品', '清茶三盞'],
      tabletY: -125, // 向上提升 15px (原本 -110)
      indicatorY: 0
    },
    CHRISTIAN: {
      title: '紀祖',
      ritualLabel: '追思祈禱',
      ritualIcon: '🕊️',
      color: '#3498db',
      bg: '#051937',
      bgImage: '/assets/memorial/christian_bg.png',
      accent: 'rgba(52, 152, 219, 0.4)',
      chant: '主內安息，永恆懷念',
      items: ['百合花束', '長明燭光', '祈禱默哀'],
      tabletY: 135, // 向下降低 55px (原本 80)
      indicatorY: 120 // 向下移動 120px 避免遮擋牌位
    },
    MODERN: {
      title: '追思',
      ritualLabel: '獻上思念',
      ritualIcon: '✨',
      color: '#2ecc71',
      bg: '#1a2a1a',
      bgImage: '/assets/memorial/modern_bg.png',
      accent: 'rgba(46, 204, 113, 0.4)',
      chant: '愛在記憶中永恆',
      items: ['虛擬鮮花', '思念信件', '心靈之光'],
      tabletY: -145, // 向上提升 15px (原本 -130)
      indicatorY: 0
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const memberRes = await axios.get(`/api/member/${id}`);
        setMember(memberRes.resData || memberRes.data);
        
        const ritualRes = await axios.get(`/api/memorial/rituals/${id}`);
        if (ritualRes.data && ritualRes.data.stats) {
          setRitualCount(ritualRes.data.stats.total_count || 0);
          setMessages(ritualRes.data.recent_messages || []);
        }

        const albumRes = await axios.get(`/api/media?member_id=${id}`);
        setTaggedPhotos(albumRes.data || []);
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch memorial data:', err);
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleRitual = async () => {
    setIsRitualActive(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('/api/memorial/rituals', {
        member_id: id,
        ritual_type: ritualMode,
        message: newMessage || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRitualCount(prev => prev + 1);
      if (newMessage) {
        setMessages(prev => [{
          message: newMessage.trim() || '思念與祈禱，永遠銘記心間...', // 默認思念語
          ritual_date: new Date().toISOString(), // 修正字段名為 ritual_date
          ritual_type: ritualMode,
          full_name: user?.full_name || user?.name || '家屬'
        }, ...prev].slice(0, 10));
        setNewMessage('');
      }
    } catch (err) {
      console.error('Ritual failed:', err);
    }
    setTimeout(() => setIsRitualActive(false), 3000);
  };

  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => {
          console.warn('Audio playback failed or blocked:', e);
          setIsPlaying(false);
        });
    }
  };

  if (loading || !member) return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: 'white' }}>
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }}>
        正在進入紀念堂...
      </motion.div>
    </div>
  );

  const currentTheme = themeConfigs[ritualMode];

  return (
    <div 
      onMouseMove={handleMouseMove}
      style={{ 
        height: '100vh', 
        width: '100vw',
        backgroundColor: currentTheme.bg, 
        color: 'white',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "'Noto Serif TC', serif"
      }}
    >
      <audio ref={audioRef} src={musicSources[ritualMode]} loop />

      {/* 🟢 Z-Layer 1: Deep Atmosphere Background */}
      <motion.div 
        style={{ 
          position: 'absolute',
          top: '-10%', left: '-10%', width: '120%', height: '120%',
          backgroundImage: `url(${currentTheme.bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          x: bgX,
          y: bgY,
          zIndex: 1,
          filter: 'brightness(0.6) contrast(1.1)'
        }} 
      >
        {/* Dynamic Light Overlay */}
        <motion.div 
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(circle at var(--light-x) var(--light-y), rgba(255,255,255,0.1) 0%, transparent 60%)`,
            pointerEvents: 'none',
            "--light-x": lightX,
            "--light-y": lightY
          }}
        />
      </motion.div>

      {/* 🟢 Z-Layer 2: The Memorial Altar Structure */}
      <motion.div 
        style={{ 
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          x: midX,
          y: midY,
          zIndex: 3
        }}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          style={{
            perspective: '2000px',
            transformStyle: 'preserve-3d',
            rotateX: tabletRotateX,
            rotateY: tabletRotateY,
            z: 50,
            scale: window.innerWidth < 768 ? 0.8 : 1 // 手機端整體輕微縮放
          }}
        >
          {/* 3D background board components removed per user request */}

          {/* Central AncestorTablet Component */}
          <motion.div 
            style={{
              position: 'relative',
              transformStyle: 'preserve-3d',
              scale: window.innerWidth < 768 ? 0.42 : 0.62, // 手機端大幅縮小避開 UI
              transformOrigin: 'bottom center', // Anchor to the desk
              marginTop: window.innerWidth < 768 ? '20px' : '-40px'
            }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: currentTheme.tabletY || 0, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <AncestorTablet 
              id={`3d-tablet-${id}`}
              member={{
                ...member,
                avatar_url: member.portrait || member.avatar_url
              }}
              religion={
                ritualMode === 'TRADITIONAL' ? 'TRADITIONAL' : 
                ritualMode === 'CHRISTIAN' ? 'CHRISTIANITY' : 'BUDDHISM'
              }
              generation={2} 
            />

            {/* Glass Glare Overlay */}
            <motion.div 
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: `linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)`,
                backgroundSize: '200% 200%',
                pointerEvents: 'none',
                zIndex: 10,
                opacity: 0.4,
                x: glareX,
                y: glareY
              }}
            />
          </motion.div>
        </motion.div>

        {/* Floating Stat Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            y: currentTheme.indicatorY || 0 // 根據主題位移避免遮擋
          }}
          transition={{ delay: 1 }}
          style={{
            marginTop: '60px',
            padding: '10px 24px',
            borderRadius: '30px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${currentTheme.color}33`,
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <Sparkles size={16} color={currentTheme.color} />
          <span>累計{currentTheme.ritualLabel} {ritualCount} 次</span>
        </motion.div>
      </motion.div>

      {/* 🟢 Z-Layer 3: Foreground Interactive Elements (Highest Parallax) */}
      <motion.div 
        style={{ 
          position: 'absolute',
          bottom: '-10%', left: '-5%', width: '110%', height: '40%',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '0 8% 10% 8%',
          x: fgX,
          y: fgY,
          zIndex: 10
        }}
      >
        {/* Left Side Flower/Vase removed per request */}
        <motion.div style={{ flex: 1 }} />
        
        {/* Central Ritual Space (Empty but has glow) */}
        <motion.div 
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ width: '400px', height: '100px', background: `radial-gradient(ellipse at center, ${currentTheme.color}22 0%, transparent 70%)` }} 
        />

        {/* Right Side Flower/Vase removed per request */}
        <motion.div style={{ flex: 1 }} />
      </motion.div>

      {/* 🔴 Layer: UI Overlay (Stationary) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, pointerEvents: 'none' }}>
        {/* Navigation Bar */}
        <motion.div 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          style={{ 
            padding: '24px 40px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            pointerEvents: 'auto'
          }}
        >
          <button 
            onClick={() => navigate(-1)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              display: 'flex', 
              alignItems: 'center', 
              gap: window.innerWidth < 768 ? '4px' : '10px', 
              cursor: 'pointer', 
              fontSize: window.innerWidth < 768 ? '14px' : '16px' 
            }}
          >
            <ArrowLeft size={window.innerWidth < 768 ? 16 : 20} /> {window.innerWidth < 768 ? '返回' : '返回家族樹'}
          </button>

          {/* ✨ Context Help for Rituals */}
          <div style={{ marginLeft: '10px' }}>
            <HelpLink 
                section="rituals" 
                style={{ 
                    backgroundColor: 'rgba(255,255,255,0.1)', 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.2)' 
                }} 
            />
          </div>

          <div style={{ 
            display: 'flex', 
            gap: window.innerWidth < 768 ? '5px' : '20px', 
            background: 'rgba(255,255,255,0.05)', 
            padding: '4px', 
            borderRadius: '30px', 
            backdropFilter: 'blur(10px)',
            maxWidth: window.innerWidth < 768 ? '60%' : 'none',
            overflowX: window.innerWidth < 768 ? 'auto' : 'visible'
          }}>
            {['TRADITIONAL', 'CHRISTIAN', 'MODERN'].map(mode => (
              <button
                key={mode}
                onClick={() => setRitualMode(mode)}
                style={{
                  padding: window.innerWidth < 768 ? '6px 12px' : '10px 24px',
                  borderRadius: '25px',
                  backgroundColor: ritualMode === mode ? currentTheme.color : 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.4s ease',
                  fontSize: window.innerWidth < 768 ? '12px' : '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                {themeConfigs[mode].title}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            {window.innerWidth < 768 && (
               <button 
               onClick={() => setShowRitualDrawer(true)}
               style={{ 
                 background: currentTheme.color,
                 border: 'none', 
                 color: 'white', 
                 width: '50px', height: '50px', borderRadius: '50%',
                 display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
               }}
             >
               <MessageSquare size={24} />
             </button>
            )}
            <button 
              onClick={toggleMusic}
              style={{ 
                background: isPlaying ? currentTheme.color : 'rgba(255,255,255,0.1)',
                border: 'none', 
                color: 'white', 
                width: '50px', height: '50px', borderRadius: '50%',
                display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              {isPlaying ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
          </div>
        </motion.div>

        {/* Dashboard (Right Side / Bottom Drawer for Mobile) */}
        <AnimatePresence>
          {(window.innerWidth >= 768 || showRitualDrawer) && (
            <div style={{ 
              position: 'absolute', 
              right: window.innerWidth < 768 ? '0' : '40px', 
              bottom: window.innerWidth < 768 ? '0' : '40px', 
              left: window.innerWidth < 768 ? '0' : 'auto',
              display: 'flex', 
              flexDirection: 'column', 
              gap: window.innerWidth < 768 ? '10px' : '30px', 
              alignItems: window.innerWidth < 768 ? 'stretch' : 'flex-end', 
              pointerEvents: 'auto',
              padding: window.innerWidth < 768 ? '20px' : '0',
              zIndex: 1000
            }}>
              {window.innerWidth < 768 && (
                <button 
                  onClick={() => setShowRitualDrawer(false)}
                  style={{ 
                    alignSelf: 'center', 
                    background: 'rgba(255,255,255,0.1)', 
                    border: 'none', 
                    color: 'white', 
                    padding: '8px 20px', 
                    borderRadius: '20px',
                    marginBottom: '10px',
                    fontSize: '13px'
                  }}
                >
                  關閉控制台
                </button>
              )}
              
              {/* Scrollable Letter Records */}
              <div style={{ 
                width: window.innerWidth < 768 ? '100%' : '320px', 
                maxHeight: window.innerWidth < 768 ? '150px' : '280px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px', 
                paddingRight: '12px',
                scrollbarWidth: 'none' 
              }}>
                <AnimatePresence>
                  {messages.map((m, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.6)', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        fontSize: '14px', 
                        borderRight: `4px solid ${currentTheme.color}`,
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <p style={{ margin: '0 0 8px 0', lineHeight: 1.6 }}>
                        {m.message && m.message.trim() !== '' ? m.message : '思念與祈禱，永遠銘記心間...'}
                      </p>
                      <div style={{ opacity: 0.4, fontSize: '11px', textAlign: 'right' }}>
                        {new Date(m.ritual_date || m.created_at).toLocaleDateString()} · {m.full_name || m.username || m.user_name || '家屬'}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Ritual Console */}
              <motion.div 
                layout
                initial={window.innerWidth < 768 ? { y: 300 } : {}}
                animate={window.innerWidth < 768 ? { y: 0 } : {}}
                exit={window.innerWidth < 768 ? { y: 300 } : {}}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.85)', 
                  padding: window.innerWidth < 768 ? '25px' : '30px', 
                  borderRadius: window.innerWidth < 768 ? '30px 30px 0 0' : '28px', 
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  width: window.innerWidth < 768 ? 'auto' : '360px',
                  boxShadow: '0 -20px 40px rgba(0,0,0,0.4)',
                  margin: window.innerWidth < 768 ? '-20px -20px 0 -20px' : '0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>{currentTheme.ritualLabel}</h3>
                    <p style={{ margin: '0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{currentTheme.chant}</p>
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: `${currentTheme.color}33`, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>
                    {currentTheme.ritualIcon}
                  </div>
                </div>

                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="寫下您的話..."
                  style={{
                    width: '100%',
                    height: window.innerWidth < 768 ? '80px' : '100px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    padding: '16px',
                    color: 'white',
                    fontSize: '15px',
                    marginBottom: '15px',
                    resize: 'none',
                    outline: 'none focus:border-white'
                  }}
                />

                <button
                  onClick={handleRitual}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: currentTheme.color,
                    color: 'white',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: `0 10px 20px ${currentTheme.color}33`
                  }}
                >
                  <Sparkles size={20} /> {currentTheme.ritualLabel}
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 🔴 Ritual Fullscreen Effects */}
      <AnimatePresence>
        {isRitualActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 200,
              backdropFilter: 'blur(8px)'
            }}
          >
            {/* Visual Particle / Ethereal Effect */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: [1, 1.2, 1], rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{ fontSize: '100px', marginBottom: '30px' }}
            >
              {ritualMode === 'TRADITIONAL' ? '🕯️' : ritualMode === 'CHRISTIAN' ? '🕯️' : '🏮'}
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{ textAlign: 'center' }}
            >
              <h2 style={{ fontSize: '32px', letterSpacing: '8px', margin: '0 0 10px 0' }}>儀式進行中</h2>
              <p style={{ fontSize: '16px', opacity: 0.6 }}>您的情感與思念已寄往彼岸</p>
            </motion.div>

            {/* Simulated Incense/Light Ray */}
            <motion.div
              style={{
                position: 'absolute',
                bottom: 0,
                width: '4px',
                height: '100%',
                background: `linear-gradient(to top, transparent, ${currentTheme.color}, transparent)`,
                opacity: 0.5
              }}
              animate={{ height: ['0%', '100%', '0%'] }}
              transition={{ duration: 3, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemorialHall;
