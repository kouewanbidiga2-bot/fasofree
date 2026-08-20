import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Send, Users, Hash, MessageSquare, ArrowLeft } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://fasofree-3nh8.onrender.com/api/v1';

const CHANNELS = [
  { id: 'general', label: 'Général', icon: Hash, desc: 'Coordination générale' },
  { id: 'operations', label: 'Opérations', icon: Hash, desc: 'Suivi commandes & livraisons' },
  { id: 'support', label: 'Support', icon: Hash, desc: 'Support client & litiges' },
  { id: 'finance', label: 'Finance', icon: Hash, desc: 'Transactions & payouts' },
];

const InternalChat = ({ currentUser }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState('channels'); // 'channels' | 'channel' | 'dm-list' | 'dm'
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [dmPartners, setDmPartners] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Connect Socket.IO
  useEffect(() => {
    const token = localStorage.getItem('fasofree_token');
    if (!token) return;

    const s = io(`${API_BASE.replace('/api/v1', '')}/internal-chat`, {
      auth: { token },
      transports: ['websocket'],
    });

    s.on('connect', () => {
      setConnected(true);
      s.emit('joinChannel', { channel: 'general' });
    });

    s.on('disconnect', () => setConnected(false));

    s.on('newMessage', (packet) => {
      setMessages((prev) => [...prev, packet]);
    });

    s.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load DM partners
  const loadDmPartners = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/internal-chat/dm-partners`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('fasofree_token')}` },
      });
      const data = await res.json();
      setDmPartners(Array.isArray(data) ? data : []);
    } catch {
      setDmPartners([]);
    }
  }, []);

  // Join channel
  const joinChannel = useCallback(
    (channelId) => {
      if (!socket) return;
      socket.emit('joinChannel', { channel: channelId }, (res) => {
        if (res?.status === 'ok') {
          setMessages(res.history || []);
          setActiveChannel(channelId);
          setView('channel');
        }
      });
    },
    [socket],
  );

  // Join DM
  const joinDm = useCallback(
    (recipientId) => {
      if (!socket) return;
      socket.emit('joinDm', { recipientId }, (res) => {
        if (res?.status === 'ok') {
          setMessages(res.history || []);
          setActiveDmUser(recipientId);
          setView('dm');
        }
      });
    },
    [socket],
  );

  // Send message
  const handleSend = useCallback(() => {
    if (!socket || !input.trim()) return;
    const text = input.trim();
    setInput('');

    if (view === 'channel') {
      socket.emit('sendMessage', { channel: activeChannel, message: text }, (res) => {
        if (res?.status === 'sent') {
          setMessages((prev) => [...prev, res.data]);
        }
      });
    } else if (view === 'dm' && activeDmUser) {
      socket.emit('sendDm', { recipientId: activeDmUser, message: text }, (res) => {
        if (res?.status === 'sent') {
          setMessages((prev) => [...prev, res.data]);
        }
      });
    }
  }, [socket, input, view, activeChannel, activeDmUser]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const switchView = (newView) => {
    setMessages([]);
    setActiveDmUser(null);
    if (newView === 'dm-list') loadDmPartners();
    setView(newView);
  };

  const isOwn = (msg) => msg.senderId === currentUser?.id;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Users size={20} className="text-accent-primary" />
            Discussion Équipe
          </h2>
          <p className="text-text-secondary text-sm">
            Chat interne entre admins et support. Canaux thématiques + messages directs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-text-tertiary">{connected ? 'Connecté' : 'Déconnecté'}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 border-b border-border-light pb-2">
        <button
          onClick={() => switchView('channels')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
            view === 'channels' || view === 'channel'
              ? 'bg-accent-primary text-white'
              : 'text-text-secondary hover:bg-background-secondary'
          }`}
        >
          <Hash size={12} className="inline mr-1" />
          Canaux
        </button>
        <button
          onClick={() => switchView('dm-list')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
            view === 'dm-list' || view === 'dm'
              ? 'bg-accent-primary text-white'
              : 'text-text-secondary hover:bg-background-secondary'
          }`}
        >
          <MessageSquare size={12} className="inline mr-1" />
          Messages directs
        </button>
      </div>

      {/* Channel list view */}
      {view === 'channels' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => joinChannel(ch.id)}
              className="card p-4 text-left hover:bg-background-secondary transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-primary/15 flex items-center justify-center">
                  <ch.icon size={18} className="text-accent-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">#{ch.label}</p>
                  <p className="text-xs text-text-tertiary">{ch.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DM list view */}
      {view === 'dm-list' && (
        <div className="space-y-2">
          {dmPartners.length === 0 ? (
            <p className="text-text-tertiary text-xs text-center py-8">
              Aucune conversation directe récente.
            </p>
          ) : (
            dmPartners.map((p) => (
              <button
                key={p.userId}
                onClick={() => joinDm(p.userId)}
                className="card p-3 flex items-center gap-3 w-full hover:bg-background-secondary transition"
              >
                <div className="w-8 h-8 rounded-full bg-accent-primary text-white text-xs font-bold flex items-center justify-center">
                  {p.userId.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-xs font-semibold text-text-primary">Utilisateur #{p.userId.slice(0, 8)}</p>
                  <p className="text-[10px] text-text-tertiary truncate">{p.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Chat view (channel or DM) */}
      {(view === 'channel' || view === 'dm') && (
        <div className="flex flex-col h-[500px]">
          {/* Chat header */}
          <div className="flex items-center gap-2 pb-3 border-b border-border-light">
            <button
              onClick={() => switchView(view === 'dm' ? 'dm-list' : 'channels')}
              className="btn-icon !p-1.5"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-text-primary">
                {view === 'channel'
                  ? '#' + (CHANNELS.find((c) => c.id === activeChannel)?.label || activeChannel)
                  : 'DM avec #' + (activeDmUser?.slice(0, 8) || '')
                }
              </p>
              <span className="text-[10px] text-text-tertiary">{messages.length} messages</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-text-tertiary text-xs text-center py-8">
                Aucun message. Commencez la conversation !
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-2 ${isOwn(msg) ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isOwn(msg) ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary'
                }`}>
                  {(msg.senderRole || '?').charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[75%] ${isOwn(msg) ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-text-primary uppercase">
                      {isOwn(msg) ? 'Vous' : msg.senderRole}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className={`inline-block px-3 py-2 rounded-lg text-xs text-left ${
                    isOwn(msg)
                      ? 'bg-accent-primary text-white rounded-br-none'
                      : 'bg-background-secondary text-text-primary rounded-bl-none'
                  }`}>
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="pt-3 border-t border-border-light flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tapez votre message..."
              className="flex-1 px-3 py-2.5 text-sm border border-border-light rounded-lg focus:outline-none focus:border-accent-primary"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="btn-primary px-4 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalChat;
