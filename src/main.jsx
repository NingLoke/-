import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bot, Check, ChevronLeft, CirclePause, CirclePlay, Ellipsis,
  Headphones, ImagePlus, Library, LockKeyhole, MessageCircleMore, Music2,
  Pause, Play, Plus, Send, ShieldCheck, SkipBack, SkipForward, Sparkles,
  Trash2, Upload, UserRoundPlus, Volume2, X,
} from 'lucide-react';
import { loadState, saveState } from './storage.js';
import { makeDemoReply, parseChatRecord } from './parser.js';
import './styles.css';

const id = () => crypto.randomUUID();
const DEFAULT_STATE = { people: [], messages: {}, tracks: [], selectedId: null };

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

function NewPersonModal({ initial, onClose, onSave, onDelete }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [speaker, setSpeaker] = useState(initial?.speaker ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? '');
  const [fileName, setFileName] = useState('');
  const [raw, setRaw] = useState('');

  async function avatarChange(event) {
    const file = event.target.files?.[0];
    if (file) setAvatar(await readFile(file));
  }
  async function chatChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRaw(await readFile(file, 'text'));
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
      <span>{fileName || (initial?.samples?.length ? `已保存 ${initial.samples.length} 条语言样本` : '导入聊天记录')}</span>
      <small>支持常见 TXT / 导出的纯文字格式</small>
      <input type="file" accept=".txt,.log,text/plain" onChange={chatChange} hidden />
    </label>
    {raw && <div className="parse-result"><Check size={15} /> 已识别 {parsed.length} 条“{speaker || '全部参与者'}”的语言样本</div>}
    <div className="modal-actions">
      {initial && <button className="button danger" onClick={onDelete}><Trash2 size={15} /> 删除</button>}
      <span className="action-spacer" />
      <button className="button secondary" onClick={onClose}>取消</button>
      <button className="button primary" disabled={!name.trim()} onClick={() => onSave({ ...initial, id: initial?.id ?? id(), name: name.trim(), speaker: speaker.trim(), avatar, samples: raw ? parsed : (initial?.samples ?? []) })}>保存并开始对话</button>
    </div>
  </Modal>;
}

function PrivacyModal({ enabled, onClose, onChange }) {
  return <Modal onClose={onClose}>
    <button className="icon-button modal-close" onClick={onClose}><X size={19} /></button>
    <div className="privacy-mark"><ShieldCheck /></div>
    <h2>你的资料，由你决定</h2>
    <p className="muted modal-intro">头像、聊天记录、消息、图片和音乐默认保存在浏览器的本地数据库，不会自动上传。</p>
    <div className="consent-card">
      <div><strong>联网 AI 回答</strong><p>开启后，每次提问会发送必要的近期消息、图片和风格样本到已配置的 AI 服务。服务端请求不保存响应。</p></div>
      <button className={`toggle ${enabled ? 'on' : ''}`} onClick={() => onChange(!enabled)} aria-label="切换联网 AI"><span /></button>
    </div>
    <p className="fine-print"><LockKeyhole size={14} /> 请只导入你有权使用的聊天内容，并尊重对方隐私。</p>
    <button className="button primary full" onClick={onClose}>了解</button>
  </Modal>;
}

