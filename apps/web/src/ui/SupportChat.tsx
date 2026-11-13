import React, { useState, useEffect, useRef } from 'react';
import { Bot, ArrowRight, Sparkles, MessageSquare, Send, RotateCcw, ArrowUpRight, LifeBuoy } from 'lucide-react';
import { OfficialWhatsAppIcon } from './PublicPages';

export interface SupportChatBoxProps {
  title?: string;
  subtitle?: string;
  context: 'help' | 'contact' | 'account';
  quickQuestions?: string[];
  placeholder?: string;
  onEscalateToContact?: () => void;
  onEscalateToTicket?: () => void;
}

interface ChatMessage {
  role: 'user' | 'ai' | 'error';
  content: string;
}

export function SupportChatBox({
  title = "Ask NORVI AI Support Assistant",
  subtitle = "Instant answers for setup, license activation, 1-day offline mode, and payments. If our AI cannot resolve your issue, it will connect you with our engineering team on WhatsApp or via support ticket.",
  context,
  quickQuestions = [
    "How does 1-day offline mode work?",
    "How do I activate my license on a second PC?",
    "Where is my activation key delivered?",
    "How does Voro work in interviews?"
  ],
  placeholder = "Ask any question about our agents, licenses, or setup...",
  onEscalateToContact,
  onEscalateToTicket
}: SupportChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');
    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: newHistory.filter(m => m.role !== 'error')
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'AI Assistant is currently busy. Please connect via WhatsApp or human support.' }));
        throw new Error(err.error || 'Failed to connect to AI Assistant');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { role: 'ai', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1].content += chunk;
            return copy;
          });
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'error',
          content: err.message || 'Could not complete response. You can connect with our human support team directly on WhatsApp or submit a form.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  const whatsappHref = `https://wa.me/919893534314?text=${encodeURIComponent('Hi NORVI Support, I need assistance with an agent question.')}`;

  return (
    <div
      className="support-chat-box"
      style={{
        background: 'linear-gradient(180deg, #171d16 0%, #121612 100%)',
        border: '1px solid #2e382b',
        borderRadius: 14,
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(212, 248, 156, 0.12)',
                border: '1px solid rgba(212, 248, 156, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--lime)'
              }}
            >
              <Bot size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>{title}</h3>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 100,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Instant 24/7
            </span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: 760, lineHeight: 1.6 }}>
            {subtitle}
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            className="text-button bare"
            onClick={clearChat}
            style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={13} /> Reset conversation
          </button>
        )}
      </div>

      {/* Suggested Quick Question Chips */}
      {messages.length === 0 && quickQuestions && quickQuestions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.6px', color: 'var(--muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
            Common questions you can ask:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(q)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 20,
                  padding: '6px 14px',
                  fontSize: 12,
                  color: '#d6ded2',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s, border 0.2s, transform 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(212, 248, 156, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(212, 248, 156, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Sparkles size={12} style={{ display: 'inline-block', marginRight: 6, color: 'var(--lime)', verticalAlign: 'middle' }} />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      {messages.length > 0 && (
        <div
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            padding: '14px',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 16
          }}
        >
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const isError = m.role === 'error';

            return (
              <div
                key={idx}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: isUser ? 'var(--lime)' : isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  color: isUser ? '#111411' : isError ? '#fca5a5' : '#ecefe9',
                  border: isError ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 13.5,
                  lineHeight: 1.6
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>

                {/* Smart Action Buttons on AI Response */}
                {!isUser && !isError && m.content.length > 30 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(37, 211, 102, 0.14)',
                        border: '1px solid rgba(37, 211, 102, 0.35)',
                        color: '#4ade80',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 6,
                        textDecoration: 'none'
                      }}
                    >
                      <OfficialWhatsAppIcon size={14} color="#4ade80" /> WhatsApp Support
                    </a>

                    {context === 'account' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onEscalateToTicket) onEscalateToTicket();
                          else {
                            const form = document.querySelector('form[name="support"]');
                            if (form) form.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#e2e8f0',
                          fontSize: 11.5,
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        <LifeBuoy size={13} style={{ color: 'var(--lime)' }} /> Open Support Ticket
                      </button>
                    ) : (
                      <a
                        href="/contact"
                        onClick={e => {
                          if (context === 'contact' && onEscalateToContact) {
                            e.preventDefault();
                            onEscalateToContact();
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#e2e8f0',
                          fontSize: 11.5,
                          padding: '4px 10px',
                          borderRadius: 6,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageSquare size={13} style={{ color: 'var(--lime)' }} /> {context === 'contact' ? 'Use Contact Form Below' : 'Contact Us Page'}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {loading && messages[messages.length - 1]?.role === 'user' && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 10,
                padding: '10px 16px',
                color: 'var(--muted)',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Bot size={16} style={{ color: 'var(--lime)' }} />
              <span>Thinking &amp; analyzing knowledge base...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          sendMessage();
        }}
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 8,
          padding: '6px 8px 6px 14px'
        }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            outline: 'none',
            fontSize: 14
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="button primary small"
          style={{
            padding: '8px 16px',
            gap: 6,
            opacity: loading || !input.trim() ? 0.45 : 1,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Answering...' : 'Ask'}
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
