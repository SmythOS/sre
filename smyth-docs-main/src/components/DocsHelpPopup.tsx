import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { Smile, Send, X, CheckCircle } from 'lucide-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const AVATAR = '/docs/img/aria-smythos-cmo.png';
const POPUP_DELAY_MS = 200000;

function useSupabase() {
  const { siteConfig } = useDocusaurusContext();
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = siteConfig.customFields as {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  };
  return React.useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY), [
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  ]);
}

function Popup() {
  const supabase = useSupabase();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState('');
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(true);
      setTimeout(() => boxRef.current?.focus(), 200);
    }, POPUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const close = () => setOpen(false);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!text.trim()) {
      setStatus('Please enter a suggestion.');
      return;
    }
    if (email && !isValidEmail(email.trim())) {
      setStatus('Please enter a valid email.');
      return;
    }

    setBusy(true);
    setStatus('');

    const payload = {
      page_id: window.location.pathname,
      comment: text.trim(),
      email: email.trim() || null,
      user_agent: navigator.userAgent.slice(0, 120),
    };

    const { error } = await supabase.from('docs_popup_feedback').insert(payload);

    setBusy(false);

    if (error) {
      setStatus('Error submitting feedback, please try again.');
      console.error('Submit error:', error);
      return;
    }

    setSent(true);
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
      aria-describedby="popup-desc"
      tabIndex={-1}
      style={{
        position: 'fixed',
        right: '1.5rem',
        bottom: '1.5rem',
        width: 360,
        maxWidth: 'calc(100vw - 2rem)',
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        fontSize: '0.9rem',
        color: '#374151',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.8rem 1rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        <img
          src={AVATAR}
          alt=""
          style={{
            borderRadius: '50%',
            width: 64,
            height: 64,
            marginRight: 16,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <h4
            id="popup-title"
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.2,
            }}
          >
            Need help with the docs?
          </h4>
          <p
            id="popup-desc"
            style={{
              marginTop: 4,
              fontSize: '0.85rem',
              color: '#6b7280',
              lineHeight: 1.3,
            }}
          >
            Tell us what’s missing or confusing, and we’ll fix it.
          </p>
        </div>
        <button
          onClick={close}
          aria-label="Close popup"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#9ca3af',
            borderRadius: 6,
            transition: 'color 0.25s, background-color 0.25s',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
        >
          <X size={22} />
        </button>
      </div>

      {/* Form Body */}
      <form
        onSubmit={submit}
        style={{ padding: '1.25rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column' }}
        noValidate
      >
        {sent ? (
          <p
            style={{
              marginTop: 10,
              fontSize: '1rem',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              userSelect: 'none',
            }}
          >
            <CheckCircle size={24} />
            Got it — thanks for helping us improve!
          </p>
        ) : (
          <>
            <label htmlFor="feedback-text" style={{ position: 'absolute', left: -9999 }}>
              Suggestion text
            </label>
            <textarea
              id="feedback-text"
              ref={boxRef}
              rows={4}
              placeholder="What can we improve?"
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1.5px solid #d1d5db',
                padding: '0.75rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                color: '#111827',
                transition: 'border-color 0.25s',
                marginBottom: 16,
                minHeight: 90,
                boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.06)',
                backgroundColor: busy ? '#f9fafb' : undefined,
                cursor: busy ? 'not-allowed' : undefined,
              }}
              disabled={busy}
              required
              aria-required="true"
            />

            <label htmlFor="feedback-email" style={{ position: 'absolute', left: -9999 }}>
              Your email (optional)
            </label>
            <input
              id="feedback-email"
              type="email"
              placeholder="Your email (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1.5px solid #d1d5db',
                padding: '0.6rem 0.75rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                color: '#111827',
                transition: 'border-color 0.25s',
                marginBottom: 12,
                boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.06)',
                backgroundColor: busy ? '#f9fafb' : undefined,
                cursor: busy ? 'not-allowed' : undefined,
              }}
              disabled={busy}
              aria-describedby="email-desc"
              autoComplete="email"
            />
            <p
              id="email-desc"
              style={{
                marginTop: -10,
                marginBottom: 16,
                fontSize: '0.9rem',
                color: '#6b7280',
                userSelect: 'none',
              }}
            >
              We won’t spam you — just in case we need to follow up.
            </p>

            {status && !sent && (
              <p
                style={{ color: '#dc2626', marginTop: 8, fontSize: '0.9rem', userSelect: 'none' }}
                role="alert"
                aria-live="assertive"
              >
                {status}
              </p>
            )}

            {/* Buttons */}
            <div style={{ marginTop: 6, display: 'flex', gap: 14 }}>
              {/* Send Button */}
              <button
                type="submit"
                disabled={busy || !text.trim()}
                style={{
                  flex: 1,
                  backgroundColor: busy || !text.trim() ? '#93c5fd' : '#2563eb',
                  color: '#fff',
                  borderRadius: 14,
                  border: 'none',
                  padding: '0.7rem 0',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: busy || !text.trim() ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <Send size={22} />
                {busy ? 'Sending…' : 'Send'}
              </button>

              {/* Talk to a human Button */}
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = 'mailto:support@smythos.com?subject=Docs%20question';
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  color: '#2563eb',
                  borderRadius: 14,
                  border: '2px solid #2563eb',
                  padding: '0.65rem 0',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.25s, color 0.25s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.color = '#2563eb';
                }}
              >
                Talk to a human
              </button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}

export default function DocsHelpPopup() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient ? <Popup /> : null;
}
