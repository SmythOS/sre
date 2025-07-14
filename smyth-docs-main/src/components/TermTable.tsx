import { ReactNode } from 'react';

export default function TermTable({ children }: { children: ReactNode }) {
  return (
    <table className="my-6 w-full border dark:border-slate-700">
      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">{children}</tbody>
    </table>
  );
}
