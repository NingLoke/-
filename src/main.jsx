import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bot, Check, ChevronLeft, CirclePause, CirclePlay, Ellipsis,
  Headphones, ImagePlus, Library, LockKeyhole, MessageCircleMore, Music2,
  Pause, Play, Plus, Send, ShieldCheck, SkipBack, SkipForward, Sparkles,
  Trash2, Upload, UserRoundPlus, Volume2, X,
} from 'lucide-react';
import { loadState, resetState, saveState } from './storage.js';
import { makeDemoReply, parseChatRecord } from './parser.js';
import { extractImportText } from './archive.js';
import { checkAiConnection, requestAiReply } from './api.js';
import { buildPersonaPayload } from './persona.js';
import './styles.css';

const id = () => globalThis.crypto?.randomUUID?.() ?? `echo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const DEFAULT_STATE = { people: [], messages: {}, tracks: [], selectedId: null };
const savedAgeConfirmation = () => { try { return sessionStorage.getItem('echo-age-confirmed') === 'true'; } catch { return false; } };

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Echo UI error', error, info); }
  async reset() {
    try { await resetState(); } finally { window.location.reload(); }
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="recovery-page">
      <div className="recovery-card"><div className="logo-mark">回</div><h1>页面遇到了一点问题</h1><p>你的页面没有消失。通常是旧版浏览器数据与新版不兼容，可以先重新加载；如果仍然出现，再清除本设备上的回声数据。</p><div className="recovery-actions"><button className="button secondary" onClick={() => window.location.reload()}>重新加载</button><button className="button danger" onClick={() => this.reset()}>清除本地数据并恢复</button></div><small>{this.state.error?.message}</small></div>
    </main>;
  }
}

function readFile(file, mode = 'dataURL') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    mode === 'text' ? reader.readAsText(file) : reader.readAsDataURL(file);
  });
}

function Avatar({ person, large = false }) {
  return person?.avatar
    ? <img className={`avatar ${large ? 'avatar-large' : ''}`} src={person.avatar} alt="" />
    : <div className={`avatar avatar-fallback ${large ? 'avatar-large' : ''}`}>{person?.name?.slice(0, 1) || 'AI'}</div>;
}

function Modal({ children, onClose }) {
  return <div className="modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal-card">{children}</div>
  </div>;
}

function AgeGate({ onConfirm }) {
  const [checked, setChecked] = useState(false);
  return <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-title"><div className="age-card"><div className="age-mark">18+</div><div className="eyebrow">进入前确认</div><h1 id="age-title">请确认你的年龄</h1><p>本网站的真实 AI 可以讨论成熟、敏感或有争议的话题，并可能进行实时联网搜索。角色始终彼此隔离，但 AI 输出仍可能有误。</p><label className="age-check"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span><strong>我确认已满 18 岁</strong><small>我理解年龄确认不代表可以进行违法、有害或违反服务规则的使用。</small></span></label><button className="button primary full" disabled={!checked} onClick={onConfirm}>确认并进入</button><small className="age-note">这是年龄自我确认，不是身份认证；本站不会收集身份证件。</small></div></div>;
}

function NewPersonModal({ initial, onClose, onSave, onDelete }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [speaker, setSpeaker] = useState(initial?.speaker ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? '');
  const [fileName, setFileName] = useState('');
  const [raw, setRaw] = useState('');
  const [importMeta, setImportMeta] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  async function avatarChange(event) {
    const file = event.target.files?.[0];
    if (file) setAvatar(await readFile(file));
  }
  async function chatChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportError('');
    setImporting(true);
    try {
      const result = await extractImportText(file);
      setRaw(result.text);
      setImportMeta(result);
    } catch (error) {
      setRaw('');
      setImportMeta(null);
      setImportError(error.message);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }
  const parsed = raw ? parseChatRecord(raw, speaker) : initial?.samples ?? [];

  return <Modal onClose={onClose}>
    <button className="icon-button modal-close" onClick={onClose} aria-label="关闭"><X size={19} /></button>
    <div className="eyebrow"><Sparkles size={14} /> 建立风格档案</div>
    <h2>{initial ? '编辑对话对象' : '新增对话对象'}</h2>
    <p className="muted modal-intro">资料只保存在此浏览器。AI 学习的是表达风格，不是本人身份。</p>
    <div className="profile-row">
      <label className="avatar-picker">
        {avatar ? <img src={avatar} alt="头像预览" /> : <UserRoundPlus />}
        <input type="file" accept="image/*" onChange={avatarChange} hidden />
        <span>上传头像</span>
      </label>
      <div className="form-stack grow">
        <label>显示名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：小雨" /></label>
        <label>聊天记录中的称呼 <small>可选，用于筛选</small><input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="例如：小雨" /></label>
      </div>
    </div>
    <label className="drop-zone">
      <Upload size={22} />
      <span>{importing ? '正在本地解压与读取…' : fileName || (initial?.samples?.length ? `已保存 ${initial.samples.length} 条语言样本` : '导入聊天记录或 ZIP')}</span>
      <small>支持最大 200 MB 的 ZIP、TXT、LOG、JSON、CSV；ZIP 全程在浏览器本地解压</small>
      <input type="file" accept=".zip,.txt,.log,.json,.csv,.md,application/zip,text/plain,application/json,text/csv" onChange={chatChange} hidden disabled={importing} />
    </label>
    {raw && <div className="parse-result"><Check size={15} /> 已从 {importMeta?.files.length ?? 1} 个文件识别 {parsed.length} 条“{speaker || '全部参与者'}”的语言样本{importMeta?.skipped ? `，忽略 ${importMeta.skipped} 个非聊天文件` : ''}</div>}
    {importError && <div className="parse-result parse-error"><X size={15} /> {importError}</div>}
    <div className="modal-actions">
      {initial && <button className="button danger" onClick={onDelete}><Trash2 size={15} /> 删除</button>}
      <span className="action-spacer" />
      <button className="button secondary" onClick={onClose}>取消</button>
      <button className="button primary" disabled={!name.trim()} onClick={() => onSave({ ...initial, id: initial?.id ?? id(), name: name.trim(), speaker: speaker.trim(), avatar, samples: raw ? parsed : (initial?.samples ?? []) })}>保存并开始对话</button>
    </div>
  </Modal>;
}

function PrivacyModal({ enabled, ageConfirmed, aiState, onClose, onChange, onRefresh }) {
  const connected = aiState.status === 'connected';
  return <Modal onClose={onClose}>
    <button className="icon-button modal-close" onClick={onClose}><X size={19} /></button>
    <div className="privacy-mark"><ShieldCheck /></div>
    <h2>AI 模式与隐私</h2>
    <p className="muted modal-intro">“角色隔离”和“回答方式”是两件事：角色始终互相隔离；你可以另外选择使用规则演示或真实 AI 回答。</p>
    <div className="mode-card active"><div className="mode-number"><LockKeyhole size={15} /></div><div><strong>角色隔离</strong><span className="status-pill local">始终开启</span><p>每个角色拥有独立的语言样本、聊天记录、图片和上下文。向 AI 提问时只会组装当前角色的数据，不读取或混入其他角色。</p></div></div>
    <div className="mode-card active"><div className="mode-number">A</div><div><strong>规则演示回答</strong><span className="status-pill local">当前可用</span><p>不调用大模型，不上传聊天内容；只用简单本地规则生成短回复，用于体验界面，不代表真正的智能回答。</p></div></div>
    <div className={`mode-card ${connected ? 'connected' : 'unavailable'}`}><div className="mode-number">B</div><div><strong>真实 AI 回答</strong><span className={`status-pill ${aiState.status}`}>{aiState.label}</span><p>{connected ? '已启用实时联网能力；模型会在问题需要最新资料时搜索网页，并在回复下方列出来源。每次只发送当前角色的必要上下文。' : 'GitHub Pages 只托管网页前端。真实 AI 需要单独部署项目中的 server，并配置 VITE_API_BASE_URL；API 密钥不能放进网页。'}</p><div className="capability-row"><span><Check size={12} /> 18+ 已确认</span><span><Check size={12} /> 实时联网</span><span><Check size={12} /> 角色隔离</span></div>{!connected && <button className="text-button" onClick={onRefresh}>重新检查连接</button>}</div>
      <button className={`toggle ${enabled ? 'on' : ''}`} disabled={!connected || !ageConfirmed} onClick={() => onChange(!enabled)} aria-label="切换真实 AI"><span /></button>
    </div>
    <p className="fine-print"><LockKeyhole size={14} /> 请只导入你有权使用的聊天内容，并尊重对方隐私。</p>
    <button className="button primary full" onClick={onClose}>了解</button>
  </Modal>;
}

function MusicPlayer({ tracks, setTracks }) {
  const audio = useRef(null);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const track = tracks[current];

  useEffect(() => {
    audio.current = new Audio();
    return () => { audio.current?.pause(); audio.current = null; };
  }, []);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    if (!track) { player.pause(); setProgress(0); return; }
    player.src = track.data;
    if (playing) player.play().catch(() => setPlaying(false));
  }, [current, track?.id]);
  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    const tick = () => setProgress(player.duration ? player.currentTime / player.duration * 100 : 0);
    const ended = () => setCurrent((value) => tracks.length ? (value + 1) % tracks.length : 0);
    player.addEventListener('timeupdate', tick); player.addEventListener('ended', ended);
    return () => { player.removeEventListener('timeupdate', tick); player.removeEventListener('ended', ended); };
  }, [tracks.length]);
  useEffect(() => { if (current >= tracks.length) setCurrent(Math.max(0, tracks.length - 1)); }, [current, tracks.length]);

  async function addTracks(event) {
    const files = [...(event.target.files ?? [])];
    const added = await Promise.all(files.map(async (file) => ({ id: id(), name: file.name.replace(/\.[^.]+$/, ''), data: await readFile(file), type: file.type })));
    setTracks((value) => [...value, ...added]);
  }
  function toggle() {
    if (!track || !audio.current) return;
    if (playing) audio.current.pause(); else audio.current.play();
    setPlaying(!playing);
  }

  return <section className="music-panel">
    <div className="section-title"><span><Headphones size={17} /> 本地播放列表</span><label className="mini-add"><Plus size={16} /><input hidden type="file" accept="audio/*" multiple onChange={addTracks} /></label></div>
    {track ? <>
      <div className="now-playing"><div className="album-art"><Music2 /></div><div className="track-copy"><strong>{track.name}</strong><span>来自本地设备</span></div><button className="icon-button" onClick={() => setTracks((all) => all.filter((item) => item.id !== track.id))}><Trash2 size={15} /></button></div>
      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="player-controls"><button onClick={() => setCurrent((current - 1 + tracks.length) % tracks.length)}><SkipBack /></button><button className="play-button" onClick={toggle}>{playing ? <Pause /> : <Play />}</button><button onClick={() => setCurrent((current + 1) % tracks.length)}><SkipForward /></button></div>
      {tracks.length > 1 && <div className="track-list">{tracks.map((item, index) => <button className={index === current ? 'active' : ''} onClick={() => setCurrent(index)} key={item.id}><Music2 size={13} /><span>{item.name}</span>{index === current && (playing ? <CirclePause size={14} /> : <CirclePlay size={14} />)}</button>)}</div>}
    </> : <label className="empty-music"><Music2 /><span>把你的音乐带进来</span><small>MP3、WAV、M4A 等本地音频</small><input hidden type="file" accept="audio/*" multiple onChange={addTracks} /></label>}
  </section>;
}

function EmptyChat({ onAdd }) {
  return <main className="empty-chat"><div className="orb"><MessageCircleMore /></div><div className="eyebrow">私人 · 本地优先</div><h1>让熟悉的表达方式，<br />陪你继续聊下去。</h1><p>导入一段聊天记录，建立一个明确标示为 AI 的风格模拟对话。</p><button className="button primary" onClick={onAdd}><Plus size={18} /> 新增第一个对话对象</button><div className="trust-row"><span><LockKeyhole /> 本地保存</span><span><Bot /> 明确 AI 标示</span><span><ImagePlus /> 支持图片</span></div></main>;
}

function Chat({ person, messages, onSend, sending, onEdit, consent, aiState, onOpenAi }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending]);
  async function chooseImage(event) { const file = event.target.files?.[0]; if (file) setImage(await readFile(file)); }
  function submit() { if (sending || (!text.trim() && !image)) return; onSend(text.trim(), image); setText(''); setImage(''); }
  const modeLabel = consent && aiState.status === 'connected' ? '真实 AI · 当前角色独立上下文' : aiState.status === 'connected' ? '规则演示 · 可开启真实 AI' : '规则演示 · AI 后端未连接';
  return <main className="chat-view">
    <header className="chat-header"><div className="mobile-back"><ChevronLeft /></div><Avatar person={person} /><div className="chat-title"><strong>{person.name}</strong><span><i className={consent ? 'online' : ''} /> AI 风格模拟 · {modeLabel}</span></div><button className="icon-button" onClick={onEdit}><Ellipsis /></button></header>
    <div className="disclosure"><ShieldCheck size={15} /> 当前只使用“{person.name}”的独立样本与上下文，不与其他角色互通；回复不代表本人。<button onClick={onOpenAi}>查看隔离与 AI 模式</button></div>
    <div className="messages">
      {!messages.length && <div className="conversation-start"><Avatar person={person} large /><h2>和“{person.name}”开始对话</h2><p>已读取 {person.samples?.length ?? 0} 条语言样本。你可以发送文字或图片。</p></div>}
      {messages.map((message) => <div key={message.id} className={`message-row ${message.role}`}>
        {message.role === 'assistant' && <Avatar person={person} />}
        <div className="bubble">{message.image && <img className="message-image" src={message.image} alt="聊天图片" />}{message.text && <p>{message.text}</p>}{message.sources?.length > 0 && <div className="message-sources"><strong>{message.searchedWeb ? '联网来源' : '参考来源'}</strong>{message.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{index + 1}. {source.title}</a>)}</div>}<time>{new Date(message.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
      </div>)}
      {sending && <div className="message-row assistant"><Avatar person={person} /><div className="bubble typing"><i /><i /><i /></div></div>}
      <div ref={bottom} />
    </div>
    <div className="composer-wrap">
      {image && <div className="image-preview"><img src={image} alt="待发送" /><button onClick={() => setImage('')}><X size={15} /></button></div>}
      <div className="composer"><label className="icon-button"><ImagePlus /><input hidden type="file" accept="image/*" onChange={chooseImage} /></label><textarea rows="1" placeholder={`发消息给 ${person.name} 的 AI 模拟…`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} /><button className="send-button" onClick={submit} disabled={sending || (!text.trim() && !image)}><Send size={18} /></button></div>
      <span className="composer-note">AI 可能会出错，请勿将回复视为对方本人的真实表达</span>
    </div>
  </main>;
}

function App() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(savedAgeConfirmation);
  const [aiState, setAiState] = useState({ status: 'checking', label: '正在检查 AI 连接' });
  const refreshAi = async () => setAiState(await checkAiConnection());
  useEffect(() => {
    loadState().then((saved) => { if (saved) setState(saved); }).catch((error) => {
      console.error(error); setToast('本地数据读取失败，已使用安全空白状态。');
    }).finally(() => setReady(true));
    refreshAi();
  }, []);
  useEffect(() => {
    if (!ready) return;
    saveState(state).catch((error) => { console.error(error); setToast('本地保存失败：设备空间可能不足。'); });
  }, [state, ready]);
  useEffect(() => { if (aiState.status !== 'connected' && consent) setConsent(false); }, [aiState.status, consent]);
  const selected = state.people.find((person) => person.id === state.selectedId) ?? null;
  const currentMessages = state.messages[state.selectedId] ?? [];
  const setTracks = (updater) => setState((s) => ({ ...s, tracks: typeof updater === 'function' ? updater(s.tracks) : updater }));

  function savePerson(person) {
    setState((s) => ({ ...s, people: s.people.some((p) => p.id === person.id) ? s.people.map((p) => p.id === person.id ? person : p) : [...s.people, person], selectedId: person.id }));
    setModal(null);
  }
  function deletePerson(person) {
    if (!confirm(`删除“${person.name}”及其本地聊天？此操作无法撤销。`)) return;
    setState((s) => { const messages = { ...s.messages }; delete messages[person.id]; const people = s.people.filter((p) => p.id !== person.id); return { ...s, people, messages, selectedId: people[0]?.id ?? null }; });
    setModal(null);
  }
  async function send(text, image) {
    if (!selected || sending) return;
    const personId = selected.id;
    const personName = selected.name;
    const personSamples = selected.samples ?? [];
    const user = { id: id(), role: 'user', text, image, at: Date.now() };
    const payload = buildPersonaPayload(selected, state.messages, user, { ageConfirmed, webSearch: true });
    const history = payload.messages;
    setState((s) => ({ ...s, messages: { ...s.messages, [personId]: history } }));
    setSending(true);
    let reply = '';
    let aiResult = null;
    try {
      if (consent && aiState.status === 'connected') {
        aiResult = await requestAiReply(payload);
        reply = aiResult.text;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 650));
        reply = makeDemoReply(text || '图片', personSamples, personName);
      }
    } catch (error) {
      reply = makeDemoReply(text || '图片', personSamples, personName);
      setConsent(false);
      setAiState((value) => ({ ...value, status: 'offline', label: 'AI 后端连接失败', detail: error.message }));
      setToast(`${error.message} 已安全切换为本地演示。`);
      setTimeout(() => setToast(''), 4200);
    }
    setState((s) => ({ ...s, messages: { ...s.messages, [personId]: [...(s.messages[personId] ?? []), { id: id(), role: 'assistant', text: reply, sources: aiResult?.sources ?? [], searchedWeb: Boolean(aiResult?.searchedWeb), at: Date.now() }] } }));
    setSending(false);
  }

  if (!ready) return <div className="loading"><div className="logo-mark">回</div></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo-mark">回</div><div><strong>回声</strong><span>ECHO</span></div><button className="icon-button add-person" onClick={() => setModal('new')}><Plus /></button></div>
      <nav><button className="nav-active"><MessageCircleMore /> 对话</button><button onClick={() => setModal('privacy')}><ShieldCheck /> AI 与隐私</button></nav>
      <div className="people-title"><span>对话对象</span><button onClick={() => setModal('new')}><Plus size={15} /></button></div>
      <div className="people-list">{state.people.map((person) => <button key={person.id} className={person.id === state.selectedId ? 'selected' : ''} onClick={() => setState((s) => ({ ...s, selectedId: person.id }))}><Avatar person={person} /><span><strong>{person.name}</strong><small>{(state.messages[person.id] ?? []).at(-1)?.text || `${person.samples?.length ?? 0} 条风格样本`}</small></span><i /></button>)}</div>
      <MusicPlayer tracks={state.tracks} setTracks={setTracks} />
      <button className="privacy-shortcut" onClick={() => setModal('privacy')}><LockKeyhole /><span><strong>角色隔离已开启</strong><small>{consent ? '真实 AI · 仅当前角色' : `规则演示 · ${aiState.label}`}</small></span></button>
    </aside>
    {selected ? <Chat person={selected} messages={currentMessages} onSend={send} sending={sending} consent={consent} aiState={aiState} onEdit={() => setModal('edit')} onOpenAi={() => setModal('privacy')} /> : <EmptyChat onAdd={() => setModal('new')} />}
    {(modal === 'new' || modal === 'edit') && <NewPersonModal initial={modal === 'edit' ? selected : null} onClose={() => setModal(null)} onSave={savePerson} onDelete={() => deletePerson(selected)} />}
    {modal === 'privacy' && <PrivacyModal enabled={consent} ageConfirmed={ageConfirmed} aiState={aiState} onChange={setConsent} onRefresh={refreshAi} onClose={() => setModal(null)} />}
    {!ageConfirmed && <AgeGate onConfirm={() => { try { sessionStorage.setItem('echo-age-confirmed', 'true'); } catch { /* Session-only confirmation still works. */ } setAgeConfirmed(true); }} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
