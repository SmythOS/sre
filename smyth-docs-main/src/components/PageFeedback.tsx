import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, CheckCircle } from 'lucide-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { createClient } from '@supabase/supabase-js';

type Vote = 'up' | 'down' | null;
interface Props { pageId?: string }

/* SmythOS Palette */ 
const SMYTH_COLOR = {
  accent: '#3c89f9',
  accentDark: '#326fc7',
  border: '#d0d7de',
  text: '#4b5563',
  bg: '#f9fafb',
  cancelBg: '#f3f4f6',
  cancelBorder: '#d1d5db',
  cancelHoverBg: '#e5e7eb',
  successGreen: '#16a34a',
};

function useSupabase() {
  const { siteConfig } = useDocusaurusContext();
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = siteConfig.customFields as {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  };
  return useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY), [SUPABASE_URL, SUPABASE_ANON_KEY]);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function PageFeedback({ pageId }: Props) {
  const pagePath = pageId ?? (typeof window !== 'undefined' ? window.location.pathname : 'unknown');
  const STORAGE = `feedback-${pagePath}`;
  const supabase = useSupabase();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'ssr';

  const [vote, setVote] = useState<Vote>(null);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem('feedback-email');
    if (storedEmail) setEmail(storedEmail);
  }, []);

  useEffect(() => {
    async function fetchFeedback() {
      setBusy(true);
      let query = supabase.from('feedback').select('vote, comment').eq('page_id', pagePath);
      if (email) {
        query = query.eq('email', email);
      } else {
        query = query.eq('user_agent', userAgent);
      }
      const { data, error } = await query.single();

      if (!error && data) {
        setVote(data.vote);
        setComment(data.comment ?? '');
        setStatus('Thanks for your previous feedback ✓');
        setSubmitted(true);
        localStorage.setItem(STORAGE, data.vote);
        if (email) localStorage.setItem('feedback-email', email);
      } else {
        setVote(null);
        setComment('');
        setStatus('');
        setSubmitted(false);
        localStorage.removeItem(STORAGE);
      }
      setBusy(false);
    }

    fetchFeedback();
  }, [email, pagePath, supabase, STORAGE, userAgent]);

  useEffect(() => {
    setComment('');
  }, [vote]);

  const cache = (v: Vote | null, emailVal?: string) => {
    v ? localStorage.setItem(STORAGE, v) : localStorage.removeItem(STORAGE);
    if (emailVal !== undefined) localStorage.setItem('feedback-email', emailVal);
  };

  const upsertFeedback = async (v: Vote, text: string | null, emailVal: string | null) => {
    if (!v) return new Error('Vote required');
    if (emailVal && !isValidEmail(emailVal)) {
      return new Error('Invalid email');
    }

    const onConflictCols = emailVal ? 'email,page_id' : 'user_agent,page_id';

    const { error } = await supabase
      .from('feedback')
      .upsert(
        [
          {
            page_id: pagePath,
            vote: v,
            comment: text,
            user_agent: userAgent,
            email: emailVal,
          },
        ],
        { onConflict: onConflictCols }
      );

    return error;
  };

  const removeFeedback = async () => {
    let query = supabase.from('feedback').delete().eq('page_id', pagePath);
    if (email) {
      query = query.eq('email', email);
    } else {
      query = query.eq('user_agent', userAgent);
    }
    const { error } = await query;
    return error;
  };

  const pick = async (dir: Vote) => {
    if (busy) return;

    if (vote === dir) {
      setBusy(true);
      setStatus('Removing…');
      const error = await removeFeedback();
      setBusy(false);
      if (!error) {
        setVote(null);
        setComment('');
        setSubmitted(false);
        cache(null, email);
        setStatus('Feedback cleared');
      } else {
        setStatus('Error removing feedback');
      }
      return;
    }

    if (vote && vote !== dir) {
      setVote(dir);
      setStatus('');
      setSubmitted(false);
      setComment('');
      setTimeout(() => textareaRef.current?.focus(), 25);
      return;
    }

    setVote(dir);
    setStatus('');
    setSubmitted(false);
    setTimeout(() => textareaRef.current?.focus(), 25);
  };

  const send = async () => {
    if (busy) return;
    if (!vote) {
      setStatus('Please select up or down vote');
      statusRef.current?.focus();
      return;
    }
    if (email && !isValidEmail(email)) {
      setStatus('Please enter a valid email');
      emailRef.current?.focus();
      return;
    }

    setBusy(true);
    setStatus('Submitting…');
    const error = await upsertFeedback(vote, comment.trim() || null, email.trim() || null);
    setBusy(false);
    if (!error) {
      cache(vote, email);
      setStatus('Thanks for the feedback ✓');
      setSubmitted(true);
      setComment('');
      statusRef.current?.focus();
    } else {
      setStatus('Error — please try again');
    }
  };

  const Btn = ({ dir }: { dir: 'up' | 'down' }) => {
    const Icon = dir === 'up' ? ThumbsUp : ThumbsDown;
    const active = vote === dir;
    return (
      <button
        onClick={() => pick(dir)}
        disabled={busy}
        aria-pressed={active}
        aria-label={dir === 'up' ? 'Helpful' : 'Not helpful'}
        style={{
          background: active ? SMYTH_COLOR.accent : '#fff',
          border: `2px solid ${active ? SMYTH_COLOR.accentDark : SMYTH_COLOR.border}`,
          color: active ? '#fff' : SMYTH_COLOR.text,
          borderRadius: 6,
          padding: '0.35rem 0.65rem',
          marginRight: 6,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          outlineOffset: 2,
          transition: 'background-color 0.2s, transform 0.15s',
          transform: busy && active ? 'scale(0.9)' : 'none',
        }}
        onMouseEnter={e => {
          if (!busy && !active) e.currentTarget.style.background = '#ebf4ff';
        }}
        onMouseLeave={e => {
          if (!active) e.currentTarget.style.background = '#fff';
        }}
      >
        <Icon size={18} strokeWidth={2} />
      </button>
    );
  };

  const commentLabel =
    vote === 'up' ? 'What did you like? (optional)' : vote === 'down' ? 'What can be improved? (optional)' : 'Your suggestions or comments (optional)';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
      <section
        style={{
          display: 'inline-block',
          padding: '1rem 1.2rem',
          background: SMYTH_COLOR.bg,
          border: `1px solid ${SMYTH_COLOR.border}`,
          borderRadius: 12,
          fontSize: '0.9rem',
          color: SMYTH_COLOR.text,
          minWidth: 280,
          boxShadow: '0 4px 8px rgb(0 0 0 / 0.1)',
        }}
      >
        <label
          htmlFor="vote-buttons"
          style={{ marginRight: 12, fontWeight: 600, display: 'inline-block', marginBottom: 6 }}
        >
          Was this page helpful?
        </label>
        <div id="vote-buttons" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Btn dir="up" />
          <Btn dir="down" />
        </div>

        <span
          role="status"
          aria-live="polite"
          tabIndex={-1}
          ref={statusRef}
          style={{
            marginLeft: 12,
            fontSize: '0.85rem',
            minHeight: 20,
            display: 'inline-block',
            color: submitted ? SMYTH_COLOR.successGreen : SMYTH_COLOR.accentDark,
            fontWeight: submitted ? 600 : 'normal',
            userSelect: 'none',
          }}
        >
          {submitted ? <><CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Thanks for the feedback ✓</> : status}
        </span>

        {/* Show form only if vote selected and NOT submitted */}
        {vote && !submitted && (
          <div style={{ marginTop: 16, animation: 'fadeIn 0.3s ease' }}>
            <label
              htmlFor="feedback-comment"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: SMYTH_COLOR.text }}
            >
              {commentLabel}
            </label>
            <textarea
              id="feedback-comment"
              ref={textareaRef}
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Your suggestions or comments"
              disabled={busy}
              style={{
                width: '100%',
                border: `1px solid ${SMYTH_COLOR.border}`,
                borderRadius: 8,
                padding: '0.6rem',
                fontSize: '0.85rem',
                resize: 'vertical',
                fontFamily: 'inherit',
                color: SMYTH_COLOR.text,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = SMYTH_COLOR.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = SMYTH_COLOR.border)}
            />
            <label
              htmlFor="feedback-email"
              style={{ display: 'block', marginTop: 12, marginBottom: 6, fontWeight: 600, color: SMYTH_COLOR.text }}
            >
              Your email (optional)
            </label>
            <input
              id="feedback-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={busy}
              style={{
                width: '100%',
                border: `1px solid ${SMYTH_COLOR.border}`,
                borderRadius: 8,
                padding: '0.5rem',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                color: SMYTH_COLOR.text,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = SMYTH_COLOR.accent)}
              onBlur={e => (e.currentTarget.style.borderColor = SMYTH_COLOR.border)}
            />
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              <button
                onClick={send}
                disabled={busy}
                style={{
                  background: busy ? SMYTH_COLOR.border : SMYTH_COLOR.accentDark,
                  color: '#fff',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 0.25s',
                }}
                onMouseEnter={e => {
                  if (!busy) e.currentTarget.style.backgroundColor = SMYTH_COLOR.accent;
                }}
                onMouseLeave={e => {
                  if (!busy) e.currentTarget.style.backgroundColor = SMYTH_COLOR.accentDark;
                }}
              >
                <Send size={16} /> {busy ? 'Sending…' : 'Send'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setStatus('Removing…');
                  const error = await removeFeedback();
                  setBusy(false);
                  if (!error) {
                    setVote(null);
                    setComment('');
                    setSubmitted(false);
                    cache(null, email);
                    setStatus('Feedback cleared');
                    statusRef.current?.focus();
                  } else {
                    setStatus('Error removing feedback');
                  }
                }}
                style={{
                  backgroundColor: SMYTH_COLOR.cancelBg,
                  border: `1px solid ${SMYTH_COLOR.cancelBorder}`,
                  color: SMYTH_COLOR.text,
                  padding: '0.45rem 1rem',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  transition: 'background-color 0.25s',
                }}
                onMouseEnter={e => {
                  if (!busy) e.currentTarget.style.backgroundColor = SMYTH_COLOR.cancelHoverBg;
                }}
                onMouseLeave={e => {
                  if (!busy) e.currentTarget.style.backgroundColor = SMYTH_COLOR.cancelBg;
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
