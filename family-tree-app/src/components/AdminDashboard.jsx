import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  History, 
  Database, 
  RotateCcw, 
  RefreshCw, 
  ChevronRight, 
  AlertCircle,
  FileText,
  User,
  Clock,
  ArrowLeft,
  ShieldCheck,
  HardDriveDownload
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [trash, setTrash] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const targetIdParam = searchParams.get('target_id');

  // Fetch Logic
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'logs') {
        const url = targetIdParam 
          ? `/api/admin/logs?target_id=${targetIdParam}` 
          : '/api/admin/logs';
        const res = await axios.get(url);
        setLogs(res.data);
      } else if (activeTab === 'trash') {
        const res = await axios.get('/api/admin/trash');
        setTrash(res.data);
      } else if (activeTab === 'backups') {
        const res = await axios.get('/api/admin/snapshots');
        setBackups(res.data);
      }
    } catch (err) {
      console.error('Fetch data failed:', err);
      setMessage({ type: 'error', text: '數據獲取失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Actions
  const handleRestoreMember = async (id) => {
    if (!window.confirm('確定要恢復該成員嗎？')) return;
    try {
      await axios.post(`/api/family/${id}/restore`);
      setTrash(trash.filter(m => m.id !== id));
      setMessage({ type: 'success', text: '成員已恢復' });
    } catch (err) {
      setMessage({ type: 'error', text: '操作失敗' });
    }
  };

  const handleRevertLog = async (log) => {
    if (!window.confirm(`確定要將成員 [${log.target_id}] 還原到該版本嗎？`)) return;
    try {
      await axios.post(`/api/family/${log.target_id}/revert`, { log_id: log.id });
      setMessage({ type: 'success', text: '數據已成功還原' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '還原失敗' });
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      await axios.post('/api/admin/snapshot');
      setMessage({ type: 'success', text: '數據備份成功' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: '備份失敗' });
    }
  };

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '40px auto', 
      padding: '0 20px',
      minHeight: '80vh'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <button 
            onClick={() => navigate(-1)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontSize: '14px',
              marginBottom: '8px'
            }}
          >
            <ArrowLeft size={14} /> 返回
          </button>
          <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={32} color="var(--primary-color)" />
            數據管理與安全中心
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>管理家族數據完整性、審核歷史記錄與系統備份</p>
        </div>
        
        <button 
          onClick={fetchData}
          disabled={loading}
          className="pill-button secondary"
          style={{ width: '40px', height: '40px', padding: 0 }}
        >
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="glass-panel" style={{ 
        display: 'flex', 
        padding: '6px', 
        borderRadius: 'var(--radius-full)', 
        marginBottom: '24px',
        maxWidth: 'fit-content'
      }}>
        {[
          { id: 'logs', label: '操作日誌', icon: History },
          { id: 'trash', label: '回收站', icon: Trash2 },
          { id: 'backups', label: '數據備份', icon: Database }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-full)',
              background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
              marginBottom: '20px',
              borderLeft: `4px solid ${message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              {message.text}
            </div>
            <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', opacity: 0.5 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', minHeight: '400px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <RefreshCw size={40} className="spin" color="var(--primary-color)" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'logs' && (
              <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {logs.length === 0 ? <EmptyState text="尚無操作日誌" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {logs.map(log => (
                      <LogItem key={log.id} log={log} onRevert={handleRevertLog} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'trash' && (
              <motion.div key="trash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {trash.length === 0 ? <EmptyState text="回收站是空的" /> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {trash.map(member => (
                      <TrashCard key={member.id} member={member} onRestore={handleRestoreMember} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'backups' && (
              <motion.div key="backups" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '18px' }}>資料庫備份點 (最近的歷史快照)</h3>
                  <button onClick={handleCreateSnapshot} className="pill-button">
                    <Database size={16} /> 立即創建備份
                  </button>
                </div>
                {backups.length === 0 ? <EmptyState text="尚無備份記錄" /> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                    {backups.map(backup => (
                      <BackupCard key={backup.filename} backup={backup} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

// --- Subcomponents ---

const LogItem = ({ log, onRevert }) => {
  const [expanded, setExpanded] = useState(false);
  const changes = JSON.parse(log.changed_fields || '{}');

  return (
    <div style={{ 
      padding: '16px', 
      borderRadius: 'var(--radius-md)', 
      background: 'white', 
      border: '1px solid #f1f5f9',
      transition: 'var(--transition)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: log.action === 'delete' ? '#fef2f2' : '#eff6ff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: log.action === 'delete' ? 'var(--danger-color)' : 'var(--primary-color)'
          }}>
            {log.action === 'update' ? <RefreshCw size={18} /> : 
             log.action === 'delete' ? <Trash2 size={18} /> : <FileText size={18} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>
              {log.user_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                {log.action === 'update' ? '修改了' : 
                 log.action === 'delete' ? '刪除了' : 
                 log.action === 'restore' ? '恢復了' : 
                 log.action === 'revert' ? '還原了' : '操作了'} 成員 
                <span style={{ color: 'var(--text-main)', fontWeight: 600 }}> {log.target_id}</span>
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Clock size={12} /> {new Date(log.created_at).toLocaleString()}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {log.action === 'update' && (
            <button 
              onClick={() => onRevert(log)}
              style={{ padding: '6px 12px', borderRadius: ' var(--radius-sm)', border: '1px solid #e2e8f0', background: 'white', fontSize: '13px' }}
            >
              <RotateCcw size={14} /> 還原到此版本
            </button>
          )}
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)' }}
          >
            <ChevronRight size={20} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>變更詳情：</div>
              {Object.keys(changes).length > 0 ? (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {Object.entries(changes).map(([field, vals]) => (
                    <div key={field} style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: '#64748b', minWidth: '80px' }}>{field}:</span>
                      <span style={{ color: 'var(--danger-color)', textDecoration: 'line-through' }}>{String(vals.old)}</span>
                      <ChevronRight size={14} color="#94a3b8" />
                      <span style={{ color: 'var(--success-color)' }}>{String(vals.new)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8' }}>無具體變更欄位信息</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TrashCard = ({ member, onRestore }) => (
  <div className="glass-card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'white' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <User size={20} color="#94a3b8" />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '16px' }}>{member.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {member.id}</div>
      </div>
    </div>
    <div style={{ fontSize: '13px', color: 'var(--danger-color)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Clock size={14} /> 刪除於: {new Date(member.deleted_at).toLocaleString()}
    </div>
    <button onClick={() => onRestore(member.id)} className="pill-button" style={{ width: '100%' }}>
      <RotateCcw size={16} /> 恢復成員
    </button>
  </div>
);

const BackupCard = ({ backup }) => (
  <div className="glass-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'white' }}>
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {backup.filename}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
        建立時間: {new Date(backup.created_at).toLocaleString()}
      </div>
    </div>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button style={{ flex: 1, padding: '6px', fontSize: '12px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
        <HardDriveDownload size={14} /> 下載
      </button>
      <button style={{ flex: 1, padding: '6px', fontSize: '12px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', color: 'var(--danger-color)' }}>
        還原 (未開放)
      </button>
    </div>
  </div>
);

const EmptyState = ({ text }) => (
  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
    <AlertCircle size={48} strokeWidth={1} style={{ marginBottom: '16px' }} />
    <p>{text}</p>
  </div>
);

export default AdminDashboard;
