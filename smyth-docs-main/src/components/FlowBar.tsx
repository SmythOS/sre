import React from 'react';

type Props = { items: string[] };

export default function FlowBar({ items }: Props) {
  return (
    <div className="flex flex-wrap items-center">
      {items.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && (
            <span
              aria-hidden
              className="mx-[0.35em] inline-block translate-y-[.10em] text-[0.9em] font-semibold text-gray-800 dark:text-gray-200"
            >
              →
            </span>
          )}
          <span className="whitespace-nowrap">{label}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
