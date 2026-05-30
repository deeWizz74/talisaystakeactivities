import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import bcrypt from 'bcryptjs';

// ─── Google Fonts ────────────────────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap';
document.head.appendChild(fontLink);

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isAdmin          = (u) => !!u?.is_admin;
const isBishop         = (u) => !u?.is_admin && u?.role === 'Agent Bishop';
const isCommittee      = (u) => !u?.is_admin && u?.role !== 'Agent Bishop' && !!u?.is_activity_committee;
const canReview        = (u) => isAdmin(u) || isBishop(u);
const canViewApprovals = (u) => canReview(u) || isCommittee(u);

// ─── Constants ───────────────────────────────────────────────────────────────
const STAKE_CENTER_VENUES = ['Sacrament Hall', 'Overflow', 'Cultural Hall', 'Relief Society Room', 'Courts'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Utilities ───────────────────────────────────────────────────────────────
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

const statusChip = (act) => {
  const s = act.status || (act.is_approved ? 'approved' : 'pending');
  if (s === 'approved') return { label: '✓ Approved', bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' };
  if (s === 'rejected') return { label: '✕ Declined', bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)'  };
  return                       { label: '⏳ Pending',  bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
};

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
  return (dark ? darkPalette : lightPalette)[Math.abs(hash) % 7];
};

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const makeTokens = (dark) => dark ? {
  appBg: '#0a0e1a', surfacePrimary: 'rgba(15,22,41,0.85)', surfaceSecondary: 'rgba(30,41,59,0.6)',
  surfaceCard: 'rgba(15,22,41,0.7)', border: 'rgba(148,163,184,0.1)', borderAccent: 'rgba(99,102,241,0.25)',
  text1: '#e2e8f0', text2: '#94a3b8', text3: '#64748b',
  headerBg: 'rgba(10,14,26,0.92)', tabBg: 'rgba(10,14,26,0.7)',
  inputBg: 'rgba(15,22,41,0.95)', inputBorder: 'rgba(99,102,241,0.25)', inputColor: '#e2e8f0',
  modalBg: '#0f1629', calCellBg: 'rgba(15,22,41,0.6)', calCellHover: 'rgba(99,102,241,0.05)',
  tableTh: 'rgba(15,22,41,0.9)', tableHover: 'rgba(99,102,241,0.05)', statCard: 'rgba(15,22,41,0.7)',
  scrollTrack: '#0f1629', scrollThumb: '#334155', glow1: 'rgba(99,102,241,0.08)', glow2: 'rgba(6,182,212,0.06)',
  btnGhost: 'rgba(30,41,59,0.7)', btnGhostBorder: 'rgba(148,163,184,0.15)', btnGhostText: '#94a3b8',
  selectOption: '#0f1629', labelColor: '#64748b', emptyBorder: 'rgba(148,163,184,0.15)', emptyColor: '#64748b',
  sectionBg: 'rgba(15,22,41,0.7)', progressTrack: 'rgba(30,41,59,0.8)', divider: 'rgba(148,163,184,0.1)',
  approvalDateBg: 'rgba(10,14,26,0.5)', pendingDateBg: 'rgba(245,158,11,0.08)', declinedDateBg: 'rgba(239,68,68,0.06)',
} : {
  appBg: '#f1f5f9', surfacePrimary: 'rgba(255,255,255,0.95)', surfaceSecondary: 'rgba(241,245,249,0.8)',
  surfaceCard: '#ffffff', border: 'rgba(15,23,42,0.08)', borderAccent: 'rgba(99,102,241,0.3)',
  text1: '#0f172a', text2: '#475569', text3: '#94a3b8',
  headerBg: 'rgba(255,255,255,0.96)', tabBg: 'rgba(241,245,249,0.9)',
  inputBg: '#ffffff', inputBorder: 'rgba(99,102,241,0.3)', inputColor: '#0f172a',
  modalBg: '#ffffff', calCellBg: '#ffffff', calCellHover: 'rgba(99,102,241,0.04)',
  tableTh: '#f8fafc', tableHover: 'rgba(99,102,241,0.04)', statCard: '#ffffff',
  scrollTrack: '#f1f5f9', scrollThumb: '#cbd5e1', glow1: 'rgba(99,102,241,0.05)', glow2: 'rgba(6,182,212,0.04)',
  btnGhost: '#ffffff', btnGhostBorder: 'rgba(15,23,42,0.15)', btnGhostText: '#475569',
  selectOption: '#ffffff', labelColor: '#94a3b8', emptyBorder: 'rgba(15,23,42,0.1)', emptyColor: '#94a3b8',
  sectionBg: '#ffffff', progressTrack: '#e2e8f0', divider: 'rgba(15,23,42,0.08)',
  approvalDateBg: '#f8fafc', pendingDateBg: '#fffbeb', declinedDateBg: '#fff5f5',
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GlobalStyles = ({ t, dark }) => (
  <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sora', sans-serif; background: ${t.appBg}; color: ${t.text1}; min-height: 100vh; transition: background .3s, color .3s; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
    ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
    input, select, textarea {
      font-family: 'Sora', sans-serif;
      background: ${t.inputBg} !important;
      border: 1px solid ${t.inputBorder} !important;
      color: ${t.inputColor} !important;
      border-radius: 8px; padding: 10px 14px; width: 100%; font-size: 14px; outline: none;
      transition: border-color .2s, box-shadow .2s, background .3s;
    }
    input:focus, select:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,.18) !important; }
    input:disabled, select:disabled, textarea:disabled { opacity: .65; cursor: not-allowed; background: rgba(148,163,184,0.05) !important; border-color: rgba(148,163,184,0.15) !important; }
    select option { background: ${t.selectOption}; color: ${t.inputColor}; }
    label { display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${t.labelColor}; margin-bottom: 6px; }
    .tab-btn { padding: 9px 18px; border-radius: 8px; border: 1px solid transparent; font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .2s; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
    .tab-btn.active   { background: rgba(99,102,241,.15); border-color: rgba(99,102,241,.4); color: #6366f1; }
    .tab-btn.inactive { background: transparent; color: ${t.text3}; }
    .tab-btn.inactive:hover { background: rgba(99,102,241,.08); color: ${t.text2}; }
    .btn { font-family: 'Sora', sans-serif; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .18s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; box-shadow: 0 4px 15px rgba(99,102,241,.3); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,.4); }
    .btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; }
    .btn-success { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 4px 15px rgba(16,185,129,.25); }
    .btn-success:hover { transform: translateY(-1px); }
    .btn-success:disabled { opacity: .45; cursor: not-allowed; transform: none; }
    .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; box-shadow: 0 4px 12px rgba(239,68,68,.25); }
    .btn-danger:hover { transform: translateY(-1px); }
    .btn-warning { background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; box-shadow: 0 4px 12px rgba(245,158,11,.25); }
    .btn-warning:hover { transform: translateY(-1px); }
    .btn-ghost { background: ${t.btnGhost}; border: 1px solid ${t.btnGhostBorder}; color: ${t.btnGhostText}; }
    .btn-ghost:hover { background: ${dark ? 'rgba(51,65,85,.8)' : '#f1f5f9'}; color: ${t.text1}; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    @keyframes fadeIn   { from { opacity: 0; transform: translateY(6px)  } to { opacity: 1; transform: translateY(0) } }
    @keyframes slideUp  { from { opacity: 0; transform: translateY(28px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
    @keyframes toastIn  { from { opacity: 0; transform: translateX(110%) } to { opacity: 1; transform: translateX(0) } }
    @keyframes pulse-dot { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
    .fade-in  { animation: fadeIn  .28s ease both; }
    .slide-up { animation: slideUp .32s cubic-bezier(.34,1.56,.64,1) both; }
    .calendar-cell { background: ${t.calCellBg}; border: 1px solid ${t.border}; border-radius: 10px; min-height: 110px; padding: 8px; cursor: pointer; transition: all .18s; }
    .calendar-cell:hover { border-color: rgba(99,102,241,.35); background: ${t.calCellHover}; }
    .calendar-cell.today { border-color: rgba(99,102,241,.5); background: ${dark ? 'rgba(99,102,241,.08)' : 'rgba(99,102,241,.05)'}; }
    .activity-pill { border-radius: 6px; padding: 4px 7px; margin-bottom: 3px; font-size: 11px; cursor: pointer; transition: all .15s; overflow: hidden; }
    .activity-pill:hover { transform: translateX(2px); filter: brightness(${dark ? '1.12' : '.95'}); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${t.text3}; border-bottom: 1px solid ${t.border}; background: ${t.tableTh}; position: sticky; top: 0; z-index: 1; }
    .data-table td { padding: 13px 16px; font-size: 13px; border-bottom: 1px solid ${t.border}; color: ${t.text2}; }
    .data-table tr:hover td { background: ${t.tableHover}; }
    .stat-card { background: ${t.statCard}; border: 1px solid ${t.border}; border-radius: 14px; padding: 24px; transition: transform .2s, box-shadow .2s; box-shadow: ${dark ? 'none' : '0 1px 4px rgba(15,23,42,.06)'}; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,.12); }
    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,${dark ? '.7' : '.4'}); backdrop-filter: blur(6px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal-card { background: ${t.modalBg}; border: 1px solid ${t.borderAccent}; border-radius: 16px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,${dark ? '.6' : '.18'}), 0 0 0 1px rgba(99,102,241,.1); }
    .approval-card { background: ${t.surfaceCard}; border: 1px solid ${t.border}; border-radius: 12px; overflow: hidden; transition: transform .18s, box-shadow .18s; box-shadow: ${dark ? 'none' : '0 1px 4px rgba(15,23,42,.06)'}; }
    .approval-card:hover { transform: translateX(3px); box-shadow: 0 4px 16px rgba(99,102,241,.12); }
    .progress-bar-track { background: ${t.progressTrack}; border-radius: 20px; overflow: hidden; height: 8px; }
    .progress-bar-fill  { height: 100%; border-radius: 20px; transition: width .6s ease; }
    .audit-badge { padding: 3px 9px; border-radius: 5px; font-size: 10px; font-weight: 700; letter-spacing: .06em; font-family: 'JetBrains Mono', monospace; }
    .theme-toggle { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: background .3s; padding: 0; flex-shrink: 0; background: ${dark ? '#6366f1' : '#cbd5e1'}; }
    .theme-toggle::after { content: ''; position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .3s; left: ${dark ? '23px' : '3px'}; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    .network-bg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
    .network-bg::before { content: ''; position: absolute; top: -40%; left: -20%; width: 80%; height: 80%; background: radial-gradient(ellipse, ${t.glow1} 0%, transparent 70%); border-radius: 50%; }
    .network-bg::after  { content: ''; position: absolute; bottom: -30%; right: -10%; width: 60%; height: 60%; background: radial-gradient(ellipse, ${t.glow2} 0%, transparent 70%); border-radius: 50%; }
    .my-act-card { border-radius: 12px; overflow: hidden; transition: transform .18s, box-shadow .18s; box-shadow: ${dark ? 'none' : '0 1px 4px rgba(15,23,42,.06)'}; }
    .my-act-card:hover { transform: translateX(3px); box-shadow: 0 4px 16px rgba(99,102,241,.12); }
  `}</style>
);

// ─── Toast ─────────────────────────────────────────────────────────────────
const Toast = ({ message }) => {
  if (!message.text) return null;
  const err = message.type === 'error';
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      padding: '14px 20px',
      background: err ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10b981,#059669)',
      borderRadius: 10, color: '#fff',
      boxShadow: `0 8px 30px ${err ? 'rgba(239,68,68,.4)' : 'rgba(16,185,129,.4)'}`,
      fontSize: 13, fontWeight: 600, maxWidth: 340, animation: 'toastIn .3s ease',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{err ? '⚠' : '✓'}</span>{message.text}
    </div>
  );
};

// ─── Decline Modal ─────────────────────────────────────────────────────────
const DeclineModal = ({ activity, t, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card slide-up" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text1 }}>✕ Decline Activity</h3>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }} onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 18, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text1, marginBottom: 2 }}>{activity.title}</div>
          <div style={{ fontSize: 12, color: t.text3 }}>{activity.organization} · {fmt12(activity.start_time)} – {fmt12(activity.end_time)}</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>Reason for declining <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this activity is being declined..."
            style={{ height: 100, resize: 'vertical' }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Confirm Decline
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Activity Card ─────────────────────────────────────────────────────────
const ActivityCard = ({ act, onClick, dark, t }) => {
  const p    = getOrgColors(act.organization, dark);
  const d    = new Date(act.date + 'T00:00:00');
  const chip = statusChip(act);
  return (
    <div className="my-act-card" onClick={onClick}
      style={{ display: 'flex', background: t.surfaceCard, border: `1px solid ${t.border}`, borderLeft: `4px solid ${p.border}`, cursor: 'pointer' }}
    >
      <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', background: t.approvalDateBg, borderRight: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.text3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: t.text1, lineHeight: 1 }}>{d.getDate()}</span>
        <span style={{ fontSize: 10, color: t.text3 }}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      </div>
      <div style={{ padding: '14px 18px', flexGrow: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>{act.organization || 'General'}</span>
          <span className="badge" style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>{chip.label}</span>
        </div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: t.text1, marginBottom: 4 }}>{act.title}</h4>
        <div style={{ fontSize: 12, color: t.text2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>⏰ {fmt12(act.start_time)} – {fmt12(act.end_time)}</span>
          {act.location && <span style={{ color: '#6366f1' }}>📍 {act.location}</span>}
        </div>
        {act.status === 'rejected' && act.decline_reason && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 12, color: '#ef4444' }}>
            <strong>Declined:</strong> {act.decline_reason}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Main App
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── Theme ──────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem('stake_theme');
    return s !== null ? s === 'dark' : true;
  });
  const toggleTheme = () => {
    const n = !dark;
    setDark(n);
    localStorage.setItem('stake_theme', n ? 'dark' : 'light');
  };
  const t = makeTokens(dark);

  // ── Core state ──────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [auditLogs,   setAuditLogs]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const s = localStorage.getItem('supabase_user_session');
    return s ? JSON.parse(s) : null;
  });

  // ── UI state ────────────────────────────────────────────────────────────
  const [feedbackMessage,      setFeedbackMessage]      = useState({ text: '', type: '' });
  const [adminTab,             setAdminTab]             = useState('dashboard');
  const [navCollapsed,         setNavCollapsed]         = useState(false);
  const [currentDate,          setCurrentDate]          = useState(new Date(2026, 4, 1));
  const [declineTarget,        setDeclineTarget]        = useState(null);
  const [activityEmailConfirm, setActivityEmailConfirm] = useState(true);

  // ── Auth state ──────────────────────────────────────────────────────────
  const [authScreen,     setAuthScreen]     = useState('login');
  const [usernameInput,  setUsernameInput]  = useState('');
  const [passwordInput,  setPasswordInput]  = useState('');
  const [loginError,     setLoginError]     = useState('');
  const [recoveryUser,   setRecoveryUser]   = useState('');
  const [recoveryResult, setRecoveryResult] = useState(null);

  // ── Activity modal state ────────────────────────────────────────────────
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity,     setEditingActivity]     = useState(null);
  const [isReadOnly,          setIsReadOnly]          = useState(false);
  const [selectedDateStr,     setSelectedDateStr]     = useState(null);
  const [locationType,        setLocationType]        = useState('');
  const [conflictError,       setConflictError]       = useState('');
  const [activityForm,        setActivityForm]        = useState({
    title: '', description: '', startTime: '08:00', endTime: '10:00',
    organization: '', location: '', status: 'pending', decline_reason: '',
  });

  // ── User modal state ────────────────────────────────────────────────────
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser,     setEditingUser]     = useState(null);
  const [userForm,        setUserForm]        = useState({
    username: '', password: '', name: '', calling: '', organization: '',
    isAdmin: false, role: '', email: '', isActivityCommittee: false,
  });

  // ── Account settings modal state ────────────────────────────────────────
  const [isAccountModalOpen,  setIsAccountModalOpen]  = useState(false);
  const [accountTab,          setAccountTab]          = useState('password');
  const [passwordForm,        setPasswordForm]        = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError,       setPasswordError]       = useState('');
  const [showCurrentPw,       setShowCurrentPw]       = useState(false);
  const [showNewPw,           setShowNewPw]           = useState(false);
  const [showConfirmPw,       setShowConfirmPw]       = useState(false);
  const [usernameForm,        setUsernameForm]        = useState({ currentPassword: '', newUsername: '' });
  const [usernameError,       setUsernameError]       = useState('');
  const [emailForm,           setEmailForm]           = useState({ currentPassword: '', newEmail: '' });
  const [emailError,          setEmailError]          = useState('');

  // ── Helpers ─────────────────────────────────────────────────────────────
  const showToast = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage({ text: '', type: '' }), 4000);
  };

  const writeAuditLog = async (userId, operatorName, actionType, targetContext) => {
    try {
      await supabase.from('audit_logs').insert([{ user_id: userId, operator_name: operatorName, action_type: actionType, target_context: targetContext }]);
    } catch (err) {
      console.error('Audit:', err.message);
    }
  };

  // ── Calendar helpers ────────────────────────────────────────────────────
  const getDaysInMonth = (date) => {
    const y = date.getFullYear(), m = date.getMonth();
    const days = [];
    const first = new Date(y, m, 1).getDay(), total = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= total; d++) days.push({ day: d, dateString: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    return days;
  };
  const calendarDays = getDaysInMonth(currentDate);
  const todayStr = new Date().toISOString().split('T')[0];

  // ── Derived lists ───────────────────────────────────────────────────────
  const pendingActivitiesFiltered = activities.filter((a) => {
    const isPending = a.status === 'pending';
    if (isBishop(currentUser)) return isPending && STAKE_CENTER_VENUES.includes(a.location);
    return isPending;
  });
  const pendingCount = pendingActivitiesFiltered.length;

  const myActivities = !isAdmin(currentUser) && !isBishop(currentUser) && !isCommittee(currentUser)
    ? activities.filter((a) => a.user_id === currentUser?.id).sort((a, b) => b.date?.localeCompare(a.date) || 0)
    : [];
  const myPendingCount = myActivities.filter((a) => a.status === 'pending').length;

  // ── Data fetchers ───────────────────────────────────────────────────────
  const fetchActivities = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const year  = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const last  = String(new Date(year, currentDate.getMonth() + 1, 0).getDate()).padStart(2, '0');

    const { data: monthData, error: monthError } = await supabase
      .from('activities').select('*')
      .gte('date', `${year}-${month}-01`)
      .lte('date', `${year}-${month}-${last}`);

    if (monthError) { setLoading(false); return; }
    let combined = monthData || [];
    const ids = new Set(combined.map((a) => a.id));

    // Admins, Bishops & Activity Committee members also fetch ALL pending rows globally
    if (isAdmin(currentUser) || isBishop(currentUser) || isCommittee(currentUser)) {
      const { data: pendingData } = await supabase.from('activities').select('*').eq('status', 'pending');
      if (pendingData) pendingData.forEach((a) => { if (!ids.has(a.id)) { combined.push(a); ids.add(a.id); } });
    }

    // Regular users: approved activities + their own submissions
    if (!isAdmin(currentUser) && !isBishop(currentUser) && !isCommittee(currentUser)) {
      const { data: extraData } = await supabase.from('activities').select('*').or(`status.eq.approved,user_id.eq.${currentUser.id}`);
      if (extraData) extraData.forEach((a) => { if (!ids.has(a.id)) { combined.push(a); ids.add(a.id); } });
    }

    setActivities(combined);
    setLoading(false);
  }, [currentUser, currentDate]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) setUsers(data);
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('audit_logs').select('*')
      .not('action_type', 'in', '("LOGIN","LOGOUT","FORGOT_PASSWORD","SECURITY")')
      .order('created_at', { ascending: false }).limit(200);
    if (!error && data) setAuditLogs(data);
    setLoading(false);
  };

  useEffect(() => { if (currentUser) fetchActivities(); }, [currentUser, currentDate, fetchActivities]);
  useEffect(() => {
    if (!currentUser || !isAdmin(currentUser)) return;
    if (adminTab === 'users') fetchUsers();
    else if (adminTab === 'audit') fetchAuditLogs();
  }, [currentUser, adminTab]);

  // ── Conflict check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActivityModalOpen || isReadOnly || isBishop(currentUser)) return;
    const check = async () => {
      setConflictError('');
      const s = timeToMinutes(activityForm.startTime), e = timeToMinutes(activityForm.endTime);
      if (e <= s) { setConflictError('End time must be after start time.'); return; }
      if (!activityForm.location?.trim()) return;
      let q = supabase.from('activities').select('title,start_time,end_time,location,organization').eq('date', selectedDateStr);
      if (editingActivity) q = q.neq('id', editingActivity.id);
      const { data } = await q;
      if (data) {
        const loc = activityForm.location.trim().toLowerCase();
        const hit = data.find((a) => {
          if ((a.location || '').trim().toLowerCase() !== loc) return false;
          const as = timeToMinutes(a.start_time), ae = timeToMinutes(a.end_time);
          return s < ae && e > as;
        });
        if (hit) setConflictError(`Venue conflict: "${hit.title}" (${hit.organization}) has this space from ${fmt12(hit.start_time)} to ${fmt12(hit.end_time)}.`);
      }
    };
    const timer = setTimeout(check, 400);
    return () => clearTimeout(timer);
  }, [activityForm.startTime, activityForm.endTime, activityForm.location, isActivityModalOpen, selectedDateStr, editingActivity, isReadOnly, currentUser]);

  // ── Email: approval notification with admin/bishop CC ──────────────────
  const sendApprovalEmail = async (activity) => {
    try {
      if (!activity.user_id) {
        showToast('Activity approved, but no email sent (missing user link).', 'error');
        return;
      }

      // Fetch the submitting user's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('email, name').eq('id', activity.user_id).single();

      if (profileError || !profileData?.email) {
        showToast('Activity approved, but recipient email could not be loaded.', 'error');
        return;
      }

      // Fetch admin, Agent Bishop, and Stake Activity Committee emails for CC
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('email')
        .or('is_admin.eq.true,role.eq.Agent Bishop,is_activity_committee.eq.true');

      const ccEmails = (reviewers || [])
        .map((r) => r.email?.trim())
        .filter((e) => e && e !== profileData.email)
        .join(',');

      await emailjs.send(
        'service_5wmibq6',
        'template_o40hi8c',
        {
          to_email:        profileData.email,
          email:           profileData.email,
          user_email:      profileData.email,
          recipient_email: profileData.email,
          to_name:         profileData.name || 'Applicant',
          user_name:       profileData.name || 'Applicant',
          temp_password:   '',
          activity_title:  activity.title,
          organization:    activity.organization || 'General',
          schedule_date:   activity.date,
          schedule_time:   `${fmt12(activity.start_time)} - ${fmt12(activity.end_time)}`,
          venue_location:  activity.location || '',
          approval_signer: currentUser?.name || currentUser?.role || 'Administrator',
          cc_emails:       ccEmails,
          reply_to:        profileData.email,
        },
        'fJih7e_f5TPIx2KU4'
      );

      console.log('Approval email sent via EmailJS to:', profileData.email, '| CC:', ccEmails);
    } catch (err) {
      console.error('Email failure:', err);
      showToast(`Email could not be sent: ${err?.text || err?.message || 'Unknown error'}`, 'error');
    }
  };

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const { data, error } = await supabase.from('profiles').select('*').eq('username', usernameInput).single();
    if (error || !data) { setLoginError('Invalid credentials. Please try again.'); return; }
    const match = await bcrypt.compare(passwordInput, data.password);
    if (!match) { setLoginError('Invalid credentials. Please try again.'); return; }
    localStorage.setItem('supabase_user_session', JSON.stringify(data));
    setCurrentUser(data);
    showToast(`Welcome back, ${data.name}!`);
  };

  const handlePasswordRecovery = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRecoveryResult(null);
    try {
      const { data: user, error } = await supabase.from('profiles').select('*').eq('username', recoveryUser).single();
      if (error || !user) { setLoginError('Account not found.'); return; }
      if (!user.email?.trim()) { setLoginError('Recovery failed: No email address on file. Contact an administrator.'); return; }

      const tempPassword = Math.random().toString(36).slice(-6) + 'A' + Math.floor(Math.random() * 9 + 1) + '!';
      const hashedTemp = await bcrypt.hash(tempPassword, 10);

      const { error: updateError } = await supabase.from('profiles').update({ password: hashedTemp }).eq('id', user.id);
      if (updateError) throw updateError;

      await emailjs.send(
        'service_5wmibq6',
        'template_ftbz95q',
        {
          to_email:        user.email.trim(),
          email:           user.email.trim(),
          user_email:      user.email.trim(),
          recipient_email: user.email.trim(),
          to_name:         user.name || user.username,
          user_name:       user.name || user.username,
          temp_password:   tempPassword,
          activity_title:  'Password Reset Request',
          organization:    '',
          schedule_date:   '',
          schedule_time:   '',
          venue_location:  '',
          approval_signer: 'Talisay Stake Activities',
          cc_emails:       '',
          reply_to:        user.email.trim(),
        },
        'fJih7e_f5TPIx2KU4'
      );

      setRecoveryResult({ success: true, email: user.email });
      showToast('Recovery email sent.');
    } catch (err) {
      const msg = err?.message || err?.text || (typeof err === 'string' ? err : 'Something went wrong.');
      setLoginError(`Recovery failed: ${msg}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('supabase_user_session');
    setCurrentUser(null); setActivities([]); setUsers([]); setAuditLogs([]);
    setUsernameInput(''); setPasswordInput(''); setAuthScreen('login');
  };

  // ── Activity CRUD ────────────────────────────────────────────────────────
  const openActivityModal = (dateStr, activity = null) => {
    setSelectedDateStr(dateStr);
    setConflictError('');
    if (activity) {
      setEditingActivity(activity);
      setActivityForm({
        title:        activity.title || '',
        description:  activity.description || '',
        startTime:    activity.start_time ? activity.start_time.slice(0, 5) : '08:00',
        endTime:      activity.end_time   ? activity.end_time.slice(0, 5)   : '10:00',
        organization: activity.organization || '',
        location:     activity.location || '',
        status:       activity.status || (activity.is_approved ? 'approved' : 'pending'),
        decline_reason: activity.decline_reason || '',
      });
      if (STAKE_CENTER_VENUES.includes(activity.location)) setLocationType('Talisay Stake Center');
      else if (activity.location) setLocationType('Others');
      else setLocationType('');
      setIsReadOnly(isBishop(currentUser) || (!isAdmin(currentUser) && activity.user_id !== currentUser?.id));
    } else {
      setEditingActivity(null);
      setIsReadOnly(false);
      setLocationType('');
      setActivityForm({
        title: '', description: '', startTime: '08:00', endTime: '10:00',
        organization: currentUser?.organization || '',
        location: '', status: isAdmin(currentUser) ? 'approved' : 'pending', decline_reason: '',
      });
    }
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!selectedDateStr) { showToast('Please choose a day on the calendar first.', 'error'); return; }
    const payload = {
      title:       activityForm.title,
      description: activityForm.description || '',
      date:        selectedDateStr,
      start_time:  activityForm.startTime,
      end_time:    activityForm.endTime,
      location:    activityForm.location,
      organization: currentUser?.organization || 'General',
      status:      isAdmin(currentUser) ? 'approved' : 'pending',
      is_approved: isAdmin(currentUser),
      user_id:     currentUser?.id,
    };
    try {
      if (editingActivity) {
        const { error } = await supabase.from('activities').update(payload).eq('id', editingActivity.id);
        if (error) throw error;
        await writeAuditLog(currentUser.id, currentUser.name, 'UPDATE', `Updated activity: "${activityForm.title}"`);
        showToast('Activity updated successfully.');
      } else {
        const { error } = await supabase.from('activities').insert([payload]);
        if (error) throw error;
        await writeAuditLog(currentUser.id, currentUser.name, 'INSERT', `Created activity: "${activityForm.title}"`);
        showToast('Activity submitted for approval.');
        setActivityEmailConfirm(true);
      }
      setIsActivityModalOpen(false);
      fetchActivities();
    } catch (err) {
      showToast(`Submission failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteActivity = async (id) => {
    if (isReadOnly || isBishop(currentUser)) return;
    try {
      await supabase.from('activities').delete().eq('id', id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      await writeAuditLog(currentUser.id, currentUser.name, 'DELETE', `Deleted [${id}]`);
      showToast('Activity deleted.');
      setIsActivityModalOpen(false);
    } catch (err) {
      showToast(`Cannot delete: ${err.message}`, 'error');
    }
  };

  const handleQuickApprove = async (activity) => {
    try {
      const { data: updated, error } = await supabase.from('activities')
        .update({ status: 'approved', is_approved: true })
        .eq('id', activity.id).select().single();
      if (error) throw error;
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? updated : a)));
      await writeAuditLog(currentUser.id, currentUser.name, 'UPDATE', `Approved: "${activity.title}"`);
      await sendApprovalEmail(updated);
      showToast(`"${activity.title}" approved — notification email sent!`);
    } catch (err) {
      showToast(`Approval failed: ${err.message}`, 'error');
    }
  };

  const handleDeclineConfirm = async (reason) => {
    const act = declineTarget;
    setDeclineTarget(null);
    try {
      const { data: updated, error } = await supabase.from('activities')
        .update({ status: 'rejected', is_approved: false, decline_reason: reason })
        .eq('id', act.id).select().single();
      if (error) throw error;
      setActivities((prev) => prev.map((a) => (a.id === act.id ? updated : a)));
      setIsActivityModalOpen(false);
      await writeAuditLog(currentUser.id, currentUser.name, 'UPDATE', `Declined: "${act.title}" — ${reason}`);
      showToast(`"${act.title}" declined.`);
    } catch (err) {
      showToast(`Decline failed: ${err.message}`, 'error');
    }
  };

  // ── User CRUD ────────────────────────────────────────────────────────────
  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({ username: user.username, password: '', name: user.name, calling: user.calling, organization: user.organization, isAdmin: user.is_admin || false, role: user.role || '', email: user.email || '', isActivityCommittee: user.is_activity_committee || false });
    } else {
      setEditingUser(null);
      setUserForm({ username: '', password: '', name: '', calling: '', organization: '', isAdmin: false, role: '', email: '', isActivityCommittee: false });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.email?.trim()) { showToast('Email address is required.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) { showToast('Please enter a valid email address.', 'error'); return; }

    // If editing and password field is blank, keep the existing hashed password
    // If editing and a new password was typed, hash it
    // If creating a new user, password is required and always hashed
    const passwordChanged = editingUser ? userForm.password.trim() !== '' : true;
    if (!editingUser && !userForm.password.trim()) { showToast('Password is required for new users.', 'error'); return; }
    const finalPassword = passwordChanged
      ? await bcrypt.hash(userForm.password, 10)
      : editingUser.password;

    const payload = {
      username: userForm.username, password: finalPassword, name: userForm.name,
      calling: userForm.calling, organization: userForm.organization,
      is_admin: userForm.isAdmin, role: userForm.isAdmin ? '' : userForm.role, email: userForm.email,
      is_activity_committee: userForm.isActivityCommittee,
    };
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
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await supabase.from('profiles').delete().eq('id', id);
      await writeAuditLog(currentUser.id, currentUser.name, 'DELETE', `Deleted profile [${id}]`);
      showToast('User deleted.');
      fetchUsers();
      fetchActivities();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // ── Account settings handlers ────────────────────────────────────────────
  const openAccountModal = () => {
    setPasswordError(''); setUsernameError(''); setEmailError('');
    setAccountTab('password');
    setIsAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsAccountModalOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setUsernameForm({ currentPassword: '', newUsername: '' });
    setEmailForm({ currentPassword: '', newEmail: '' });
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    const match = await bcrypt.compare(passwordForm.currentPassword, currentUser.password);
    if (!match) { setPasswordError('Current password is incorrect.'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    if (passwordForm.newPassword.length < 4) { setPasswordError('Password must be at least 4 characters.'); return; }
    const hashedNew = await bcrypt.hash(passwordForm.newPassword, 10);
    try {
      const { error } = await supabase.from('profiles').update({ password: hashedNew }).eq('id', currentUser.id);
      if (error) throw error;
      const upd = { ...currentUser, password: hashedNew };
      localStorage.setItem('supabase_user_session', JSON.stringify(upd));
      setCurrentUser(upd);
      await writeAuditLog(currentUser.id, currentUser.name, 'SECURITY', 'Password changed.');
      showToast('Password updated.');
      closeAccountModal();
    } catch (err) { setPasswordError(`Update failed: ${err.message}`); }
  };

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    setUsernameError('');
    const match = await bcrypt.compare(usernameForm.currentPassword, currentUser.password);
    if (!match) { setUsernameError('Current password is incorrect.'); return; }
    if (!usernameForm.newUsername.trim()) { setUsernameError('Username cannot be empty.'); return; }
    if (usernameForm.newUsername.trim() === currentUser.username) { setUsernameError('New username is the same as your current one.'); return; }
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', usernameForm.newUsername.trim()).single();
    if (existing) { setUsernameError('That username is already taken.'); return; }
    try {
      const { error } = await supabase.from('profiles').update({ username: usernameForm.newUsername.trim() }).eq('id', currentUser.id);
      if (error) throw error;
      const upd = { ...currentUser, username: usernameForm.newUsername.trim() };
      localStorage.setItem('supabase_user_session', JSON.stringify(upd));
      setCurrentUser(upd);
      await writeAuditLog(currentUser.id, currentUser.name, 'SECURITY', `Username changed to "${usernameForm.newUsername.trim()}".`);
      showToast('Username updated.');
      setUsernameForm({ currentPassword: '', newUsername: '' });
    } catch (err) { setUsernameError(`Update failed: ${err.message}`); }
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    const match = await bcrypt.compare(emailForm.currentPassword, currentUser.password);
    if (!match) { setEmailError('Current password is incorrect.'); return; }
    const trimmed = emailForm.newEmail.trim().toLowerCase();
    if (!trimmed) { setEmailError('Email cannot be empty.'); return; }
    if (trimmed === (currentUser.email || '').toLowerCase()) { setEmailError('New email is the same as your current one.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError('Please enter a valid email address.'); return; }
    try {
      const { error } = await supabase.from('profiles').update({ email: trimmed }).eq('id', currentUser.id);
      if (error) throw error;
      const upd = { ...currentUser, email: trimmed };
      localStorage.setItem('supabase_user_session', JSON.stringify(upd));
      setCurrentUser(upd);
      await writeAuditLog(currentUser.id, currentUser.name, 'SECURITY', `Email changed to "${trimmed}".`);
      showToast('Email updated.');
      setEmailForm({ currentPassword: '', newEmail: '' });
    } catch (err) { setEmailError(`Update failed: ${err.message}`); }
  };

  // ── Analytics ────────────────────────────────────────────────────────────
  const getMetrics = () => {
    const total = activities.length;
    const orgMap = {};
    let totalMins = 0;
    activities.forEach((a) => {
      orgMap[a.organization] = (orgMap[a.organization] || 0) + 1;
      const d = timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
      if (d > 0) totalMins += d;
    });
    return { total, uniqueOrgs: Object.keys(orgMap).length, avgHours: total > 0 ? (totalMins / total / 60).toFixed(1) : 0, orgMap };
  };
  const metrics = getMetrics();

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!currentUser) {
    return (
      <>
        <GlobalStyles t={t} dark={dark} />
        <div className="network-bg" />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: t.text3 }}>{dark ? '🌙' : '☀️'}</span>
            <button className="theme-toggle" onClick={toggleTheme} />
          </div>
          <div style={{ width: '100%', maxWidth: 440 }} className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(99,102,241,.4)', fontSize: 24 }}>⛪</div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text1, marginBottom: 4 }}>Talisay Philippines Stake</h1>
              <p style={{ fontSize: 12, color: t.text3, letterSpacing: '.08em', textTransform: 'uppercase' }}>Calendar of Activities</p>
            </div>
            <div style={{ background: t.surfacePrimary, border: `1px solid ${t.borderAccent}`, borderRadius: 16, padding: 32, backdropFilter: 'blur(16px)', boxShadow: `0 20px 60px rgba(0,0,0,${dark ? '.5' : '.1'})` }}>
              {authScreen === 'login' ? (
                <>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: t.text1 }}>Sign in</h2>
                  <p style={{ fontSize: 13, color: t.text3, marginBottom: 24 }}>Enter your credentials to continue.</p>
                  {loginError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>{loginError}</div>}
                  <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: 16 }}><label>Username</label><input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} required placeholder="your.username" /></div>
                    <div style={{ marginBottom: 24 }}><label>Password</label><input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required placeholder="••••••••" /></div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}>Sign In →</button>
                  </form>
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span onClick={() => { setAuthScreen('forgot'); setLoginError(''); }} style={{ fontSize: 13, color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}>Forgot password?</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: t.text1 }}>Password Recovery</h2>
                  <p style={{ fontSize: 13, color: t.text3, marginBottom: 24 }}>Enter your username and a recovery email will be sent to your registered address.</p>
                  {loginError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>{loginError}</div>}
                  {!recoveryResult ? (
                    <form onSubmit={handlePasswordRecovery}>
                      <div style={{ marginBottom: 20 }}><label>Username</label><input type="text" value={recoveryUser} onChange={(e) => setRecoveryUser(e.target.value)} required placeholder="Enter your username" autoFocus /></div>
                      <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 20, background: dark ? 'rgba(99,102,241,.08)' : '#ede9fe', border: '1px solid rgba(99,102,241,.2)', fontSize: 12, color: '#6366f1' }}>
                        ✉ A reset link will be sent to the email address on your account.
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 18px' }}>Send Recovery Email</button>
                    </form>
                  ) : (
                    <div style={{ padding: 16, borderRadius: 10, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}>
                      <p style={{ fontSize: 13, color: t.text2 }}>A recovery email has been sent to:</p>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginTop: 10, textAlign: 'center' }}>{recoveryResult.email}</div>
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span onClick={() => { setAuthScreen('login'); setRecoveryResult(null); setLoginError(''); }} style={{ fontSize: 13, color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}>← Back to sign in</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN APP SHELL
  // ══════════════════════════════════════════════════════════════════════════
  const tabs = [
    { key: 'dashboard', label: '⬡ Dashboard' },
    { key: 'calendar',  label: '⊞ Calendar'  },
    ...(!isAdmin(currentUser) && !isBishop(currentUser) && !isCommittee(currentUser) ? [{ key: 'myactivities', label: `◉ My Activities${myPendingCount > 0 ? ` (${myPendingCount})` : ''}` }] : []),
    ...(canViewApprovals(currentUser) ? [{ key: 'approvals', label: `✦ Approvals${pendingCount > 0 ? ` (${pendingCount})` : ''}` }] : []),
    ...(isAdmin(currentUser) ? [
      { key: 'users',     label: '◈ Users'     },
      { key: 'analytics', label: '▲ Analytics' },
      { key: 'audit',     label: '☰ Audit Logs'},
    ] : []),
  ];

  const roleBadge = isAdmin(currentUser)
    ? { label: 'ADMIN',      bg: 'rgba(99,102,241,.15)', color: '#6366f1', border: 'rgba(99,102,241,.3)' }
    : isBishop(currentUser)
    ? { label: 'BISHOP',     bg: 'rgba(6,182,212,.15)',  color: '#06b6d4', border: 'rgba(6,182,212,.3)'  }
    : isCommittee(currentUser)
    ? { label: 'COMMITTEE',  bg: 'rgba(245,158,11,.15)', color: '#f59e0b', border: 'rgba(245,158,11,.3)' }
    : null;

  return (
    <>
      <GlobalStyles t={t} dark={dark} />
      <div className="network-bg" />
      <Toast message={feedbackMessage} />

      {declineTarget && (
        <DeclineModal
          activity={declineTarget}
          t={t}
          onConfirm={handleDeclineConfirm}
          onCancel={() => {
            setDeclineTarget(null);
            if (declineTarget.date) openActivityModal(declineTarget.date, declineTarget);
          }}
        />
      )}

      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* ── Header ── */}
        <header style={{ background: t.headerBg, borderBottom: `1px solid ${t.border}`, backdropFilter: 'blur(16px)', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: `0 1px 0 ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 12px rgba(99,102,241,.35)', flexShrink: 0 }}>⛪</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text1, lineHeight: 1 }}>Stake Calendar</div>
              <div style={{ fontSize: 11, color: t.text3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                {currentUser.name}{currentUser.calling ? ` · ${currentUser.calling}` : ''}
                {roleBadge && <span style={{ fontSize: 10, fontWeight: 700, background: roleBadge.bg, color: roleBadge.color, padding: '1px 7px', borderRadius: 20, border: `1px solid ${roleBadge.border}` }}>{roleBadge.label}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: t.text3 }}>{dark ? '🌙' : '☀️'}</span>
            <button className="theme-toggle" onClick={toggleTheme} />
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={openAccountModal}>⚙ Account</button>
            <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        {/* ── Tab bar ── */}
        <div style={{ background: t.tabBg, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 24px', overflowX: 'auto' }}>
            {!navCollapsed && tabs.map((tb) => (
              <button key={tb.key} className={`tab-btn ${adminTab === tb.key ? 'active' : 'inactive'}`} onClick={() => setAdminTab(tb.key)}>{tb.label}</button>
            ))}
            <button
              onClick={() => setNavCollapsed((v) => !v)}
              title={navCollapsed ? 'Show navigation' : 'Hide navigation'}
              style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: `1px solid ${t.border}`, borderRadius: 7, cursor: 'pointer', color: t.text3, padding: '6px 10px', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
            >
              {navCollapsed ? '▾ Show Nav' : '▴ Hide'}
            </button>
          </div>
        </div>

        {/* ── Main content ── */}
        <main style={{ padding: '28px 24px', maxWidth: 1280, margin: '0 auto' }} className="fade-in">
          {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, color: '#6366f1', fontSize: 13 }}><span style={{ animation: 'pulse-dot 1s ease infinite' }}>●</span> Loading…</div>}

          {/* ── Dashboard ── */}
          {adminTab === 'dashboard' && (() => {
            const filtered = (activities || [])
              .filter((a) => {
                if (!a?.date) return false;
                const future = a.date >= todayStr;
                if (canReview(currentUser)) return future;
                return future && a.is_approved === true;
              })
              .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
            const currentYear = currentDate.getFullYear(), currentMonth = currentDate.getMonth();
            const monthFiltered = filtered.filter((a) => { const d = new Date(a.date + 'T00:00:00'); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; });
            return (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1, marginBottom: 4 }}>Upcoming Activities</h2>
                  <p style={{ fontSize: 13, color: t.text3 }}>{canReview(currentUser) ? 'All upcoming activities this month.' : 'Approved activities visible to members.'}</p>
                </div>
                {monthFiltered.length === 0 ? (
                  <div style={{ padding: '60px 40px', textAlign: 'center', background: t.surfaceCard, borderRadius: 14, border: `1px dashed ${t.emptyBorder}`, color: t.emptyColor, fontSize: 14 }}>📭 No upcoming activities for this month.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {monthFiltered.map((act) => <ActivityCard key={act.id} act={act} dark={dark} t={t} onClick={() => openActivityModal(act.date, act)} />)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Calendar ── */}
          {adminTab === 'calendar' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>← Prev</button>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: t.text1 }}>{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <button className="btn btn-ghost" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Next →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: t.text3, letterSpacing: '.06em', textTransform: 'uppercase', padding: '8px 0' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                {calendarDays.map((item, idx) => {
                  if (!item) return <div key={`e-${idx}`} style={{ minHeight: 110 }} />;
                  const isToday = item.dateString === todayStr;
                  const dayActs = (activities || []).filter((a) => {
                    const match = a?.date === item.dateString;
                    return canReview(currentUser) ? match : match && a.is_approved === true;
                  });
                  return (
                    <div key={item.dateString} className={`calendar-cell${isToday ? ' today' : ''}`} onClick={() => openActivityModal(item.dateString, null)}>
                      <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12, fontWeight: 600, marginBottom: 4, background: isToday ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'transparent', color: isToday ? '#fff' : t.text2 }}>{item.day}</span>
                      <div>
                        {dayActs.map((act) => {
                          const p = getOrgColors(act.organization, dark);
                          return (
                            <div key={act.id} className="activity-pill" onClick={(e) => { e.stopPropagation(); openActivityModal(item.dateString, act); }} style={{ background: p.bg, color: p.text, borderLeft: `3px solid ${p.border}` }}>
                              <div style={{ fontSize: 9, fontWeight: 700, opacity: .8, marginBottom: 1 }}>{fmt12(act.start_time)}</div>
                              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{act.title}</div>
                              {act.location && <div style={{ fontSize: 9, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {act.location}</div>}
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

          {/* ── My Activities ── */}
          {adminTab === 'myactivities' && !isAdmin(currentUser) && !isBishop(currentUser) && (() => {
            const sections = [
              { title: '⏳ Pending Review', color: '#f59e0b', items: myActivities.filter((a) => a.status === 'pending'),                          emptyMsg: 'No activities awaiting review.' },
              { title: '✓ Approved',        color: '#10b981', items: myActivities.filter((a) => a.status === 'approved' || a.is_approved === true), emptyMsg: 'No approved activities yet.'   },
              { title: '✕ Declined',        color: '#ef4444', items: myActivities.filter((a) => a.status === 'rejected'),                          emptyMsg: 'No declined activities.'       },
            ];
            return (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1, marginBottom: 4 }}>My Submitted Activities</h2>
                  <p style={{ fontSize: 13, color: t.text3 }}>Track your submitted item review statuses.</p>
                </div>
                {sections.map(({ title, color, items, emptyMsg }) => (
                  <div key={title} style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 12 }}>{title} <span style={{ fontSize: 13, fontWeight: 500, color: t.text3 }}>({items.length})</span></h3>
                    {items.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', background: t.surfaceCard, borderRadius: 10, border: `1px dashed ${t.emptyBorder}`, color: t.emptyColor, fontSize: 13 }}>{emptyMsg}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {items.map((act) => <ActivityCard key={act.id} act={act} dark={dark} t={t} onClick={() => openActivityModal(act.date, act)} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Approvals ── */}
          {adminTab === 'approvals' && canViewApprovals(currentUser) && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1, marginBottom: 4 }}>Pending Approvals ({pendingCount})</h2>
                <p style={{ fontSize: 13, color: t.text3 }}>
                  {isBishop(currentUser) ? 'Review facility requests inside Talisay Stake Center.'
                    : isCommittee(currentUser) ? 'Activities pending approval — committee view only.'
                    : 'Activities pending approval.'}
                </p>
              </div>
              {pendingActivitiesFiltered.length === 0 ? (
                <div style={{ padding: '60px 40px', textAlign: 'center', background: t.surfaceCard, borderRadius: 14, border: `1px dashed ${t.emptyBorder}`, color: t.emptyColor, fontSize: 14 }}>🎉 No pending requests to evaluate.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pendingActivitiesFiltered.map((act) => {
                    const p = getOrgColors(act.organization, dark);
                    const d = new Date(act.date + 'T00:00:00');
                    return (
                      <div key={act.id} className="approval-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div style={{ display: 'flex' }}>
                          <div style={{ minWidth: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', background: t.pendingDateBg, borderRight: `1px solid ${t.border}` }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span style={{ fontSize: 28, fontWeight: 800, color: t.text1, lineHeight: 1 }}>{d.getDate()}</span>
                            <span style={{ fontSize: 10, color: t.text3 }}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                          </div>
                          <div style={{ padding: '16px 20px', flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}`, padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{act.organization || 'General'}</span>
                              <h4 style={{ fontSize: 15, fontWeight: 700, color: t.text1, margin: '7px 0 5px' }}>{act.title}</h4>
                              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: t.text2 }}>
                                <span>⏰ {fmt12(act.start_time)} – {fmt12(act.end_time)}</span>
                                {act.location && <span style={{ color: '#6366f1' }}>📍 {act.location}</span>}
                              </div>
                              {act.description && <p style={{ margin: '5px 0 0', fontSize: 12, color: t.text3, fontStyle: 'italic' }}>"{act.description}"</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {canReview(currentUser) && (
                                <>
                                  <button className="btn btn-success" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => handleQuickApprove(act)}>✓ Approve</button>
                                  <button className="btn btn-danger"  style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => setDeclineTarget(act)}>✕ Decline</button>
                                </>
                              )}
                              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => openActivityModal(act.date, act)}>
                                View Info
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Users ── */}
          {adminTab === 'users' && isAdmin(currentUser) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1 }}>User Management</h2>
                <button className="btn btn-success" onClick={() => openUserModal()}>+ Add User</button>
              </div>
              <div style={{ background: t.sectionBg, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Username</th><th>Calling</th><th>Organization</th><th>Role</th><th>Actions</th></tr></thead>
                  <tbody>
                    {[...users].sort((a, b) => (a.calling || '').localeCompare(b.calling || '')).map((u) => (
                      <tr key={u.id}>
                        <td style={{ color: t.text1, fontWeight: 600 }}>{u.name}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{u.username}</td>
                        <td>{u.calling || <span style={{ color: t.text3 }}>—</span>}</td>
                        <td>{u.organization || <span style={{ color: t.text3 }}>—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {u.is_admin
                            ? <span className="badge" style={{ background: 'rgba(99,102,241,.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,.3)' }}>Admin</span>
                            : u.role === 'Agent Bishop'
                            ? <span className="badge" style={{ background: 'rgba(6,182,212,.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,.3)' }}>Approving Bishop</span>
                            : <span className="badge" style={{ background: dark ? 'rgba(30,41,59,.8)' : '#f1f5f9', color: t.text3, border: `1px solid ${t.border}` }}>Member</span>
                          }
                          {u.is_activity_committee && (
                            <span className="badge" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>⭐ Committee</span>
                          )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openUserModal(u)}>Edit</button>
                            {u.username !== 'admin' && <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleDeleteUser(u.id)}>Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Analytics ── */}
          {adminTab === 'analytics' && isAdmin(currentUser) && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1, marginBottom: 4 }}>Analytics</h2>
                <p style={{ fontSize: 13, color: t.text3 }}>Metrics for {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
                {[
                  { value: metrics.total,            label: 'Total Activities',     icon: '◎' },
                  { value: metrics.uniqueOrgs,        label: 'Active Organizations', icon: '◈' },
                  { value: `${metrics.avgHours}h`,    label: 'Avg Duration',         icon: '⧗' },
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#6366f1', lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: t.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text1, marginBottom: 20 }}>Activity by Organization</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(metrics.orgMap).map(([org, count]) => {
                    const pct = metrics.total ? ((count / metrics.total) * 100).toFixed(1) : 0;
                    const p = getOrgColors(org, dark);
                    return (
                      <div key={org} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 160, fontSize: 13, fontWeight: 600, color: t.text1, flexShrink: 0 }}>{org}</div>
                        <div style={{ flexGrow: 1 }}><div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${p.border},${p.text})` }} /></div></div>
                        <div style={{ width: 80, fontSize: 12, color: t.text3, textAlign: 'right', flexShrink: 0 }}>{count} ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Logs ── */}
          {adminTab === 'audit' && isAdmin(currentUser) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text1 }}>Audit Logs</h2>
                <button className="btn btn-ghost" onClick={fetchAuditLogs}>↻ Refresh</button>
              </div>
              <div style={{ background: t.sectionBg, borderRadius: 12, border: `1px solid ${t.border}`, overflow: 'hidden', maxHeight: 560, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Timestamp</th><th>Operator</th><th>Action</th><th>Description</th></tr></thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="mono" style={{ fontSize: 11, color: t.text3, whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: t.text1 }}>{log.operator_name}</td>
                        <td>
                          <span className="audit-badge" style={{
                            background: log.action_type === 'DELETE' ? 'rgba(239,68,68,.15)' : log.action_type === 'INSERT' ? 'rgba(16,185,129,.15)' : log.action_type === 'UPDATE' ? 'rgba(245,158,11,.15)' : 'rgba(99,102,241,.15)',
                            color:      log.action_type === 'DELETE' ? '#ef4444'              : log.action_type === 'INSERT' ? '#10b981'               : log.action_type === 'UPDATE' ? '#f59e0b'              : '#6366f1',
                          }}>{log.action_type}</span>
                        </td>
                        <td style={{ fontSize: 12, color: t.text2 }}>{log.target_context}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════ MODALS ═══════════════════════════ */}

      {/* ── Activity Modal ── */}
      {isActivityModalOpen && (
        <div className="modal-overlay" onClick={() => setIsActivityModalOpen(false)}>
          <div className="modal-card slide-up" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text1 }}>
                {editingActivity ? (isReadOnly ? '📋 Activity Review Panel' : '✎ Edit Activity') : '+ New Activity'}
              </h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isReadOnly && (
                  <span className="badge" style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)', fontSize: 10 }}>
                    {isBishop(currentUser) ? 'BISHOP REVIEW' : 'READ ONLY'}
                  </span>
                )}
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }} onClick={() => setIsActivityModalOpen(false)}>✕</button>
              </div>
            </div>

            {conflictError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>⚠ {conflictError}</div>}
            {editingActivity?.status === 'rejected' && editingActivity.decline_reason && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 13, color: '#ef4444' }}>
                <strong>✕ Declined:</strong> {editingActivity.decline_reason}
              </div>
            )}

            <form onSubmit={handleSaveActivity}>
              <div style={{ marginBottom: 14 }}><label>Activity Title</label><input type="text" value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} required disabled={isReadOnly} placeholder="Title" /></div>
              <div style={{ marginBottom: 14 }}><label>Description</label><textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} disabled={isReadOnly} style={{ height: 70, resize: 'none' }} placeholder="Description text context..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label>Start Time</label><input type="time" value={activityForm.startTime} onChange={(e) => setActivityForm({ ...activityForm, startTime: e.target.value })} required disabled={isReadOnly} /></div>
                <div><label>End Time</label><input type="time" value={activityForm.endTime} onChange={(e) => setActivityForm({ ...activityForm, endTime: e.target.value })} required disabled={isReadOnly} /></div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label>Location Classification</label>
                <select value={locationType} onChange={(e) => { setLocationType(e.target.value); setActivityForm((prev) => ({ ...prev, location: '' })); }} disabled={isReadOnly} required>
                  <option value="" disabled hidden>Choose Classification...</option>
                  <option value="Talisay Stake Center">Talisay Stake Center</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              {locationType === 'Talisay Stake Center' && (
                <div style={{ marginBottom: 14, animation: 'fadeIn .2s ease' }}>
                  <label>Stake Center Facility Room</label>
                  <select value={STAKE_CENTER_VENUES.includes(activityForm.location) ? activityForm.location : ''} onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })} disabled={isReadOnly} required>
                    <option value="" disabled hidden>Select Facility...</option>
                    {STAKE_CENTER_VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}

              {locationType === 'Others' && (
                <div style={{ marginBottom: 14, animation: 'fadeIn .2s ease' }}>
                  <label>Venue / Custom Location Address</label>
                  <input type="text" placeholder="Enter custom location details..." value={activityForm.location} onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })} disabled={isReadOnly} required />
                </div>
              )}

              <div style={{ marginBottom: 14 }}><label>Organization</label><input type="text" value={activityForm.organization} disabled /></div>
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: dark ? 'rgba(99,102,241,.08)' : '#ede9fe', border: '1px solid rgba(99,102,241,.2)', fontSize: 13, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 8 }}>
                ⧗ Duration: <strong>{calcDuration(activityForm.startTime, activityForm.endTime)}</strong>
              </div>

              {canReview(currentUser) && (
                <div style={{ marginBottom: 20 }}>
                  <label>Action Controls</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: 'approved', label: '✓ Approve Activity', cls: 'btn-success' },
                      { val: 'rejected', label: '✕ Decline Activity', cls: 'btn-danger'  },
                    ].map((opt) => (
                      <button key={opt.val} type="button"
                        className={`btn ${activityForm.status === opt.val ? opt.cls : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '8px 16px', flex: 1, opacity: activityForm.status === opt.val ? 1 : .6 }}
                        onClick={() => {
                          if (opt.val === 'rejected' && editingActivity) { setDeclineTarget(editingActivity); setIsActivityModalOpen(false); }
                          else setActivityForm({ ...activityForm, status: opt.val });
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {editingActivity && !isReadOnly && !isBishop(currentUser) && (
                    <button type="button" className="btn btn-danger" onClick={() => handleDeleteActivity(editingActivity.id)}>Delete</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!isReadOnly && !isBishop(currentUser) && !editingActivity && (
                    <div
                      onClick={() => setActivityEmailConfirm((v) => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${activityEmailConfirm ? 'rgba(99,102,241,.35)' : t.border}`, background: activityEmailConfirm ? (dark ? 'rgba(99,102,241,.1)' : '#ede9fe') : 'transparent', transition: 'all .2s', userSelect: 'none' }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${activityEmailConfirm ? '#6366f1' : t.text3}`, background: activityEmailConfirm ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
                        {activityEmailConfirm && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 12, color: activityEmailConfirm ? '#6366f1' : t.text3, fontWeight: 500 }}>Email me on approval</span>
                    </div>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => setIsActivityModalOpen(false)}>
                    {isReadOnly ? 'Close' : 'Cancel'}
                  </button>
                  {!isReadOnly && !isBishop(currentUser) && (
                    <button type="submit" className="btn btn-success" disabled={conflictError.startsWith('Venue conflict')}>Save Activity</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── User Modal ── */}
      {isUserModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUserModalOpen(false)}>
          <div className="modal-card slide-up" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text1 }}>{editingUser ? '✎ Edit User' : '+ New User'}</h3>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }} onClick={() => setIsUserModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label>Full Name</label><input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required /></div>
                <div><label>Calling</label><input type="text" value={userForm.calling} onChange={(e) => setUserForm({ ...userForm, calling: e.target.value })} required /></div>
              </div>
              <div style={{ marginBottom: 14 }}><label>Organization</label><input type="text" value={userForm.organization} onChange={(e) => setUserForm({ ...userForm, organization: e.target.value })} required /></div>
              <div style={{ height: 1, background: t.divider, marginBottom: 14 }} />
              <div style={{ marginBottom: 14 }}><label>Email Address</label><input type="email" placeholder="user@example.com" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div><label>Username</label><input type="text" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required disabled={editingUser?.username === 'admin'} /></div>
                <div><label>Password:</label><input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required={!editingUser} placeholder={editingUser ? 'Leave blank to keep unchanged' : 'Set password'} /></div>
              </div>
              {editingUser?.username !== 'admin' ? (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ marginBottom: 10 }}>Role / Access Level</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { val: '',            label: 'Member',        desc: 'Submit activities and monitor individual requests.', bg: 'rgba(148,163,184,.1)', color: t.text2,   border: t.border },
                      { val: 'Agent Bishop',label: 'Agent Bishop',  desc: 'Approve and decline activities under Stake Center.',  bg: 'rgba(6,182,212,.1)',   color: '#06b6d4', border: 'rgba(6,182,212,.3)'  },
                      { val: '__admin__',   label: 'Administrator', desc: 'Full system superuser configuration.',                bg: 'rgba(99,102,241,.1)',  color: '#6366f1', border: 'rgba(99,102,241,.3)' },
                    ].map((opt) => {
                      const selected = opt.val === '__admin__' ? userForm.isAdmin : (!userForm.isAdmin && userForm.role === opt.val);
                      return (
                        <div key={opt.val} onClick={() => { if (opt.val === '__admin__') setUserForm({ ...userForm, isAdmin: true, role: '' }); else setUserForm({ ...userForm, isAdmin: false, role: opt.val }); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: selected ? opt.bg : 'transparent', border: `1px solid ${selected ? opt.border : t.border}` }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${selected ? opt.color : t.text3}`, background: selected ? opt.color : 'transparent' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: selected ? opt.color : t.text1 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{opt.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: t.text3, fontStyle: 'italic', marginBottom: 20 }}>Root admin privileges locked.</p>
              )}

              {/* ── Stake Activity Committee ── */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ marginBottom: 8 }}>Committee Membership</label>
                <div
                  onClick={() => setUserForm({ ...userForm, isActivityCommittee: !userForm.isActivityCommittee })}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${userForm.isActivityCommittee ? 'rgba(245,158,11,.4)' : t.border}`, background: userForm.isActivityCommittee ? (dark ? 'rgba(245,158,11,.08)' : '#fffbeb') : 'transparent', transition: 'all .2s', userSelect: 'none' }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${userForm.isActivityCommittee ? '#f59e0b' : t.text3}`, background: userForm.isActivityCommittee ? '#f59e0b' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all .2s' }}>
                    {userForm.isActivityCommittee && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: userForm.isActivityCommittee ? '#f59e0b' : t.text1 }}>Stake Activity Committee Member</div>
                    <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>This person will be CC'd on all activity approval confirmation emails and can view pending approvals.</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsUserModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Account Settings Modal ── */}
      {isAccountModalOpen && (
        <div className="modal-overlay" onClick={closeAccountModal}>
          <div className="modal-card slide-up" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text1 }}>⚙ Account Settings</h3>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 16 }} onClick={closeAccountModal}>✕</button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: `1px solid ${t.divider}`, paddingBottom: 12 }}>
              {[{ key: 'password', icon: '🔑', label: 'Password' }, { key: 'username', icon: '◈', label: 'Username' }, { key: 'email', icon: '✉', label: 'Email' }].map((tab) => (
                <button key={tab.key} type="button" className={`tab-btn ${accountTab === tab.key ? 'active' : 'inactive'}`} style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={() => { setAccountTab(tab.key); setPasswordError(''); setUsernameError(''); setEmailError(''); }}
                >{tab.icon} {tab.label}</button>
              ))}
            </div>

            {/* Password tab */}
            {accountTab === 'password' && (() => {
              const pw = passwordForm.newPassword;
              const checks = [
                { label: '8+ characters',    pass: pw.length >= 8 },
                { label: 'Uppercase letter', pass: /[A-Z]/.test(pw) },
                { label: 'Lowercase letter', pass: /[a-z]/.test(pw) },
                { label: 'Number',           pass: /[0-9]/.test(pw) },
                { label: 'Special char',     pass: /[^A-Za-z0-9]/.test(pw) },
              ];
              const strength = checks.filter((c) => c.pass).length;
              const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength];
              const strengthColor = ['', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#6366f1'][strength];
              return (
                <>
                  {passwordError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>⚠ {passwordError}</div>}
                  <form onSubmit={handleUpdatePassword}>
                    <div style={{ marginBottom: 14 }}>
                      <label>Current Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showCurrentPw ? 'text' : 'password'} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required style={{ paddingRight: 42 }} />
                        <button type="button" onClick={() => setShowCurrentPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.text3, fontSize: 16, lineHeight: 1, padding: 0 }}>{showCurrentPw ? '🙈' : '👁'}</button>
                      </div>
                    </div>
                    <div style={{ height: 1, background: t.divider, marginBottom: 14 }} />
                    <div style={{ marginBottom: 6 }}>
                      <label>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showNewPw ? 'text' : 'password'} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required style={{ paddingRight: 42 }} />
                        <button type="button" onClick={() => setShowNewPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.text3, fontSize: 16, lineHeight: 1, padding: 0 }}>{showNewPw ? '🙈' : '👁'}</button>
                      </div>
                    </div>
                    {pw.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= strength ? strengthColor : (dark ? 'rgba(148,163,184,.2)' : '#e2e8f0'), transition: 'background .3s' }} />)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                            {checks.map((c) => (
                              <span key={c.label} style={{ fontSize: 11, color: c.pass ? '#10b981' : t.text3, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <span>{c.pass ? '✓' : '○'}</span>{c.label}
                              </span>
                            ))}
                          </div>
                          {strengthLabel && <span style={{ fontSize: 11, fontWeight: 700, color: strengthColor, flexShrink: 0, marginLeft: 8 }}>{strengthLabel}</span>}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 20 }}>
                      <label>Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showConfirmPw ? 'text' : 'password'} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required style={{ paddingRight: 42 }} />
                        <button type="button" onClick={() => setShowConfirmPw((v) => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.text3, fontSize: 16, lineHeight: 1, padding: 0 }}>{showConfirmPw ? '🙈' : '👁'}</button>
                      </div>
                      {passwordForm.confirmPassword.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: passwordForm.newPassword === passwordForm.confirmPassword ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {passwordForm.newPassword === passwordForm.confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost" onClick={closeAccountModal}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={strength < 2 || passwordForm.newPassword !== passwordForm.confirmPassword}>Update Password</button>
                    </div>
                  </form>
                </>
              );
            })()}

            {/* Username tab */}
            {accountTab === 'username' && (
              <>
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: dark ? 'rgba(99,102,241,.08)' : '#ede9fe', border: '1px solid rgba(99,102,241,.2)', fontSize: 13, color: '#6366f1' }}>
                  Current username: <strong>{currentUser.username}</strong>
                </div>
                {usernameError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>⚠ {usernameError}</div>}
                <form onSubmit={handleUpdateUsername}>
                  <div style={{ marginBottom: 14 }}><label>New Username</label><input type="text" value={usernameForm.newUsername} onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value })} required placeholder="new.username" autoComplete="off" /></div>
                  <div style={{ height: 1, background: t.divider, marginBottom: 14 }} />
                  <div style={{ marginBottom: 20 }}><label>Confirm with Password</label><input type="password" value={usernameForm.currentPassword} onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })} required placeholder="Enter your password to confirm" /></div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={closeAccountModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Update Username</button>
                  </div>
                </form>
              </>
            )}

            {/* Email tab */}
            {accountTab === 'email' && (
              <>
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: dark ? 'rgba(99,102,241,.08)' : '#ede9fe', border: '1px solid rgba(99,102,241,.2)', fontSize: 13, color: '#6366f1' }}>
                  Current email: <strong>{currentUser.email || <span style={{ fontStyle: 'italic', opacity: .6 }}>not set</span>}</strong>
                </div>
                {emailError && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', fontSize: 13 }}>⚠ {emailError}</div>}
                <form onSubmit={handleUpdateEmail}>
                  <div style={{ marginBottom: 14 }}><label>New Email Address</label><input type="email" value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} required placeholder="you@example.com" /></div>
                  <div style={{ height: 1, background: t.divider, marginBottom: 14 }} />
                  <div style={{ marginBottom: 20 }}><label>Confirm with Password</label><input type="password" value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} required placeholder="Enter your password to confirm" /></div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={closeAccountModal}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Update Email</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}