import React, { ReactNode, useState } from 'react';
import {
  Info,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

interface Props {
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  type: 'info' | 'warn' | 'tip' | 'success' | 'help';
}

const BaseCallout = ({
  type,
  title,
  children,
  collapsible = false,
  defaultOpen = false,
}: Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const typeStyles = {
    info: {
      icon: <Info size={20} style={{ color: '#2563eb', marginRight: 6 }} />,
      label: 'INFO',
      borderColor: '#2563eb',
    },
    warn: {
      icon: <AlertTriangle size={20} style={{ color: '#b45309', marginRight: 6 }} />,
      label: 'WARNING',
      borderColor: '#f59e0b',
    },
    tip: {
      icon: <Lightbulb size={20} style={{ color: '#059669', marginRight: 6 }} />,
      label: 'TIP',
      borderColor: '#34d399',
    },
   success: {
    icon: <CheckCircle size={20} style={{ color: '#0d9488', marginRight: 6 }} />,
    label: 'SUCCESS',
    borderColor: '#14b8a6',
},
help: {                                             
  icon: <HelpCircle size={20} style={{ color: '#6b7280', marginRight: 6 }} />,
  label: 'HELP',
  borderColor: '#6b7280',
},
  } as const;

  const { icon, label, borderColor } = typeStyles[type];

  const toggle = () => setIsOpen(prev => !prev);

  return (
    <div
      className={`final-callout callout-${type}`}
      style={{ borderLeft: `6px solid ${borderColor}` }}
    >
      <div
        className={`callout-header${collapsible ? ' callout-clickable' : ''}`}
        onClick={collapsible ? toggle : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {icon}
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginRight: 4,
            }}
          >
            {title || label}
          </span>
        </div>

        {collapsible && (
          <ChevronDown
            size={18}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out',
              marginTop: 1,
              opacity: 0.75,
            }}
          />
        )}
      </div>

      {collapsible && !isOpen && <div style={{ height: '10px' }} />}

      <div
        className="callout-body-wrapper"
        style={{
          maxHeight: !collapsible || isOpen ? 1000 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        <div className="callout-body">{children}</div>
      </div>

      <style>
        {`
          .final-callout {
            border-radius: 8px;
            margin: 24px 0;
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            font-size: 1rem;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            transition: all 0.3s ease-in-out;
          }

          .callout-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px 0 20px;
            transition: background-color 0.2s ease-in-out;
          }

          .callout-clickable { cursor: pointer; }
          .callout-clickable:hover { background-color: rgba(0, 0, 0, 0.025); }
          :root[data-theme='dark'] .callout-clickable:hover { background-color: rgba(255, 255, 255, 0.05); }

          .callout-body-wrapper { transition: max-height 0.3s ease-in-out; }
          .callout-body {
            padding: 12px 20px 16px 20px;
            font-size: 1.075rem;
            line-height: 1.6;
          }

          .callout-body code {
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.875em;
            color: #b45309;
            font-family: SFMono-Regular, Menlo, Consolas, monospace;
          }
          .callout-body > *:first-child { margin-top: 0; }
          .callout-body > *:last-child  { margin-bottom: 0; }

          :root[data-theme='light'] .callout-info    { background-color: #e0f2fe;  color: #0c0c0c; }
          :root[data-theme='dark']  .callout-info    { background-color: #1e3a8a22; color: #dbeafe; }

          :root[data-theme='light'] .callout-warn    { background-color: #fef3c7;  color: #78350f; }
          :root[data-theme='dark']  .callout-warn    { background-color: #78350f22; color: #fde68a; }

          :root[data-theme='light'] .callout-tip     { background-color: #d1fae5;  color: #065f46; }
          :root[data-theme='dark']  .callout-tip     { background-color: #065f4622; color: #bbf7d0; }

          :root[data-theme='light'] .callout-success { background-color: #ccfbf1; */ color: #065f46; }
          :root[data-theme='dark'] .callout-success { background-color: #0d948822; color: #99f6e4;  }
          :root[data-theme='dark']  .callout-body code { background-color: #334155; color: #fbbf24; }

          :root[data-theme='light'] .callout-help    { background-color: #f3f4f6;  color: #374151; }
          :root[data-theme='dark']  .callout-help    { background-color: #37415144; color: #d1d5db; }
          :root[data-theme='dark']  .callout-body code { background-color: #334155; color: #fbbf24; }
        `}
      </style>
    </div>
  );
};

export default BaseCallout;
