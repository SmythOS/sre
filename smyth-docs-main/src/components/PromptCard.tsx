import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface PromptCardProps {
  children: React.ReactNode;
  prompt: string;
  title?: string;
  tags?: string[];
  collapsible?: boolean;
  maxChars?: number;

}

const PromptCard = ({
  prompt,
  title,
  tags = [],
  collapsible = false,
  maxChars = 220,
}: PromptCardProps) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isLong = prompt.length > maxChars && collapsible;
  const displayText = !isLong || expanded ? prompt : `${prompt.slice(0, maxChars)}...`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="prompt-card-container">
      <div className="prompt-card-header">
        {title && <div className="prompt-card-title">{title}</div>}
        <button className="copy-btn" onClick={handleCopy} aria-label="Copy">
          {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
        </button>
      </div>

      {tags.length > 0 && (
        <div className="prompt-card-tags">
          {tags.map((tag, index) => (
            <span key={index} className="prompt-tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="prompt-card-content">
        {displayText}
        </div>

      {isLong && (
        <div className="toggle-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show more'}
        </div>
      )}

      <style>
  {`
    .prompt-card-container {
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      font-family: system-ui, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      position: relative;
      transition: all 0.3s ease;
      color: #1f2937;
    }

    .prompt-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .prompt-card-title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .prompt-card-tags {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }

    .prompt-tag {
      background: #eef2ff;
      color: #3730a3;
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .prompt-card-content {
      font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
      background: #f3f4f6;
      padding: 14px;
      border-radius: 8px;
      font-size: 0.95rem;
      color: #1f2937;
      overflow-x: auto;
      white-space: pre-wrap;
      line-height: 1.6;
      margin-bottom: 0;
    }

    .toggle-expand {
      margin-top: 10px;
      font-size: 0.85rem;
      color: #2563eb;
      cursor: pointer;
    }

    .copy-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #6b7280;
    }

    .copy-btn:hover {
      color: #374151;
    }

    :root[data-theme='dark'] .prompt-card-container {
      background-color: #1e293b;
      border-color: #334155;
      color: #e2e8f0;
    }

    :root[data-theme='dark'] .prompt-card-title,
    :root[data-theme='dark'] .toggle-expand {
      color: #e2e8f0;
    }

    :root[data-theme='dark'] .prompt-card-content {
      background: #111827;
      color: #f3f4f6;
    }

    :root[data-theme='dark'] .prompt-tag {
      background: #312e81;
      color: #c7d2fe;
    }

    :root[data-theme='dark'] .copy-btn {
      color: #cbd5e1;
    }

    :root[data-theme='dark'] .copy-btn:hover {
      color: #f1f5f9;
    }
  `}
</style>
  </div>
  );
};

export default PromptCard;
