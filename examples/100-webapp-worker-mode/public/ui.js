// ── UI: All DOM creation and manipulation — stateless ────────────────────────
//
// Every function here takes explicit arguments (DOM elements, data) and returns
// created elements when needed. No streaming state is tracked here — that lives
// in app.js.

const UI = {
    _messagesEl: null,
    _jobsListEl: null,

    /**
     * Store references to the root DOM containers.
     * Call once at startup.
     */
    init({ messagesEl, jobsListEl }) {
        UI._messagesEl = messagesEl;
        UI._jobsListEl = jobsListEl;
    },

    // ── Chat Area ────────────────────────────────────────────────────────────

    /**
     * Append a simple message (user, error, etc.) to the chat.
     */
    addMessage(role, text) {
        const el = document.createElement('div');
        el.className = `message ${role}`;
        el.textContent = text;
        UI._messagesEl.appendChild(el);
        UI.scrollToBottom();
        return el;
    },

    /**
     * Create a new assistant message block with label, flow container, and cursor.
     *
     * Returns { wrapper, flow } so the caller can track them as state.
     *
     * DOM structure:
     *   .message.assistant[.surfaced|.surfaced-question]
     *     .label           "Assistant" / "Assistant - Job Report" / etc.
     *     .flow
     *       span.cursor
     */
    createAssistantBlock(surfacedType) {
        const wrapper = document.createElement('div');
        let cssClass = 'message assistant';
        let labelText = 'Assistant';

        if (surfacedType === 'question') {
            cssClass += ' surfaced-question';
            labelText = 'Assistant - Job Question';
        } else if (surfacedType === 'result') {
            cssClass += ' surfaced';
            labelText = 'Assistant - Job Report';
        }

        wrapper.className = cssClass;

        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = labelText;

        const flow = document.createElement('div');
        flow.className = 'flow';

        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        flow.appendChild(cursor);

        wrapper.appendChild(label);
        wrapper.appendChild(flow);
        UI._messagesEl.appendChild(wrapper);
        UI.scrollToBottom();

        return { wrapper, flow };
    },

    /**
     * Create a new content div inside a flow container (inserted before the cursor).
     * Returns the created div so the caller can write text into it.
     */
    createContentBlock(flowEl) {
        const div = document.createElement('div');
        div.className = 'content';

        const cursor = flowEl.querySelector('.cursor');
        flowEl.insertBefore(div, cursor);
        return div;
    },

    /**
     * Build and insert an expandable tool pill into the flow.
     * Returns the pill element so the caller can track it for later resolution.
     *
     * DOM structure:
     *   .tool-pill
     *     .tool-pill-header       ← clickable to toggle details
     *       .tool-icon            spinner (replaced by checkmark on resolve)
     *       .tool-name
     *       .tool-args-preview    truncated args
     *       .tool-pill-chevron    ▶ / ▼
     *     .tool-pill-details      ← hidden by default
     *       .tool-detail-section  "Arguments" + <pre>
     *       .tool-detail-section  "Result" + <pre>
     */
    insertToolPill(flowEl, name, args) {
        const pill = document.createElement('div');
        pill.className = 'tool-pill';

        // ── Header ──
        const header = document.createElement('div');
        header.className = 'tool-pill-header';

        const icon = document.createElement('span');
        icon.className = 'tool-icon';
        icon.innerHTML = '<span class="tool-spinner"></span>';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tool-name';
        nameSpan.textContent = name;

        header.appendChild(icon);
        header.appendChild(nameSpan);

        if (args) {
            const argsStr = typeof args === 'object' ? Object.values(args).join(', ') : String(args);
            if (argsStr.length > 0) {
                const preview = document.createElement('span');
                preview.className = 'tool-args-preview';
                preview.textContent = Utils.truncate(argsStr, 60);
                header.appendChild(preview);
            }
        }

        const chevron = document.createElement('span');
        chevron.className = 'tool-pill-chevron';
        chevron.textContent = '▶';
        header.appendChild(chevron);

        // ── Details (hidden by default) ──
        const details = document.createElement('div');
        details.className = 'tool-pill-details';

        // Arguments section
        const argsSection = document.createElement('div');
        argsSection.className = 'tool-detail-section';
        const argsLabel = document.createElement('div');
        argsLabel.className = 'tool-detail-label';
        argsLabel.textContent = 'Arguments';
        const argsPre = document.createElement('pre');
        argsPre.className = 'tool-detail-content';
        argsPre.textContent = args
            ? (typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args))
            : '(none)';
        argsSection.appendChild(argsLabel);
        argsSection.appendChild(argsPre);
        details.appendChild(argsSection);

        // Result section (placeholder — populated on resolve)
        const resultSection = document.createElement('div');
        resultSection.className = 'tool-detail-section tool-detail-result';
        const resultLabel = document.createElement('div');
        resultLabel.className = 'tool-detail-label';
        resultLabel.textContent = 'Result';
        const resultPre = document.createElement('pre');
        resultPre.className = 'tool-detail-content';
        resultPre.textContent = '(pending...)';
        resultSection.appendChild(resultLabel);
        resultSection.appendChild(resultPre);
        details.appendChild(resultSection);

        // Toggle
        header.addEventListener('click', () => {
            const isOpen = pill.classList.toggle('open');
            chevron.textContent = isOpen ? '▼' : '▶';
        });

        pill.appendChild(header);
        pill.appendChild(details);

        const cursor = flowEl.querySelector('.cursor');
        flowEl.insertBefore(pill, cursor);

        return pill;
    },

    /**
     * Mark a tool pill as resolved: swap spinner → checkmark, fill result data.
     */
    resolveToolPill(pill, result) {
        const icon = pill.querySelector('.tool-icon');
        if (icon) {
            icon.innerHTML = '<span class="tool-check">&#10003;</span>';
        }

        const resultPre = pill.querySelector('.tool-detail-result .tool-detail-content');
        if (resultPre) {
            resultPre.textContent = result ? Utils.prettyJson(result) : '(no data)';
        }
    },

    /**
     * Remove the blinking cursor from a message block.
     */
    removeCursor(messageEl) {
        if (!messageEl) return;
        const cursor = messageEl.querySelector('.cursor');
        if (cursor) cursor.remove();
    },

    /**
     * Render raw markdown text into a content element.
     */
    renderMarkdown(el, rawText) {
        if (!el || !rawText) return;
        el.innerHTML = marked.parse(rawText);
    },

    /**
     * Scroll the messages container to the bottom.
     */
    scrollToBottom() {
        UI._messagesEl.scrollTop = UI._messagesEl.scrollHeight;
    },

    // ── Sidebar: Worker Jobs ─────────────────────────────────────────────────

    /**
     * Create and prepend a new job card to the sidebar.
     */
    addJobCard(jobId, task) {
        const empty = UI._jobsListEl.querySelector('.empty-state');
        if (empty) empty.remove();

        const card = document.createElement('div');
        card.className = 'job-card running';
        card.id = `job-${jobId}`;

        card.innerHTML = `
            <div class="job-header">
                <span class="job-id">${Utils.shortId(jobId)}</span>
                <span class="job-status running"><span class="job-spinner"></span> Running</span>
            </div>
            <div class="job-task">${Utils.escapeHtml(task)}</div>
            <div class="job-updates"></div>
        `;

        UI._jobsListEl.prepend(card);
    },

    /**
     * Update a job card's status badge and CSS class.
     */
    updateJobStatus(jobId, status) {
        const card = document.getElementById(`job-${jobId}`);
        if (!card) return;

        card.className = `job-card ${status}`;

        const badge = card.querySelector('.job-status');
        if (badge) {
            badge.className = `job-status ${status}`;
            const isActive = status === 'running' || status === 'waiting_for_input';
            badge.innerHTML = (isActive ? '<span class="job-spinner"></span> ' : '') + Utils.statusLabel(status);
        }
    },

    /**
     * Append a timestamped update line to a job card.
     */
    addJobUpdate(jobId, text, cssClass) {
        const card = document.getElementById(`job-${jobId}`);
        if (!card) return;

        const updates = card.querySelector('.job-updates');
        if (!updates) return;

        const el = document.createElement('div');
        el.className = `job-update${cssClass ? ' ' + cssClass : ''}`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `[${time}] ${text}`;

        updates.appendChild(el);
    },
};
