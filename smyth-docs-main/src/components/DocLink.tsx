import React from 'react';
import Link from '@docusaurus/Link';

interface Props {
  to: string;                 
  children: React.ReactNode;  
}

export default function DocLink({ to, children }: Props) {
  const external = /^https?:\/\//.test(to);
  return (
    <Link
      to={to}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      className="text-emerald-600 underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}
