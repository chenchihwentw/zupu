import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  TreeDeciduous, 
  Camera, 
  Map, 
  ShieldCheck, 
  Database, 
  Heart, 
  ChevronRight,
  ArrowRight,
  Lightbulb,
  AlertCircle
} from 'lucide-react';

const ManualPage = () => {
  const [activeTab, setActiveTab] = useState('getting-started');

  // 支持 Hash 錨點自動切換
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setActiveTab(hash);
      const element = document.getElementById(hash);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const sections = [
    {
      id: 'getting-started',
      icon: BookOpen,
      title: '門戶入門',
      subtitle: '快速了解 Familia 家族門戶',
      content: (
        <>
          <p>歡迎來到 Familia 家族門戶系統。這是一個為傳承家族記憶、守護先祖榮光而設計的數字空間。</p>
          <div style={styles.tipBox}>
            <Lightbulb size={20} color="#f59e0b" />
            <span><strong>快速建議：</strong>建議您先從「建立/加入家譜」開始您的旅程，然後邀請家人加入。</span>
          </div>
          <h3>導航說明</h3>
          <ul>
            <li><strong>家族樹：</strong> 全局查看家族脈絡，支持縮放與拖拽。</li>
            <li><strong>尋親榜：</strong> 家族內的即時交流與信息發布。</li>
            <li><strong>牌位生成：</strong> 尊崇傳統，自動生成精美的祭祀牌位。</li>
            <li><strong>線上祭殿：</strong> 3D 沉浸式場景，實時寄託哀思。</li>
          </ul>
        </>
      )
    },
    {
      id: 'tree-navigation',
      icon: TreeDeciduous,
      title: '家族樹操作',
      subtitle: '如何瀏覽與管理家族脈絡',
      content: (
        <>
          <p>家族樹是系統的核心，它展示了代代相傳的血緣紐帶。</p>
          <h3>基本操作</h3>
          <ul>
            <li><strong>查看詳情：</strong> 點擊成員頭像，彈出詳細資訊侧邊欄。</li>
            <li><strong>編輯成員：</strong> 具備管理權限的用戶，點擊側邊欄右上角的「編輯」按鈕進行修改。</li>
            <li><strong>添加親屬：</strong> 在成員上單擊右鍵（或手機端長按），選擇「添加親屬」（配偶、子女、父母）。</li>
          </ul>
          <div style={styles.alertBox}>
            <AlertCircle size={20} color="#4f46e5" />
            <span><strong>注意：</strong>添加子女時，系統會自動在家族樹中向下延伸分支。</span>
          </div>
        </>
      )
    },
    {
      id: 'photo-ai',
      icon: Camera,
      title: '影像館與 AI',
      subtitle: '照片管理、AI 識別與自動標註',
      content: (
        <>
          <p>我們將傳統相冊升級為智能影像館，支持強大的 AI 人臉識別功能。</p>
          <h3>AI 自動標註</h3>
          <p>當您上傳照片後，系統會自動啟動掃描：</p>
          <ul>
            <li><strong>自動比對：</strong> AI 會將照片中的面部與家族成員頭像進行毫秒級比對。</li>
            <li><strong>自動掛載：</strong> 若匹配度（歐氏距離）小於 0.45，系統會自動在照片中打上該成員的標籤。</li>
            <li><strong>疑似提示：</strong> 若匹配度介於 0.45~0.6 之間，會顯示為「疑似」，請手動點擊確認。</li>
          </ul>
          <h3>預加載技術</h3>
          <p>進入相冊時，系統會背景預加載全家族的「特徵索引用戶」，這能確保您在大合照中掃描時幾乎無需等待。</p>
        </>
      )
    },
    {
      id: 'storage-quota',
      icon: Database,
      title: '存儲與限額',
      subtitle: '了解家族共享配額與公平模式',
      content: (
        <>
          <p>為了確保系統資源不被濫用，我們實施了業界領先的「混合制存儲配額管理」。這套機制能確保少數用戶的上傳行為不會導致全族空間瞬間耗盡。</p>
          <div style={styles.grid}>
            <div style={{...styles.quotaCard, borderLeft: '4px solid #3b82f6'}}>
              <h4>📂 家族總額度 (Global Family Limit)</h4>
              <p>整個家族共用的上限。管理員可調高此限（例如：200MB -> 1GB），這決定了大宗家譜數據與影音檔案的容納極限。</p>
            </div>
            <div style={{...styles.quotaCard, borderLeft: '4px solid #10b981'}}>
              <h4>🤝 個人公平線 (Personal Fair Use)</h4>
              <p>為了防止「存儲霸佔」，每位成員都有一個限額（預設 50MB）。當單人上傳量超過此線，即使家族總空間仍有餘溫，該用戶也將被暫停上傳權限。</p>
            </div>
          </div>
          <h3>管理員調度指引</h3>
          <p>身為家族領袖，您具備彈性調節資源的權力：</p>
          <ul>
            <li><strong>動態擴容：</strong> 在「家族管理 > 儲存設定」中，您可以針對活躍程度高、或負責整理影集的成員，單獨提高其「個人公平限額」。</li>
            <li><strong>公共資源保護：</strong> 管理員可以實時查看全族成員的空間佔用排名，及時聯繫上傳了重複或過大檔案的族人。</li>
          </ul>
          <div style={styles.alertBox}>
            <AlertCircle size={20} color="#4f46e5" />
            <span><strong>平衡建議：</strong>建議家族總額度應保持在所有「活躍成員限額加總」的 80% 以上，以確保數據流暢。</span>
          </div>
          <h3>常見問題與清理</h3>
          <ul>
            <li><strong>空間釋放：</strong> 影像館內刪除照片或影片會「即時」返還空間配額。</li>
            <li><strong>為何我被攔截？</strong> 如果您看到「空間已達上限」，請檢查您的「個人進度條」或是聯繫管理員查詢「家族剩餘空間」。</li>
          </ul>
        </>
      )
    },
    {
      id: 'rituals',
      icon: Heart,
      title: '祭祀與禮儀',
      subtitle: '如何在線上祭奠先祖',
      content: (
        <>
          <p>Familia 提供尊崇、靜謐的線上祭祀環境。</p>
          <p>Familia 提供尊崇、靜謐的 3D 沉浸式線上祭祀環境。</p>
          <ul>
            <li><strong>進入祭殿：</strong> 在已故成員的側邊欄中點擊「🙏 進殿祭奠」。</li>
            <li><strong>風格切換：</strong> 頂部提供「祭祖（傳統）」、「紀祖（基督教）」與「追思（現代）」三種模式，每種模式有專屬的場景音效與佈景。</li>
            <li><strong>交互儀式：</strong> 點擊右下角面板進行獻花、上香或祈禱。儀式進行時會有專屬的視覺特效渲染。</li>
            <li><strong>家族留言：</strong> 在祭殿內留言，將永久與該成員的 3D 牌位綁定，供後人瞻仰。</li>
          </ul>
          <div style={styles.tipBox}>
            <Heart size={20} color="#c41e3a" />
            <span><strong>沉浸式建議：</strong>戴上耳機，能感受更加莊重肅穆的祭奠氛圍。</span>
          </div>
        </>
      )
    },
    {
      id: 'permissions',
      icon: ShieldCheck,
      title: '權限與安全',
      subtitle: '了解不同的操作級別 (L1-L4)',
      content: (
        <>
          <p>系統根據角色權限實施分層管理：</p>
          <ul>
            <li><strong>普通成員 (User)：</strong> 核心成員。可查看所有家族數據，編輯自己的資料與上傳個人照片。</li>
            <li><strong>編輯者 (Editor)：</strong> 家族史官。具備編輯所有成員資料、生平事蹟以及整理公共影集的能力。</li>
            <li><strong>管理員 (Admin)：</strong> 權限之首。除編輯外，負責邀請碼審定、成員權限分配、存儲限額調整及家族信息設定。</li>
            <li><strong>系統管理員 (Super Admin)：</strong> 具備全局所有家族的維護權限。</li>
          </ul>
          <div style={styles.alertBox}>
            <ShieldCheck size={20} color="#4f46e5" />
            <span><strong>安全建議：</strong>建議家族創始者保持 Admin 身份，並根據成員的積極度授予 Editor 權限。</span>
          </div>
        </>
      )
    }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.headerContent}
        >
          <div style={styles.logoBadge}>📖</div>
          <h1>Familia 操作百科</h1>
          <p>全面掌握家族門戶的每一項功能，守護傳承</p>
        </motion.div>
      </div>

      <div style={styles.main}>
        {/* 左側導航 */}
        <div style={styles.sidebar}>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => {
                setActiveTab(section.id);
                window.location.hash = section.id;
              }}
              style={{
                ...styles.navItem,
                background: activeTab === section.id ? 'var(--primary-color)' : 'transparent',
                color: activeTab === section.id ? 'white' : 'var(--text-main)',
                boxShadow: activeTab === section.id ? 'var(--shadow-md)' : 'none'
              }}
            >
              <section.icon size={18} />
              <span>{section.title}</span>
              {activeTab === section.id && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>

        {/* 右側內容 */}
        <div style={styles.contentArea}>
          {sections.map(section => (
            activeTab === section.id && (
              <motion.div
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                style={styles.contentContainer}
              >
                <div style={styles.sectionHeader}>
                  <div style={{ ...styles.iconBox, backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary-color)' }}>
                    <section.icon size={28} />
                  </div>
                  <div>
                    <h2 style={styles.sectionTitle}>{section.title}</h2>
                    <p style={styles.sectionSubtitle}>{section.subtitle}</p>
                  </div>
                </div>
                <div style={styles.richText}>
                  {section.content}
                </div>
              </motion.div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#fff',
    paddingTop: '40px'
  },
  header: {
    height: '240px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: 'white'
  },
  headerContent: {
    maxWidth: '800px',
    padding: '0 20px'
  },
  logoBadge: {
    fontSize: '40px',
    marginBottom: '16px'
  },
  main: {
    maxWidth: '1200px',
    margin: '-40px auto 40px',
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '30px',
    padding: '0 20px'
  },
  sidebar: {
    position: 'sticky',
    top: '120px',
    height: 'fit-content',
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '12px',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s ease'
  },
  contentArea: {
    minHeight: '600px'
  },
  contentContainer: {
    backgroundColor: 'white',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid #f0f0f0'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '40px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f0f0f0'
  },
  iconBox: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '800',
    margin: 0
  },
  sectionSubtitle: {
    fontSize: '16px',
    color: '#666',
    margin: '4px 0 0 0'
  },
  richText: {
    lineHeight: '1.8',
    color: '#374151',
    fontSize: '16px'
  },
  tipBox: {
    display: 'flex',
    gap: '12px',
    backgroundColor: '#fffbeb',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #fef3c7',
    fontSize: '14px',
    color: '#92400e',
    margin: '24px 0'
  },
  alertBox: {
    display: 'flex',
    gap: '12px',
    backgroundColor: '#eff6ff',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #dbeafe',
    fontSize: '14px',
    color: '#1e40af',
    margin: '24px 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    margin: '24px 0'
  },
  quotaCard: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid #f0f0f0'
  }
};

export default ManualPage;
