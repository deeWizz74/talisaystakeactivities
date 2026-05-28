import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { SpeedInsights } from '@vercel/speed-insights/react';

// ─── Google Fonts ─────────────────────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';
document.head.appendChild(fontLink);

// ─── Org color palette ────────────────────────────────────────────────────────
const getOrgColors = (orgName, dark = true) => {
  const clean = (orgName || '').trim().toLowerCase();
  if (!clean) return dark
    ? { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', border: '#6366f1' }
    : { bg: '#ede9fe', text: '#4f46e5', border: '#6366f1' };
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  const darkPalette = [
    { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: '#10b981' },
    { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: '#f59e0b' },
    { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: '#6366f1' },
    { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: '#ef4444' },
    { bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee', border: '#06b6d4' },
    { bg: 'rgba(236,72,153,0.12)',  text: '#f472b6', border: '#ec4899' },
    { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: '#64748b' },
  ];
  const lightPalette = [
    { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
    { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
    { bg: '#ede9fe', text: '#4338ca', border: '#6366f1' },
    { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    { bg: '#cffafe', text: '#164e63', border: '#06b6d4' },
    { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
    { bg: '#f1f5f9', text: '#334155', border: '#94a3b8' },
  ];
  const palette = dark ? darkPalette : lightPalette;
  return palette[Math.abs(hash) % palette.length];
};

const AVAILABLE_VENUES = ["Sacrament Hall","Overflow","Cultural Hall","Relief Society Room","Court"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.trim().split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
};
const calcDuration = (s, e) => {
  const d = timeToMinutes(e) - timeToMinutes(s);
  if (d <= 0) return '—';
  const h = Math.floor(d / 60), m = d % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
const fmt12 = (t) => {
  if (!t) return '';
  const [hS, mS] = t.split(':');
  let h = parseInt(hS, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mS} ${ap}`;
};

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const makeTokens = (dark) => dark ? {
  // Dark theme
  appBg:        '#0a0e1a',
  surfacePrimary: 'rgba(15,22,41,0.85)',
  surfaceSecondary: 'rgba(30,41,59,0.6)',
  surfaceCard:  'rgba(15,22,41,0.7)',
  border:       'rgba(148,163,184,0.1)',
  borderAccent: 'rgba(99,102,241,0.25)',
  text1:        '#e2e8f0',
  text2:        '#94a3b8',
  text3:        '#64748b',
  headerBg:     'rgba(10,14,26,0.92)',
  tabBg:        'rgba(10,14,26,0.7)',
  inputBg:      'rgba(15,22,41,0.95)',
  inputBorder:  'rgba(99,102,241,0.25)',
  inputColor:   '#e2e8f0',
  modalBg:      '#0f1629',
  calCellBg:    'rgba(15,22,41,0.6)',
  calCellHover: 'rgba(99,102,241,0.05)',
  tableTh:      'rgba(15,22,41,0.9)',
  tableHover:   'rgba(99,102,241,0.05)',
  statCard:     'rgba(15,22,41,0.7)',
  scrollTrack:  '#0f1629',
  scrollThumb:  '#334155',
  glow1: 'rgba(99,102,241,0.08)',
  glow2: 'rgba(6,182,212,0.06)',
  btnGhost: 'rgba(30,41,59,0.7)',
  btnGhostBorder: 'rgba(148,163,184,0.15)',
  btnGhostText: '#94a3b8',
  selectOption: '#0f1629',
  labelColor:   '#64748b',
  emptyBorder:  'rgba(148,163,184,0.15)',
  emptyColor:   '#64748b',
  sectionBg:    'rgba(15,22,41,0.7)',
  progressTrack:'rgba(30,41,59,0.8)',
  divider:      'rgba(148,163,184,0.1)',
  approvalDateBg: 'rgba(10,14,26,0.5)',
  pendingDateBg: 'rgba(245,158,11,0.08)',
} : {
  // Light theme
  appBg:        '#f1f5f9',
  surfacePrimary: 'rgba(255,255,255,0.95)',
  surfaceSecondary: 'rgba(241,245,249,0.8)',
  surfaceCard:  '#ffffff',
  border:       'rgba(15,23,42,0.08)',
  borderAccent: 'rgba(99,102,241,0.3)',
  text1:        '#0f172a',
  text2:        '#475569',
  text3:        '#94a3b8',
  headerBg:     'rgba(255,255,255,0.96)',
  tabBg:        'rgba(241,245,249,0.9)',
  inputBg:      '#ffffff',
  inputBorder:  'rgba(99,102,241,0.3)',
  inputColor:   '#0f172a',
  modalBg:      '#ffffff',
  calCellBg:    '#ffffff',
  calCellHover: 'rgba(99,102,241,0.04)',
  tableTh:      '#f8fafc',
  tableHover:   'rgba(99,102,241,0.04)',
  statCard:     '#ffffff',
  scrollTrack:  '#f1f5f9',
  scrollThumb:  '#cbd5e1',
  glow1: 'rgba(99,102,241,0.05)',
  glow2: 'rgba(6,182,212,0.04)',
  btnGhost: '#ffffff',
  btnGhostBorder: 'rgba(15,23,42,0.15)',
  btnGhostText: '#475569',
  selectOption: '#ffffff',
  labelColor:   '#94a3b8',
  emptyBorder:  'rgba(15,23,42,0.1)',
  emptyColor:   '#94a3b8',
  sectionBg:    '#ffffff',
  progressTrack:'#e2e8f0',
  divider:      'rgba(15,23,42,0.08)',
  approvalDateBg: '#f8fafc',
  pendingDateBg: '#fffbeb',
};

// ─── GlobalStyles ─────────────────────────────────────────────────────────────
const GlobalStyles = ({ t, dark }) => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sora', sans-serif; background: ${t.appBg}; color: ${t.text1}; min-height: 100vh; transition: background 0.3s, color 0.3s; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
    ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }

    input, select, textarea {
      font-family: 'Sora', sans-serif;
      background: ${t.inputBg} !important;
      border: 1px solid ${t.inputBorder} !important;
      color: ${t.inputColor} !important;
      border-radius: 8px; padding: 10px 14px; width: 100%;
      font-size: 14px; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.3s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.18) !important;
    }
    input:disabled, select:disabled, textarea:disabled { opacity: 0.45; cursor: not-allowed; }
    select option { background: ${t.selectOption}; color: ${t.inputColor}; }

    label {
      display: block; font-size: 11px; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: ${t.labelColor}; margin-bottom: 6px;
    }

    .tab-btn {
      padding: 9px 18px; border-radius: 8px; border: 1px solid transparent;
      font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.2s; white-space: nowrap;
      display: flex; align-items: center; gap: 6px;
    }
    .tab-btn.active { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.4); color: #6366f1; }
    .tab-btn.inactive { background: transparent; color: ${t.text3}; }
    .tab-btn.inactive:hover { background: rgba(99,102,241,0.08); color: ${t.text2}; }

    .btn {
      font-family: 'Sora', sans-serif; border: none; border-radius: 8px;
      padding: 9px 18px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.18s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-primary { background: linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .btn-success { background: linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow: 0 4px 15px rgba(16,185,129,0.25); }
    .btn-success:hover { transform: translateY(-1px); }
    .btn-success:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .btn-danger { background: linear-gradient(135deg,#ef4444,#dc2626); color:#fff; box-shadow: 0 4px 12px rgba(239,68,68,0.25); }
    .btn-danger:hover { transform: translateY(-1px); }
    .btn-ghost {
      background: ${t.btnGhost}; border: 1px solid ${t.btnGhostBorder}; color: ${t.btnGhostText};
    }
    .btn-ghost:hover { background: ${dark ? 'rgba(51,65,85,0.8)' : '#f1f5f9'}; color: ${t.text1}; }

    .mono { font-family: 'JetBrains Mono', monospace; }

    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideUp { from { opacity:0; transform:translateY(28px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes toastIn { from { opacity:0; transform:translateX(110%); } to { opacity:1; transform:translateX(0); } }
    @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
    @keyframes spin { to { transform:rotate(360deg); } }

    .fade-in  { animation: fadeIn  0.28s ease both; }
    .slide-up { animation: slideUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }

    .calendar-cell {
      background: ${t.calCellBg}; border: 1px solid ${t.border}; border-radius: 10px;
      min-height: 110px; padding: 8px; cursor: pointer; transition: all 0.18s; position: relative;
    }
    .calendar-cell:hover { border-color: rgba(99,102,241,0.35); background: ${t.calCellHover}; }
    .calendar-cell.today { border-color: rgba(99,102,241,0.5); background: ${dark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'}; }

    .activity-pill { border-radius: 6px; padding: 4px 7px; margin-bottom: 3px; font-size: 11px; cursor: pointer; transition: all 0.15s; overflow: hidden; }
    .activity-pill:hover { transform: translateX(2px); filter: brightness(${dark ? '1.12' : '0.95'}); }

    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase; color: ${t.text3};
      border-bottom: 1px solid ${t.border}; background: ${t.tableTh};
      position: sticky; top: 0; z-index: 1;
    }
    .data-table td { padding: 13px 16px; font-size: 13px; border-bottom: 1px solid ${t.border}; color: ${t.text2}; }
    .data-table tr:hover td { background: ${t.tableHover}; }

    .stat-card { background: ${t.statCard}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: ${dark ? 'none' : '0 1px 4px rgba(15,23,42,0.06)'}; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,0.12); }

    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,${dark ? '0.7' : '0.4'});
      backdrop-filter: blur(6px); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .modal-card {
      background: ${t.modalBg}; border: 1px solid ${t.borderAccent}; border-radius: 16px;
      padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 25px 60px rgba(0,0,0,${dark ? '0.6' : '0.18'}), 0 0 0 1px rgba(99,102,241,0.1);
    }

    .approval-card { background: ${t.surfaceCard}; border: 1px solid ${t.border}; border-radius: 12px; overflow: hidden; transition: transform 0.18s, box-shadow 0.18s; box-shadow: ${dark ? 'none' : '0 1px 4px rgba(15,23,42,0.06)'}; }
    .approval-card:hover { transform: translateX(3px); box-shadow: 0 4px 16px rgba(99,102,241,0.12); }

    .progress-bar-track { background: ${t.progressTrack}; border-radius: 20px; overflow: hidden; height: 8px; }
    .progress-bar-fill { height: 100%; border-radius: 20px; transition: width 0.6s ease; }

    .audit-badge { padding: 3px 9px; border-radius: 5px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; font-family: 'JetBrains Mono', monospace; }

    .theme-toggle {
      width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer;
      position: relative; transition: background 0.3s; padding: 0; flex-shrink: 0;
      background: ${dark ? '#6366f1' : '#cbd5e1'};
    }
    .theme-toggle::after {
      content: ''; position: absolute; top: 3px; width: 18px; height: 18px;
      border-radius: 50%; background: #fff; transition: left 0.3s;
      left: ${dark ? '23px' : '3px'};
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }

    .network-bg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
    .network-bg::before { content: ''; position: absolute; top: -40%; left: -20%; width: 80%; height: 80%; background: radial-gradient(ellipse, ${t.glow1} 0%, transparent 70%); border-radius: 50%; }
    .network-bg::after  { content: ''; position: absolute; bottom: -30%; right: -10%; width: 60%; height: 60%; background: radial-gradient(ellipse, ${t.glow2} 0%, transparent 70%); border-radius: 50%; }
  `}</style>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message }) => {
  if (!message.text) return null;
  const err = message.type === 'error';
  return (
    <div style={{
      position:'fixed', top:24, right:24, zIndex:9999,
      padding:'14px 20px',
      background: err ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10b981,#059669)',
      borderRadius:10, color:'#fff',
      boxShadow:`0 8px 30px ${err ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
      fontSize:13, fontWeight:600, maxWidth:340,
      animation:'toastIn 0.3s ease',
      display:'flex', alignItems:'center', gap:10,
    }}>
      <span>{err ? '⚠' : '✓'}</span>{message.text}
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Theme state (persisted) ──────────────────────────────────────────────────
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('stake_theme');
    return saved !== null ? saved === 'dark' : true; // default dark
  });
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('stake_theme', next ? 'dark' : 'light');
  };
  const t = makeTokens(dark);

  // ── Core state ───────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([]);
  const [activities, setActivities] = useState([]);
  const [auditLogs, setAuditLogs]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('supabase_user_session');
    return s ? JSON.parse(s) : null;
  });
  const [feedbackMessage, setFeedbackMessage] = useState({ text:'', type:'' });
  const [adminTab, setAdminTab]   = useState('dashboard');
  const [authScreen, setAuthScreen] = useState('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [recoveryUser, setRecoveryUser] = useState('');
  const [recoveryOrg,  setRecoveryOrg]  = useState('');
  const [recoveryResult, setRecoveryResult] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1));
  const [selectedDateStr, setSelectedDateStr] = useState(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen]         = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [conflictError, setConflictError]     = useState('');
  const [activityForm, setActivityForm] = useState({
    title:'', description:'', startTime:'08:00', endTime:'10:00',
    organization:'', location:AVAILABLE_VENUES[0], is_approved:false,
  });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ username:'', password:'', name:'', calling:'', organization:'', isAdmin:false });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [passwordError, setPasswordError] = useState('');

  const showToast = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage({ text:'', type:'' }), 4000);
  };

  const writeAuditLog = async (userId, operatorName, actionType, targetContext) => {
    try {
      await supabase.from('audit_logs').insert([{ user_id:userId, operator_name:operatorName, action_type:actionType, target_context:targetContext }]);
    } catch(err) { console.error('Audit:', err.message); }
  };

  /// ── fetchActivities — fetches activities for the CURRENT SELECTED MONTH ONLY ──
  const fetchActivities = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    
    // Get the exact start and end days for the currently chosen calendar month
    const year  = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const last  = String(new Date(year, currentDate.getMonth() + 1, 0).getDate()).padStart(2, '0');
    
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .gte('date', `${year}-${month}-01`)
      .lte('date', `${year}-${month}-${last}`);
      
    if (!error && data) {
      setActivities(data);
    }
    setLoading(false);
  }, [currentUser, currentDate]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) setUsers(data);
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('audit_logs').select('*')
      .not('action_type','in','("LOGIN","LOGOUT","FORGOT_PASSWORD","SECURITY")')
      .order('created_at',{ ascending:false }).limit(200);
    if (!error && data) setAuditLogs(data);
    setLoading(false);
  };

  useEffect(() => { if (currentUser) fetchActivities(); }, [currentUser, currentDate, fetchActivities]);
  useEffect(() => {
    if (currentUser?.is_admin) {
      if (adminTab === 'users') fetchUsers();
      else if (adminTab === 'audit') fetchAuditLogs();
    }
  }, [currentUser, adminTab]);

  // Dynamic CSS injector for beautiful mobile screen transformations
  useEffect(() => {
    const styleId = 'mobile-responsive-overrides';
    let styleTag = document.getElementById(styleId);
    
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      styleTag.innerHTML = `
        /* Responsive target adjustments for smartphones */
        @media (max-width: 768px) {
          /* 1. App Layout Layout Wrapper Stack changes */
          div[style*="display: 'flex'"][style*="minHeight: '100vh'"] {
            flex-direction: column !important;
          }
          
          /* 2. Collapse wide sidebars down into thin banners */
          aside, div[style*="width: '280px'"] {
            width: 100% !important;
            padding: 15px !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border) || rgba(255,255,255,0.1) !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          }
          
          /* 3. Re-orient main dashboard content sections */
          main, div[style*="padding: '40px'"] {
            padding: 16px !important;
          }
          
          /* 4. Tab Navigation buttons stack vertically or scroll */
          div[style*="gap: '12px'"], div[style*="gap: '15px'"] {
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          
          button {
            padding: 8px 12px !important;
            font-size: 13px !important;
          }
          
          /* 5. Transform 7-column calendar grid layout rules */
          div[style*="gridTemplateColumns: 'repeat(7, 1fr)'"] {
            grid-template-columns: repeat(7, 1fr) !important;
            gap: 2px !important;
          }
          
          /* Shorten grid cells so they don't stretch forever on mobile screens */
          div[style*="minHeight: '130px'"] {
            min-height: 70px !important;
            padding: 4px !important;
          }
          
          /* Shrink typography metrics to fit column segments */
          span[style*="fontSize: '26px'"] {
            font-size: 18px !important;
          }
          
          /* Hide verbose text inside small day cells to avoid overflow text wrap loops */
          div[style*="overflowY: 'auto'"] span {
            font-size: 10px !important;
            padding: 1px 4px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          
          /* 6. Enlarge full screen modal cards to take full container shapes */
          div[style*="maxWidth: '500px'"] {
            width: 95% !important;
            padding: 20px !important;
            margin: 10px !important;
          }
          
          /* Stack action dashboard analytics cards row-by-row */
          div[style*="gridTemplateColumns: 'repeat(auto-fit'"] {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }
      `;
      document.head.appendChild(styleTag);
    }
    
    return () => {
      const existingTag = document.getElementById(styleId);
      if (existingTag) existingTag.remove();
    };
  }, []);
  
  // ── Conflict detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActivityModalOpen || isReadOnly) return;
    const check = async () => {
      setConflictError('');
      const s = timeToMinutes(activityForm.startTime);
      const e = timeToMinutes(activityForm.endTime);
      if (e <= s) { setConflictError('End time must be after start time.'); return; }
      if (!activityForm.location?.trim()) return;
      let q = supabase.from('activities').select('title,start_time,end_time,location,organization').eq('date', selectedDateStr);
      if (editingActivity) q = q.neq('id', editingActivity.id);
      const { data } = await q;
      if (data) {
        const loc = activityForm.location.trim().toLowerCase();
        const hit = data.find(a => {
          if ((a.location||'').trim().toLowerCase() !== loc) return false;
          const as = timeToMinutes(a.start_time), ae = timeToMinutes(a.end_time);
          return s < ae && e > as;
        });
        if (hit) setConflictError(`Venue conflict: "${hit.title}" (${hit.organization}) has this space from ${fmt12(hit.start_time)} to ${fmt12(hit.end_time)}.`);
      }
    };
    const timer = setTimeout(check, 400);
    return () => clearTimeout(timer);
  }, [activityForm.startTime, activityForm.endTime, activityForm.location, isActivityModalOpen, selectedDateStr, editingActivity, isReadOnly]);

  // ── Calendar helpers ──────────────────────────────────────────────────────────
  const getDaysInMonth = (date) => {
    const y = date.getFullYear(), m = date.getMonth();
    const days = [];
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m+1, 0).getDate();
    for (let i=0; i<first; i++) days.push(null);
    for (let d=1; d<=total; d++) {
      days.push({ day:d, dateString:`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` });
    }
    return days;
  };
  const calendarDays = getDaysInMonth(currentDate);
  const todayStr = new Date().toISOString().split('T')[0];

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError('');
    const { data, error } = await supabase.from('profiles').select('*')
      .eq('username', usernameInput).eq('password', passwordInput).single();
    if (!error && data) {
      localStorage.setItem('supabase_user_session', JSON.stringify(data));
      setCurrentUser(data);
      showToast(`Welcome back, ${data.name}!`);
    } else { setLoginError('Invalid credentials. Please try again.'); }
  };

  const handlePasswordRecovery = async (e) => {
    e.preventDefault(); setLoginError(''); setRecoveryResult(null);
    const { data, error } = await supabase.from('profiles').select('*')
      .eq('username', recoveryUser).ilike('organization', recoveryOrg).single();
    if (!error && data) {
      const { data: aData } = await supabase.from('profiles').select('name').eq('is_admin',true).limit(1);
      const token = `RST-${btoa(data.username).slice(0,4).toUpperCase()}-${data.id.slice(0,4).toUpperCase()}`;
      setRecoveryResult({ adminName: aData?.[0]?.name || 'Super Admin', token, userName: data.name });
    } else { setLoginError('Account not found. Check your username and organization.'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('supabase_user_session');
    setCurrentUser(null); setActivities([]); setUsers([]); setAuditLogs([]);
    setUsernameInput(''); setPasswordInput(''); setAuthScreen('login');
  };

  // ── Activity CRUD ─────────────────────────────────────────────────────────────
  const openActivityModal = (dateStr, activity = null) => {
    setSelectedDateStr(dateStr); setConflictError('');
    if (activity) {
      setEditingActivity(activity);
      setActivityForm({
        title: activity.title || '',
        description: activity.description || '',
        startTime: activity.start_time ? activity.start_time.slice(0,5) : '08:00',
        endTime:   activity.end_time   ? activity.end_time.slice(0,5)   : '10:00',
        organization: activity.organization || '',
        location:     activity.location     || '', // ✅ Reads custom input string cleanly
        is_approved:  activity.is_approved === true,
      });
      setIsReadOnly(!currentUser?.is_admin && activity.user_id !== currentUser?.id);
    } else {
      setEditingActivity(null); setIsReadOnly(false);
      setActivityForm({
        title:'', description:'', startTime:'08:00', endTime:'10:00',
        organization: currentUser?.organization || '',
        location: '', // ✅ Clears so placeholder prompts selection
        is_approved: !!currentUser?.is_admin,
      });
    }
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (isReadOnly || conflictError.startsWith('Venue conflict')) return;

    // ✅ FIXED: Using 'payload' to perfectly match your try/catch variables below
    const payload = {
      title:        activityForm.title,
      description:  activityForm.description,
      start_time:   activityForm.startTime,
      end_time:     activityForm.endTime,
      organization: activityForm.organization || currentUser?.organization || '',
      location:     activityForm.location,
      date:         selectedDateStr,
      user_id:      editingActivity ? editingActivity.user_id : (currentUser?.id || null),
      is_approved:  activityForm.is_approved === true, // Saves true/false explicitly to Supabase
    };

    try {
      if (editingActivity) {
        const { error } = await supabase.from('activities').update(payload).eq('id', editingActivity.id);
        if (error) throw error;
        
        await writeAuditLog(currentUser?.id, currentUser?.name, 'UPDATE', `Modified activity: "${activityForm.title}" on date ${selectedDateStr}`);
        showToast("Activity deployment configuration updated.");
      } else {
        const { error } = await supabase.from('activities').insert([payload]);
        if (error) throw error;
        
        await writeAuditLog(currentUser?.id, currentUser?.name, 'INSERT', `Plotted activity: "${activityForm.title}" for ${selectedDateStr}`);
        showToast("Activity Saved");
      }
      setIsActivityModalOpen(false);
      fetchActivities(); // Force real-time reload of all tabs and counts
    } catch(err) {
      showToast(`Database error: ${err.message}`, "error");
    }
  };

  const handleDeleteActivity = async (id) => {
    if (isReadOnly) return;
    try {
      await supabase.from('activities').delete().eq('id', id);
      // optimistic removal
      setActivities(prev => prev.filter(a => a.id !== id));
      await writeAuditLog(currentUser.id, currentUser.name, 'DELETE', `Deleted activity [${id}]`);
      showToast('Activity deleted.'); setIsActivityModalOpen(false);
    } catch(err) { showToast(`Cannot delete: ${err.message}`, 'error'); }
  };

  // ── Quick approve directly from approvals list (no modal needed) ──────────────
  const handleQuickApprove = async (act) => {
    try {
      // .select().single() makes Supabase return the updated row.
      // If RLS silently blocks the write, data comes back null with no error.
      const { data: updated, error } = await supabase
        .from('activities')
        .update({ is_approved: true })
        .eq('id', act.id)
        .select()
        .single();
      if (error) throw error;
      if (!updated) {
        showToast('DB did not update the row — check Supabase RLS policies on the activities table (admin may lack UPDATE permission).', 'error');
        return;
      }
      // Replace the local record with the verified DB row
      setActivities(prev => prev.map(a => a.id === act.id ? updated : a));
      await writeAuditLog(currentUser.id, currentUser.name, 'UPDATE', `Approved: "${act.title}" on ${act.date}`);
      showToast(`"${act.title}" approved — now visible to members.`);
    } catch(err) { showToast(`Approval failed: ${err.message}`, 'error'); }
  };

  // ── User CRUD ────�����────────────────────���───────────────────────────────────────
  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({ username:user.username, password:user.password, name:user.name, calling:user.calling, organization:user.organization, isAdmin:user.is_admin||false });
    } else {
      setEditingUser(null);
      setUserForm({ username:'', password:'', name:'', calling:'', organization:'', isAdmin:false });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const payload = { username:userForm.username, password:userForm.password, name:userForm.name, calling:userForm.calling, organization:userForm.organization, is_admin:userForm.isAdmin };
    try {
      if (editingUser) {
        const { error } = await supabase.from('profiles').update(payload).eq('id', editingUser.id);
        if (error) throw error;
        await writeAuditLog(currentUser.id, currentUser.name, 'UPDATE', `Updated user: "${userForm.username}"`);
        showToast('User updated.');
      } else {
        const { error } = await supabase.from('profiles').insert([payload]);
        if (error) throw error;
        await writeAuditLog(currentUser.id, currentUser.name, 'INSERT', `Created user: "${userForm.username}"`);
        showToast('User created.');
      }
      setIsUserModalOpen(false); fetchUsers();
    } catch(err) { showToast(`Save failed: ${err.message}`, 'error'); }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault(); setPasswordError('');
    if (passwordForm.currentPassword !== currentUser.password) { setPasswordError('Current password is incorrect.'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('New passwords do not match.'); return; }
    if (passwordForm.newPassword.length < 4) { setPasswordError('Password must be at least 4 characters.'); return; }
    try {
      const { error } = await supabase.from('profiles').update({ password:passwordForm.newPassword }).eq('id', currentUser.id);
      if (error) throw error;
      const upd = { ...currentUser, password:passwordForm.newPassword };
      localStorage.setItem('supabase_user_session', JSON.stringify(upd));
      setCurrentUser(upd);
      await writeAuditLog(currentUser.id, currentUser.name, 'SECURITY', 'Password changed.');
      showToast('Password updated successfully.');
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch(err) { setPasswordError(`Update failed: ${err.message}`); }
  };

  const handleDeleteUser = async (id) => {
    try {
      await supabase.from('profiles').delete().eq('id', id);
      await writeAuditLog(currentUser.id, currentUser.name, 'DELETE', `Deleted profile [${id}]`);
      showToast('User deleted.'); fetchUsers(); fetchActivities();
    } catch(err) { showToast(`Delete failed: ${err.message}`, 'error'); }
  };

  // ── Analytics ─────────────────────────────────────────────────────────────────
  const getMetrics = () => {
    const total = activities.length;
    const orgMap = {};
    let totalMins = 0;
    activities.forEach(a => {
      orgMap[a.organization] = (orgMap[a.organization] || 0) + 1;
      const d = timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
      if (d > 0) totalMins += d;
    });
    return { total, uniqueOrgs: Object.keys(orgMap).length, avgHours: total > 0 ? (totalMins/total/60).toFixed(1) : 0, orgMap };
  };
  const metrics = getMetrics();

  // ── Derived counts (live from activities state) ────────────────────────────────
  const pendingCount = activities.filter(a => !a.is_approved).length;

  // ══════════════════════════════════════════════════════════════════════════════
  // AUTH SCREEN
  // ══════════════════════════════════════════════════════════════════════════════
  if (!currentUser) {
    return (
      <>
        <SpeedInsights />
        <GlobalStyles t={t} dark={dark} />
        <div className="network-bg" />
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, position:'relative', zIndex:1 }}>
          {/* Theme toggle top-right */}
          <div style={{ position:'fixed', top:20, right:20, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:t.text3 }}>{dark ? '🌙' : '☀️'}</span>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" />
          </div>
          <div style={{ width:'100%', maxWidth:440 }} className="slide-up">
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 8px 24px rgba(99,102,241,0.4)', fontSize:24 }}>⛪</div>
              <h1 style={{ fontSize:18, fontWeight:700, color:t.text1, marginBottom:4 }}>Talisay Philippines Stake</h1>
              <p style={{ fontSize:12, color:t.text3, letterSpacing:'0.08em', textTransform:'uppercase' }}>Calendar of Activities</p>
            </div>
            <div style={{ background:t.surfacePrimary, border:`1px solid ${t.borderAccent}`, borderRadius:16, padding:32, backdropFilter:'blur(16px)', boxShadow:`0 20px 60px rgba(0,0,0,${dark?'0.5':'0.1'})` }}>
              {authScreen === 'login' ? (
                <>
                  <h2 style={{ fontSize:20, fontWeight:700, marginBottom:6, color:t.text1 }}>Sign in</h2>
                  <p style={{ fontSize:13, color:t.text3, marginBottom:24 }}>Enter your credentials to continue.</p>
                  {loginError && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:13 }}>{loginError}</div>}
                  <form onSubmit={handleLogin}>
                    <div style={{ marginBottom:16 }}><label>Username</label><input type="text" value={usernameInput} onChange={e=>setUsernameInput(e.target.value)} required placeholder="your.username" /></div>
                    <div style={{ marginBottom:24 }}><label>Password</label><input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} required placeholder="••••••••" /></div>
                    <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 18px' }}>Sign In →</button>
                  </form>
                  <div style={{ textAlign:'center', marginTop:20 }}>
                    <span onClick={() => { setAuthScreen('forgot'); setLoginError(''); }} style={{ fontSize:13, color:'#6366f1', cursor:'pointer', textDecoration:'underline' }}>Forgot password?</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize:20, fontWeight:700, marginBottom:6, color:t.text1 }}>Credential Recovery</h2>
                  <p style={{ fontSize:13, color:t.text3, marginBottom:24 }}>Verify your details to locate your account.</p>
                  {loginError && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:13 }}>{loginError}</div>}
                  {!recoveryResult ? (
                    <form onSubmit={handlePasswordRecovery}>
                      <div style={{ marginBottom:16 }}><label>Username</label><input type="text" value={recoveryUser} onChange={e=>setRecoveryUser(e.target.value)} required /></div>
                      <div style={{ marginBottom:24 }}><label>Organization</label><input type="text" value={recoveryOrg} onChange={e=>setRecoveryOrg(e.target.value)} required /></div>
                      <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', padding:'12px 18px' }}>Locate Account</button>
                    </form>
                  ) : (
                    <div style={{ padding:16, borderRadius:10, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)' }}>
                      <p style={{ fontSize:13, marginBottom:10, color:t.text2 }}>Account found for <strong style={{ color:t.text1 }}>{recoveryResult.userName}</strong>. Show this token to your administrator:</p>
                      <div className="mono" style={{ fontSize:16, fontWeight:700, color:'#10b981', letterSpacing:'0.1em', padding:'8px 12px', background:'rgba(16,185,129,0.08)', borderRadius:8, textAlign:'center' }}>{recoveryResult.token}</div>
                    </div>
                  )}
                  <div style={{ textAlign:'center', marginTop:20 }}>
                    <span onClick={() => { setAuthScreen('login'); setRecoveryResult(null); setLoginError(''); }} style={{ fontSize:13, color:'#6366f1', cursor:'pointer', textDecoration:'underline' }}>← Back to sign in</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN APP
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <SpeedInsights />
      <GlobalStyles t={t} dark={dark} />
      <div className="network-bg" />
      <Toast message={feedbackMessage} />

      <div style={{ minHeight:'100vh', position:'relative', zIndex:1 }}>

        {/* ── Header ── */}
        <header style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, backdropFilter:'blur(16px)', padding:'0 24px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:`0 1px 0 ${t.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 12px rgba(99,102,241,0.35)', flexShrink:0 }}>⛪</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:t.text1, lineHeight:1 }}>Stake Calendar</div>
              <div style={{ fontSize:11, color:t.text3, marginTop:2 }}>
                {currentUser.name}{currentUser.calling ? ` · ${currentUser.calling}` : ''}
                {currentUser.is_admin && <span style={{ marginLeft:8, fontSize:10, fontWeight:700, background:'rgba(99,102,241,0.15)', color:'#6366f1', padding:'1px 7px', borderRadius:20, border:'1px solid rgba(99,102,241,0.3)' }}>ADMIN</span>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* Theme toggle */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:4 }}>
              <span style={{ fontSize:11, color:t.text3 }}>{dark ? '🌙' : '☀️'}</span>
              <button className="theme-toggle" onClick={toggleTheme} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} />
            </div>
            <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => { setPasswordError(''); setIsPasswordModalOpen(true); }}>⚙ Password</button>
            <button className="btn btn-danger" style={{ fontSize:12 }} onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        {/* ── Tab bar ── */}
        <div style={{ display:'flex', gap:4, padding:'10px 24px', overflowX:'auto', background:t.tabBg, borderBottom:`1px solid ${t.border}` }}>
          {[
            { key:'dashboard', label:'⬡ Dashboard' },
            { key:'calendar',  label:'⊞ Calendar' },
            ...(currentUser.is_admin ? [
              { key:'approvals', label:`✦ Approvals${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
              { key:'users',     label:'◈ Users' },
              { key:'analytics', label:'▲ Analytics' },
              { key:'audit',     label:'☰ Audit Logs' },
            ] : []),
          ].map(tb => (
            <button key={tb.key} className={`tab-btn ${adminTab===tb.key?'active':'inactive'}`} onClick={() => setAdminTab(tb.key)}>{tb.label}</button>
          ))}
        </div>

        {/* ── Main ── */}
        <main style={{ padding:'28px 24px', maxWidth:1280, margin:'0 auto' }} className="fade-in">
          {loading && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, color:'#6366f1', fontSize:13 }}>
              <span style={{ animation:'pulse-dot 1s ease infinite' }}>●</span> Loading…
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {adminTab === 'dashboard' && (() => {
            const filtered = (activities||[])
              .filter(a => {
                if (!a?.date) return false;
                const future = a.date >= todayStr;
                return currentUser.is_admin ? future : future && a.is_approved === true;
              })
              .sort((a,b) => a.date !== b.date ? a.date.localeCompare(b.date) : timeToMinutes(a.start_time)-timeToMinutes(b.start_time));
            return (
              <div>
                <div style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:22, fontWeight:700, color:t.text1, marginBottom:4 }}>Upcoming Activities</h2>
                  <p style={{ fontSize:13, color:t.text3 }}>{currentUser.is_admin ? 'All upcoming activities.' : 'Approved activities visible to members.'}</p>
                </div>
                {(() => {
                  // Get the year and month currently selected on your dashboard calendar view
                  const currentYear = currentDate.getFullYear();
                  const currentMonth = currentDate.getMonth();

                  // Filter your existing "filtered" activities array to match the selected calendar month view
                  const activeMonthFiltered = filtered.filter(act => {
                    const eventDate = new Date(act.date + 'T00:00:00');
                    return eventDate.getFullYear() === currentYear && eventDate.getMonth() === currentMonth;
                  });

                  if (activeMonthFiltered.length === 0) {
                    return (
                      <div style={{ padding: '60px 40px', textAlign: 'center', background: t.surfaceCard, borderRadius: 14, border: `1px dashed ${t.emptyBorder}`, color: t.emptyColor, fontSize: 14 }}>
                        📭 No upcoming activities scheduled for this month view.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {activeMonthFiltered.map(act => {
                        const p = getOrgColors(act.organization, dark);
                        const d = new Date(act.date + 'T00:00:00');
                        return (
                          <div 
                            key={act.id} 
                            onClick={() => openActivityModal(act.date, act)} 
                            style={{ display: 'flex', borderRadius: 12, background: t.surfaceCard, border: `1px solid ${t.border}`, borderLeft: `4px solid ${p.border}`, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.18s', boxShadow: dark ? 'none' : '0 1px 4px rgba(15,23,42,0.06)' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.12)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = dark ? 'none' : '0 1px 4px rgba(15,23,42,0.06)'}
                          >
                            <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', background: t.approvalDateBg, borderRight: `1px solid ${t.border}` }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: t.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                              <span style={{ fontSize: 28, fontWeight: 800, color: t.text1, lineHeight: 1 }}>{d.getDate()}</span>
                              <span style={{ fontSize: 10, color: t.text3 }}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                            </div>
                            <div style={{ padding: '16px 20px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span className="badge" style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>{act.organization || 'General'}</span>
                                {act.location && <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>📍 {act.location}</span>}
                              </div>
                              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text1 }}>{act.title}</h4>
                              <div style={{ fontSize: 12, color: t.text2, marginTop: 4, display: 'flex', gap: 12 }}>
                                <span>⏰ {fmt12(act.start_time)} - {fmt12(act.end_time)}</span>
                              </div>
                              {act.description && <p style={{ margin: '6px 0 0 0', fontSize: 12, color: t.text3, fontStyle: 'italic' }}>"{act.description}"</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── CALENDAR ── */}
          {adminTab === 'calendar' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
                <button className="btn btn-ghost" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))}>← Prev</button>
                <h2 style={{ fontSize:22, fontWeight:800, color:t.text1 }}>{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <button className="btn btn-ghost" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))}>Next →</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6 }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:t.text3, letterSpacing:'0.06em', textTransform:'uppercase', padding:'8px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
                {calendarDays.map((item, idx) => {
                  if (!item) return <div key={`e-${idx}`} style={{ minHeight:110 }} />;
                  const isToday = item.dateString === todayStr;
                  const dayActs = (activities||[]).filter(a => {
                    const match = a?.date === item.dateString;
                    return currentUser.is_admin ? match : match && a.is_approved === true;
                  });
                  return (
                    <div key={item.dateString} className={`calendar-cell${isToday?' today':''}`} onClick={() => openActivityModal(item.dateString, null)}>
                      <span style={{ display:'inline-flex', width:24, height:24, alignItems:'center', justifyContent:'center', borderRadius:'50%', fontSize:12, fontWeight:600, marginBottom:4, background: isToday ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'transparent', color: isToday ? '#fff' : t.text2 }}>{item.day}</span>
                      <div>
                        {dayActs.map(act => {
                          const p = getOrgColors(act.organization, dark);
                          return (
                            <div key={act.id} className="activity-pill" onClick={e => { e.stopPropagation(); openActivityModal(item.dateString, act); }} style={{ background:p.bg, color:p.text, borderLeft:`3px solid ${p.border}` }}>
                              <div style={{ fontSize:9, fontWeight:700, opacity:0.8, marginBottom:1 }}>{fmt12(act.start_time)}</div>
                              <div style={{ fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{act.title}</div>
                              {act.location && <div style={{ fontSize:9, opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📍 {act.location}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── APPROVALS ── */}
          {adminTab === 'approvals' && currentUser.is_admin && (() => {
            const pending = activities.filter(a => !a.is_approved).sort((a,b) => a.date.localeCompare(b.date));
            return (
              <div>
                <div style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:22, fontWeight:700, color:t.text1, marginBottom:4 }}>Pending Approvals</h2>
                  <p style={{ fontSize:13, color:t.text3 }}>Review and authorize requests before they appear publicly.</p>
                </div>
                {pending.length === 0 ? (
                  <div style={{ padding:'60px 40px', textAlign:'center', background:t.surfaceCard, borderRadius:14, border:`1px dashed ${t.emptyBorder}`, color:t.emptyColor, fontSize:14 }}>🎉 No pending requests. All clear!</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {pending.map(act => {
                      const p = getOrgColors(act.organization, dark);
                      const d = new Date(act.date+'T00:00:00');
                      return (
                        <div key={act.id} className="approval-card" style={{ borderLeft:'4px solid #f59e0b' }}>
                          <div style={{ display:'flex' }}>
                            <div style={{ minWidth:80, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 20px', background:t.pendingDateBg, borderRight:`1px solid ${t.border}` }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b', textTransform:'uppercase' }}>{d.toLocaleDateString('en-US',{weekday:'short'})}</span>
                              <span style={{ fontSize:28, fontWeight:800, color:t.text1, lineHeight:1 }}>{d.getDate()}</span>
                              <span style={{ fontSize:10, color:t.text3 }}>{d.toLocaleDateString('en-US',{month:'short'})}</span>
                            </div>
                            <div style={{ padding:'16px 20px', flexGrow:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <span style={{ background:p.bg, color:p.text, border:`1px solid ${p.border}`, padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700 }}>{act.organization||'General'}</span>
                                <h4 style={{ fontSize:15, fontWeight:700, color:t.text1, margin:'7px 0 5px' }}>{act.title}</h4>
                                <div style={{ display:'flex', gap:12, fontSize:12, color:t.text2 }}>
                                  <span>⏰ {fmt12(act.start_time)} – {fmt12(act.end_time)}</span>
                                  {act.location && <span style={{ color:'#6366f1' }}>📍 {act.location}</span>}
                                </div>
                                {act.description && <p style={{ margin:'5px 0 0', fontSize:12, color:t.text3, fontStyle:'italic' }}>"{act.description}"</p>}
                              </div>
                              <div style={{ display:'flex', gap:8, marginLeft:16, flexShrink:0 }}>
                                {/* Quick approve button — fixes the pending-not-clearing bug */}
                                <button className="btn btn-success" style={{ fontSize:12, padding:'8px 14px' }} onClick={() => handleQuickApprove(act)}>✓ Approve</button>
                                <button className="btn btn-ghost" style={{ fontSize:12, padding:'8px 14px' }} onClick={() => openActivityModal(act.date, act)}>Edit</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── USERS ── */}
          {adminTab === 'users' && currentUser.is_admin && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
                <div>
                  <h2 style={{ fontSize:22, fontWeight:700, color:t.text1, marginBottom:4 }}>User Management</h2>
                  <p style={{ fontSize:13, color:t.text3 }}>Manage member accounts and access levels.</p>
                </div>
                <button className="btn btn-success" onClick={() => openUserModal()}>+ Add User</button>
              </div>
              <div style={{ background:t.sectionBg, borderRadius:12, border:`1px solid ${t.border}`, overflow:'hidden', boxShadow:dark?'none':'0 1px 4px rgba(15,23,42,0.06)' }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Username</th><th>Calling</th><th>Organization</th><th>Role</th><th>Actions</th></tr></thead>
                  <tbody>
                    {[...users].sort((a,b) => (a.calling||'').localeCompare(b.calling||'')).map(u => (
                      <tr key={u.id}>
                        <td style={{ color:t.text1, fontWeight:600 }}>{u.name}</td>
                        <td className="mono" style={{ fontSize:12 }}>{u.username}</td>
                        <td style={{ color:t.text2 }}>{u.calling||<span style={{color:t.text3}}>—</span>}</td>
                        <td style={{ color:t.text2 }}>{u.organization||<span style={{color:t.text3}}>—</span>}</td>
                        <td>{u.is_admin
                          ? <span className="badge" style={{ background:'rgba(99,102,241,0.15)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.3)' }}>Admin</span>
                          : <span className="badge" style={{ background:dark?'rgba(30,41,59,0.8)':'#f1f5f9', color:t.text3, border:`1px solid ${t.border}` }}>Member</span>
                        }</td>
                        <td>
                          <div style={{ display:'flex', gap:8 }}>
                            <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => openUserModal(u)}>Edit</button>
                            {u.username !== 'admin' && <button className="btn btn-danger" style={{ fontSize:12, padding:'6px 12px' }} onClick={() => handleDeleteUser(u.id)}>Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {adminTab === 'analytics' && currentUser.is_admin && (
            <div>
              <div style={{ marginBottom:24 }}>
                <h2 style={{ fontSize:22, fontWeight:700, color:t.text1, marginBottom:4 }}>Analytics</h2>
                <p style={{ fontSize:13, color:t.text3 }}>Activity metrics for {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}.</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:32 }}>
                {[
                  { value:metrics.total,       label:'Total Activities',     icon:'◎' },
                  { value:metrics.uniqueOrgs,   label:'Active Organizations', icon:'◈' },
                  { value:`${metrics.avgHours}h`, label:'Avg Duration',       icon:'⧗' },
                ].map((s,i) => (
                  <div key={i} className="stat-card">
                    <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
                    <div style={{ fontSize:36, fontWeight:800, color:'#6366f1', lineHeight:1, marginBottom:6 }}>{s.value}</div>
                    <div style={{ fontSize:11, color:t.text3, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:t.sectionBg, border:`1px solid ${t.border}`, borderRadius:12, padding:24, boxShadow:dark?'none':'0 1px 4px rgba(15,23,42,0.06)' }}>
                <h3 style={{ fontSize:15, fontWeight:700, color:t.text1, marginBottom:20 }}>Activity by Organization</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {Object.entries(metrics.orgMap).map(([org, count]) => {
                    const pct = metrics.total ? ((count/metrics.total)*100).toFixed(1) : 0;
                    const p = getOrgColors(org, dark);
                    return (
                      <div key={org} style={{ display:'flex', alignItems:'center', gap:14 }}>
                        <div style={{ width:160, fontSize:13, fontWeight:600, color:t.text1, flexShrink:0 }}>{org}</div>
                        <div style={{ flexGrow:1 }}>
                          <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${p.border},${p.text})` }} />
                          </div>
                        </div>
                        <div style={{ width:80, fontSize:12, color:t.text3, textAlign:'right', flexShrink:0 }}>{count} ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── AUDIT ── */}
          {adminTab === 'audit' && currentUser.is_admin && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
                <div>
                  <h2 style={{ fontSize:22, fontWeight:700, color:t.text1, marginBottom:4 }}>Audit Logs</h2>
                  <p style={{ fontSize:13, color:t.text3 }}>A record of all data modifications.</p>
                </div>
                <button className="btn btn-ghost" onClick={fetchAuditLogs}>↻ Refresh</button>
              </div>
              <div style={{ background:t.sectionBg, borderRadius:12, border:`1px solid ${t.border}`, overflow:'hidden', maxHeight:560, overflowY:'auto', boxShadow:dark?'none':'0 1px 4px rgba(15,23,42,0.06)' }}>
                <table className="data-table">
                  <thead><tr><th>Timestamp</th><th>Operator</th><th>Action</th><th>Description</th></tr></thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td className="mono" style={{ fontSize:11, color:t.text3, whiteSpace:'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ fontWeight:600, color:t.text1 }}>{log.operator_name}</td>
                        <td><span className="audit-badge" style={{
                          background: log.action_type==='DELETE' ? 'rgba(239,68,68,0.15)' : log.action_type==='INSERT' ? 'rgba(16,185,129,0.15)' : log.action_type==='UPDATE' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                          color:       log.action_type==='DELETE' ? '#ef4444'              : log.action_type==='INSERT' ? '#10b981'               : log.action_type==='UPDATE' ? '#f59e0b'               : '#6366f1',
                        }}>{log.action_type}</span></td>
                        <td style={{ fontSize:12, color:t.text2 }}>{log.target_context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════ MODALS ════════════════════════════ */}

      {/* Activity Modal */}
      {isActivityModalOpen && (
        <div className="modal-overlay" onClick={() => setIsActivityModalOpen(false)}>
          <div className="modal-card slide-up" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:t.text1 }}>
                {editingActivity ? (isReadOnly ? '📋 Activity Details' : '✎ Edit Activity') : '+ New Activity'}
              </h3>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {isReadOnly && <span className="badge" style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', fontSize:10 }}>VIEW ONLY</span>}
                <button className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:16 }} onClick={() => setIsActivityModalOpen(false)}>✕</button>
              </div>
            </div>
            {conflictError && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:13 }}>⚠ {conflictError}</div>}
            <form onSubmit={handleSaveActivity}>
              <div style={{ marginBottom:14 }}><label>Activity Title</label><input type="text" value={activityForm.title} onChange={e=>setActivityForm({...activityForm,title:e.target.value})} required disabled={isReadOnly} placeholder="Enter title" /></div>
              <div style={{ marginBottom:14 }}><label>Description</label><textarea value={activityForm.description} onChange={e=>setActivityForm({...activityForm,description:e.target.value})} disabled={isReadOnly} style={{height:70,resize:'none'}} placeholder="Description of the Activity" /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label>Start Time</label><input type="time" value={activityForm.startTime} onChange={e=>setActivityForm({...activityForm,startTime:e.target.value})} required disabled={isReadOnly} /></div>
                <div><label>End Time</label><input type="time" value={activityForm.endTime} onChange={e=>setActivityForm({...activityForm,endTime:e.target.value})} required disabled={isReadOnly} /></div>
              </div>
              {/* Location Selection Block */}
              <div style={{ marginBottom: 14 }}>
                <label>Location / Venue</label>
                <select
                  value={AVAILABLE_VENUES.includes(activityForm.location) || activityForm.location === '' ? activityForm.location : 'Other'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Other') {
                      setActivityForm({ ...activityForm, location: '' });
                    } else {
                      setActivityForm({ ...activityForm, location: val });
                    }
                  }}
                  disabled={isReadOnly}
                  required
                >
                  <option value="" disabled hidden>Select a venue...</option>
                  {AVAILABLE_VENUES.map((venue) => (
                    <option key={venue} value={venue}>{venue}</option>
                  ))}
                  <option value="Other">Other (Custom Location...)</option>
                </select>

                {/* If 'Other' is picked, expose text input field */}
                {!AVAILABLE_VENUES.includes(activityForm.location) && activityForm.location !== undefined && (
                  <div style={{ marginTop: 10, animation: 'fadeIn 0.2s ease both' }}>
                    <label style={{ fontSize: '10px', color: '#6366f1' }}>Specify Custom Location</label>
                    <input
                      type="text"
                      placeholder="e.g., Room 302, Building B, or Zoom Link"
                      value={activityForm.location}
                      onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                      disabled={isReadOnly}
                      required
                    />
                  </div>
                )}
              </div>
              <div style={{ marginBottom:14 }}><label>Organization</label><input type="text" value={activityForm.organization} disabled /></div>
              <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:dark?'rgba(99,102,241,0.08)':'#ede9fe', border:'1px solid rgba(99,102,241,0.2)', fontSize:13, color:'#6366f1', display:'flex', alignItems:'center', gap:8 }}>
                ⧗ Duration: <strong>{calcDuration(activityForm.startTime, activityForm.endTime)}</strong>
              </div>
              {currentUser.is_admin && (
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'12px 14px', borderRadius:8, background: activityForm.is_approved ? (dark?'rgba(16,185,129,0.1)':'#d1fae5') : (dark?'rgba(239,68,68,0.08)':'#fee2e2'), border:`1px solid ${activityForm.is_approved ? (dark?'rgba(16,185,129,0.25)':'#6ee7b7') : (dark?'rgba(239,68,68,0.2)':'#fca5a5')}` }}>
                  <input type="checkbox" id="approveToggle" checked={!!activityForm.is_approved} onChange={e => setActivityForm({ ...activityForm, is_approved: e.target.checked })} style={{ width:18,height:18,cursor:'pointer',accentColor:'#10b981' }} />
                  <label htmlFor="approveToggle" style={{ margin:0, cursor:'pointer', fontWeight:700, fontSize:13, color: activityForm.is_approved ? '#10b981' : '#ef4444', textTransform:'none', letterSpacing:0 }}>
                    {activityForm.is_approved ? '✅ Approve Activity' : '⚠ Pending Approval'}
                  </label>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>{editingActivity && !isReadOnly && <button type="button" className="btn btn-danger" onClick={() => handleDeleteActivity(editingActivity.id)}>Delete</button>}</div>
                <div style={{ display:'flex', gap:10 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setIsActivityModalOpen(false)}>{isReadOnly?'Close':'Cancel'}</button>
                  {!isReadOnly && <button type="submit" className="btn btn-success" disabled={conflictError.startsWith('Venue conflict')}>Save Activity</button>}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUserModalOpen(false)}>
          <div className="modal-card slide-up" onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:t.text1 }}>{editingUser?'✎ Edit User':'+ New User'}</h3>
              <button className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:16 }} onClick={() => setIsUserModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label>Full Name</label><input type="text" value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} required /></div>
                <div><label>Calling</label><input type="text" value={userForm.calling} onChange={e=>setUserForm({...userForm,calling:e.target.value})} required /></div>
              </div>
              <div style={{ marginBottom:14 }}><label>Organization</label><input type="text" value={userForm.organization} onChange={e=>setUserForm({...userForm,organization:e.target.value})} required /></div>
              <div style={{ height:1, background:t.divider, marginBottom:14 }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div><label>Username</label><input type="text" value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})} required disabled={editingUser?.username==='admin'} /></div>
                <div><label>Password</label><input type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} required /></div>
              </div>
              {editingUser?.username !== 'admin' ? (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'12px 14px', borderRadius:8, background:dark?'rgba(99,102,241,0.08)':'#ede9fe', border:'1px solid rgba(99,102,241,0.2)' }}>
                  <input type="checkbox" id="adminToggle" checked={userForm.isAdmin} onChange={e=>setUserForm({...userForm,isAdmin:e.target.checked})} style={{ width:18,height:18,accentColor:'#6366f1',cursor:'pointer' }} />
                  <label htmlFor="adminToggle" style={{ margin:0, fontWeight:700, color:'#6366f1', cursor:'pointer', textTransform:'none', letterSpacing:0, fontSize:13 }}>Grant Administrator Privileges</label>
                </div>
              ) : (
                <p style={{ fontSize:12, color:t.text3, fontStyle:'italic', marginBottom:20 }}>Root admin privileges cannot be modified.</p>
              )}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsUserModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPasswordModalOpen(false)}>
          <div className="modal-card slide-up" onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:18, fontWeight:700, color:t.text1 }}>⚙ Change Password</h3>
              <button className="btn btn-ghost" style={{ padding:'6px 10px', fontSize:16 }} onClick={() => { setIsPasswordModalOpen(false); setPasswordForm({currentPassword:'',newPassword:'',confirmPassword:''}); }}>✕</button>
            </div>
            {passwordError && <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:13 }}>⚠ {passwordError}</div>}
            <form onSubmit={handleUpdatePassword}>
              <div style={{ marginBottom:14 }}><label>Current Password</label><input type="password" value={passwordForm.currentPassword} onChange={e=>setPasswordForm({...passwordForm,currentPassword:e.target.value})} required /></div>
              <div style={{ height:1, background:t.divider, marginBottom:14 }} />
              <div style={{ marginBottom:14 }}><label>New Password</label><input type="password" value={passwordForm.newPassword} onChange={e=>setPasswordForm({...passwordForm,newPassword:e.target.value})} required /></div>
              <div style={{ marginBottom:20 }}><label>Confirm New Password</label><input type="password" value={passwordForm.confirmPassword} onChange={e=>setPasswordForm({...passwordForm,confirmPassword:e.target.value})} required /></div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setIsPasswordModalOpen(false); setPasswordForm({currentPassword:'',newPassword:'',confirmPassword:''}); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}