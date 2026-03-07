// ── App: SSE connection, streaming state machine, event routing ──────────────
//
// This file owns all streaming state and orchestrates the UI and Utils modules.
// It does NOT create DOM elements directly — that's UI's job.

// ── State ────────────────────────────────────────────────────────────────────

let clientId = null;
let eventSource = null;

let currentContentEl = null;  // the div.content currently being appended to
let currentRawText = '';      // raw markdown text accumulated for current content block
let currentMessageEl = null;  // the .message div wrapper
let currentFlowEl = null;     // the .flow container inside the wrapper
let surfacedType = null;      // null | 'result' | 'question'
let pendingTools = new Map(); // tool name → { pill, args }

// DOM refs (read once, passed to UI)
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');
const form = document.getElementById('input-form');

// ── Initialization ──────────────────────────────────────────────────────────

async function init() {
    UI.init({
        messagesEl: document.getElementById('messages'),
        jobsListEl: document.getElementById('jobs-list'),
    });

    const res = await fetch('/api/session', { method: 'POST' });
    const { clientId: id } = await res.json();
    clientId = id;

    eventSource = new EventSource(`/api/events/${clientId}`);

    // Chat stream events
    eventSource.addEventListener('message_start', onMessageStart);
    eventSource.addEventListener('content', onContent);
    eventSource.addEventListener('end', onEnd);
    eventSource.addEventListener('error', onSSEError);
    eventSource.addEventListener('tool_call', onToolCall);
    eventSource.addEventListener('tool_result', onToolResult);

    // Worker lifecycle events (sidebar)
    eventSource.addEventListener('worker_dispatched', onWorkerDispatched);
    eventSource.addEventListener('worker_status', onWorkerStatus);
    eventSource.addEventListener('worker_question', onWorkerQuestion);
    eventSource.addEventListener('worker_completed', onWorkerCompleted);
    eventSource.addEventListener('worker_failed', onWorkerFailed);
    eventSource.addEventListener('worker_cancelled', onWorkerCancelled);

    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
}

// ── Send Message ────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || !clientId) return;

    UI.addMessage('user', text);
    inputEl.value = '';
    setInputLocked(true);

    await fetch(`/api/chat/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
    });
});

// ── SSE Handlers: Chat Stream ───────────────────────────────────────────────

function onMessageStart(_e) {
    surfacedType = null;
    ensureAssistantBlock();
    setInputLocked(true);
}

function onContent(e) {
    const { content } = JSON.parse(e.data);

    if (!currentMessageEl) {
        surfacedType = 'result';
        ensureAssistantBlock();
        setInputLocked(true);
    }

    ensureContentBlock();
    currentRawText += content;
    UI.renderMarkdown(currentContentEl, currentRawText);
    UI.scrollToBottom();
}

function onEnd(_e) {
    sealContentBlock();
    UI.removeCursor(currentMessageEl);

    for (const [, entry] of pendingTools) {
        UI.resolveToolPill(entry.pill, null);
    }
    pendingTools.clear();

    currentContentEl = null;
    currentRawText = '';
    currentMessageEl = null;
    currentFlowEl = null;
    surfacedType = null;
    setInputLocked(false);
    UI.scrollToBottom();
}

function onSSEError(e) {
    let msg = 'Connection error';
    try {
        const data = JSON.parse(e.data);
        msg = data.error || msg;
    } catch {}

    UI.removeCursor(currentMessageEl);
    pendingTools.clear();
    currentContentEl = null;
    currentRawText = '';
    currentMessageEl = null;
    currentFlowEl = null;
    setInputLocked(false);

    UI.addMessage('error', msg);
}

function onToolCall(e) {
    const { name, arguments: args } = JSON.parse(e.data);
    ensureAssistantBlock();
    sealContentBlock();

    const pill = UI.insertToolPill(currentFlowEl, name, args);
    pendingTools.set(name, { pill, args });
    UI.scrollToBottom();
}

function onToolResult(e) {
    const { name, result } = JSON.parse(e.data);
    const entry = pendingTools.get(name);
    if (entry) {
        UI.resolveToolPill(entry.pill, result);
        pendingTools.delete(name);
    }
    UI.scrollToBottom();
}

// ── SSE Handlers: Worker Lifecycle (Sidebar) ────────────────────────────────

function onWorkerDispatched(e) {
    const { jobId, task } = JSON.parse(e.data);
    UI.addJobCard(jobId, task);
    UI.addJobUpdate(jobId, 'Dispatched', '');
}

function onWorkerStatus(e) {
    const { jobId, status } = JSON.parse(e.data);
    UI.updateJobStatus(jobId, status);
    UI.addJobUpdate(jobId, Utils.statusLabel(status), status);
}

function onWorkerQuestion(e) {
    const { jobId, question } = JSON.parse(e.data);
    UI.addJobUpdate(jobId, `Question: ${question}`, 'question');
    surfacedType = 'question';
}

function onWorkerCompleted(e) {
    const { jobId, result } = JSON.parse(e.data);
    UI.addJobUpdate(jobId, `Completed${result ? ': ' + result.substring(0, 80) + '...' : ''}`, 'completed');
}

function onWorkerFailed(e) {
    const { jobId, error } = JSON.parse(e.data);
    UI.addJobUpdate(jobId, `Failed: ${error}`, 'failed');
}

function onWorkerCancelled(e) {
    const { jobId } = JSON.parse(e.data);
    UI.addJobUpdate(jobId, 'Cancelled', '');
}

// ── State Helpers ───────────────────────────────────────────────────────────
//
// These manage the streaming state machine — which assistant block is active,
// which content block is being written to, etc.

function ensureAssistantBlock() {
    if (currentMessageEl) return;

    const { wrapper, flow } = UI.createAssistantBlock(surfacedType);
    currentMessageEl = wrapper;
    currentFlowEl = flow;
    currentContentEl = null;
    currentRawText = '';
}

function ensureContentBlock() {
    if (currentContentEl) return;
    if (!currentFlowEl) return;

    currentContentEl = UI.createContentBlock(currentFlowEl);
    currentRawText = '';
}

function sealContentBlock() {
    if (!currentContentEl) return;
    currentContentEl = null;
    currentRawText = '';
}

/**
 * Lock/unlock the send button while the assistant is streaming.
 * The input field stays enabled so the user can type ahead.
 */
function setInputLocked(locked) {
    sendBtn.disabled = locked;
}

// ── Boot ────────────────────────────────────────────────────────────────────

init();
