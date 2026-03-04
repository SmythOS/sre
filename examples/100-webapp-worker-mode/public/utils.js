// ── Utils: Pure functions — no DOM, no state ────────────────────────────────

const Utils = {
    /**
     * Strip 'job-' prefix and truncate to 7 chars for compact display.
     */
    shortId(jobId) {
        return jobId.replace('job-', '').substring(0, 7);
    },

    /**
     * Map a worker status string to a human-friendly label.
     */
    statusLabel(status) {
        const labels = {
            running: 'Running',
            waiting_for_input: 'Waiting',
            completed: 'Completed',
            failed: 'Failed',
            cancelled: 'Cancelled',
        };
        return labels[status] || status;
    },

    /**
     * Truncate a string to `max` characters, appending '...' if trimmed.
     */
    truncate(str, max) {
        return str.length > max ? str.substring(0, max) + '...' : str;
    },

    /**
     * Escape HTML special characters using the browser's own text node.
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Try to pretty-print a JSON string. Returns the original if parsing fails.
     */
    prettyJson(str) {
        try {
            return JSON.stringify(JSON.parse(str), null, 2);
        } catch {
            return str;
        }
    },
};

// ── Markdown configuration ──────────────────────────────────────────────────

marked.setOptions({
    breaks: true,
    gfm: true,
});
