import React, { useState, type ReactElement } from 'react';

type Tab = {
  label: string;
  content: ReactElement;
  id?: string;
};

interface Props {
  tabs: Tab[];
  defaultIndex?: number;
  className?: string;
}

export default function Tabs({ tabs, defaultIndex = 0, className }: Props) {
  const [index, setIndex] = useState(defaultIndex);

  return (
    <div className={`tabs-container ${className ?? ''}`}>
      <div className="tab-header">
        {tabs.map((tab, i) => (
          <button
            key={tab.id ?? tab.label}
            className={`tab-button ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div key={tabs[index].label} className="tab-content">
      {tabs[index].content}
      </div>


      <style>{`
        .tabs-container {
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          margin: 1rem 0;
          font-family: system-ui, sans-serif;
        }

        .tab-header {
          display: flex;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab-button {
          padding: 10px 16px;
          font-size: 0.875rem;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
          color: #4b5563;
        }

        .tab-button:hover {
          background: #f3f4f6;
        }

        .tab-button.active {
          background: #e0e7ff;
          color: #1e40af;
        }

        .tab-content {
          padding: 20px 24px;
          font-size: 0.95rem;
          line-height: 1.6;
          color: #111827;
          background-color: #ffffff;
        }

        .tab-content h3 {
          font-size: 1.25rem;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .tab-content p {
          margin: 0.5em 0;
        }

        .tab-content ul {
          padding-left: 1.2em;
          margin-top: 0.5rem;
        }

        .tab-content strong {
          font-weight: 600;
          color: #1f2937;
        }

        .tab-content code {
          font-family: SFMono-Regular, Consolas, Menlo, monospace;
          background-color: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.85em;
          color: #b45309;
        }

        :root[data-theme='dark'] .tabs-container {
          background: #1e293b;
          border-color: #334155;
          color: #e2e8f0;
        }

        :root[data-theme='dark'] .tab-header {
          background: #0f172a;
          border-bottom-color: #334155;
        }

        :root[data-theme='dark'] .tab-button {
          color: #cbd5e1;
        }

        :root[data-theme='dark'] .tab-button:hover {
          background: #1e293b;
        }

        :root[data-theme='dark'] .tab-button.active {
          background: #334155;
          color: #ffffff;
        }

        :root[data-theme='dark'] .tab-content {
          background-color: #1e293b;
          color: #e2e8f0;
        }

        :root[data-theme='dark'] .tab-content strong {
          color: #f8fafc;
        }

        :root[data-theme='dark'] .tab-content code {
          background-color: #334155;
          color: #fbbf24;
        }
      `}</style>
    </div>
  );
}
