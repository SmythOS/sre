import React, { ReactNode } from 'react';

export default function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="ml-6 list-decimal space-y-3 text-base text-gray-800 dark:text-gray-200">
      {React.Children.map(children, (child) => (
        <li className="[&>*]:pl-1">{child}</li>
      ))}
    </ol>
  );
}