function MusicPlayer({ tracks, setTracks }) {
  const audio = useRef(new Audio());
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const track = tracks[current];

  useEffect(() => {
    const player = audio.current;
    if (!track) { player.pause(); return; }
    player.src = track.data;
    if (playing) player.play().catch(() => setPlaying(false));
  }, [current, track?.id]);
  useEffect(() => {
    const player = audio.current;
    const tick = () => setProgress(player.duration ? player.currentTime / player.duration * 100 : 0);
    const ended = () => setCurrent((value) => tracks.length ? (value + 1) % tracks.length : 0);
    player.addEventListener('timeupdate', tick); player.addEventListener('ended', ended);
    return () => { player.removeEventListener('timeupdate', tick); player.removeEventListener('ended', ended); };
  }, [tracks.length]);

  async function addTracks(event) {
    const files = [...(event.target.files ?? [])];
    const added = await Promise.all(files.map(async (file) => ({ id: id(), name: file.name.replace(/\.[^.]+$/, ''), data: await readFile(file), type: file.type })));
    setTracks((value) => [...value, ...added]);
  }
  function toggle() {
    if (!track) return;
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

function Chat({ person, messages, onSend, sending, onEdit, onDelete, consent }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const bottom = useRef(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length, sending]);
  async function chooseImage(event) { const file = event.target.files?.[0]; if (file) setImage(await readFile(file)); }
  function submit() { if (!text.trim() && !image) return; onSend(text.trim(), image); setText(''); setImage(''); }
  return <main className="chat-view">
    <header className="chat-header"><div className="mobile-back"><ChevronLeft /></div><Avatar person={person} /><div className="chat-title"><strong>{person.name}</strong><span><i /> AI 风格模拟 · {consent ? '联网回答' : '本地演示'}</span></div><button className="icon-button" onClick={onEdit}><Ellipsis /></button></header>
    <div className="disclosure"><ShieldCheck size={15} /> 这是基于语言样本的 AI 模拟，不代表 {person.name} 本人的想法、记忆或身份。</div>
    <div className="messages">
      {!messages.length && <div className="conversation-start"><Avatar person={person} large /><h2>和“{person.name}”开始对话</h2><p>已读取 {person.samples?.length ?? 0} 条语言样本。你可以发送文字或图片。</p></div>}
      {messages.map((message) => <div key={message.id} className={`message-row ${message.role}`}>
        {message.role === 'assistant' && <Avatar person={person} />}
        <div className="bubble">{message.image && <img className="message-image" src={message.image} alt="聊天图片" />}{message.text && <p>{message.text}</p>}<time>{new Date(message.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></div>
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
  useEffect(() => { loadState().then((saved) => { if (saved) setState(saved); setReady(true); }); }, []);
  useEffect(() => { if (ready) saveState(state); }, [state, ready]);
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
    const user = { id: id(), role: 'user', text, image, at: Date.now() };
    const history = [...currentMessages, user];
    setState((s) => ({ ...s, messages: { ...s.messages, [selected.id]: history } }));
    setSending(true);
    let reply = '';
    try {
      if (consent) {
        const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, persona: { name: selected.name }, samples: selected.samples, messages: history }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        reply = data.text;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 650));
        reply = makeDemoReply(text || '图片', selected.samples ?? [], selected.name);
      }
    } catch (error) {
      reply = makeDemoReply(text || '图片', selected.samples ?? [], selected.name);
      setToast(`${error.message} 已切换为本地演示回答。`);
      setTimeout(() => setToast(''), 4200);
    }
    setState((s) => ({ ...s, messages: { ...s.messages, [selected.id]: [...(s.messages[selected.id] ?? []), { id: id(), role: 'assistant', text: reply, at: Date.now() }] } }));
    setSending(false);
  }

  if (!ready) return <div className="loading"><div className="logo-mark">回</div></div>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo-mark">回</div><div><strong>回声</strong><span>ECHO</span></div><button className="icon-button add-person" onClick={() => setModal('new')}><Plus /></button></div>
      <nav><button className="nav-active"><MessageCircleMore /> 对话</button><button onClick={() => setModal('privacy')}><ShieldCheck /> 隐私设置</button></nav>
      <div className="people-title"><span>对话对象</span><button onClick={() => setModal('new')}><Plus size={15} /></button></div>
      <div className="people-list">{state.people.map((person) => <button key={person.id} className={person.id === state.selectedId ? 'selected' : ''} onClick={() => setState((s) => ({ ...s, selectedId: person.id }))}><Avatar person={person} /><span><strong>{person.name}</strong><small>{(state.messages[person.id] ?? []).at(-1)?.text || `${person.samples?.length ?? 0} 条风格样本`}</small></span><i /></button>)}</div>
      <MusicPlayer tracks={state.tracks} setTracks={setTracks} />
      <button className="privacy-shortcut" onClick={() => setModal('privacy')}><LockKeyhole /><span><strong>本地优先模式</strong><small>{consent ? '已授权联网 AI' : '资料不会离开设备'}</small></span></button>
    </aside>
    {selected ? <Chat person={selected} messages={currentMessages} onSend={send} sending={sending} consent={consent} onEdit={() => setModal('edit')} onDelete={() => deletePerson(selected)} /> : <EmptyChat onAdd={() => setModal('new')} />}
    {(modal === 'new' || modal === 'edit') && <NewPersonModal initial={modal === 'edit' ? selected : null} onClose={() => setModal(null)} onSave={savePerson} onDelete={() => deletePerson(selected)} />}
    {modal === 'privacy' && <PrivacyModal enabled={consent} onChange={setConsent} onClose={() => setModal(null)} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
