import { ReactNode } from 'react';
export default function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className="my-4 grid gap-4 sm:grid-cols-2">{children}</div>;
}
