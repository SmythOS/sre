import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import SvgStudio from './icons/SvgStudio';
import SvgWeaver from './icons/SvgWeaver';
import SvgRuntime from './icons/SvgRuntime';
import SvgDeployments from './icons/SvgDeployments';
import SvgCollaboration from './icons/SvgCollaboration';
import SvgTemplates from './icons/SvgTemplates';

const DOCS_SUBMENU = [
  { label: 'Studio', href: '/docs/agent-studio/overview', Icon: SvgStudio },
  { label: 'Weaver', href: '/docs/agent-weaver/overview', Icon: SvgWeaver },
  { label: 'Runtime', href: '/docs/agent-runtime/overview', Icon: SvgRuntime },
  { label: 'Deployments', href: '/docs/agent-deployments/overview', Icon: SvgDeployments },
  { label: 'Collaboration', href: '/docs/agent-collaboration/overview', Icon: SvgCollaboration },
  { label: 'Templates', href: '/docs/agent-templates/overview', Icon: SvgTemplates },
];

export default function HeaderSubmenu() {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const history = useHistory();
  const { pathname } = useLocation();

  useEffect(() => {
    // Find the active item based on the current path
    const currentItem = DOCS_SUBMENU.find(item => pathname.startsWith(item.href));
    if (currentItem) {
      setActiveItem(currentItem.href);
    } else if (pathname === '/docs' || pathname === '/docs/') {
      // Set Studio as active when on docs root
      setActiveItem('/docs/agent-studio/overview');
    }
  }, [pathname]);

  const handleClick = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    history.push(href);
  };

  return (
    <div className="header-submenu-container">
      <nav className="header-submenu-nav">
      <ul>
  {DOCS_SUBMENU.map((item, idx) => (
    <li key={`submenu-${item.label}-${item.href}-${idx}`} className={activeItem === item.href ? 'active' : ''}>
      <a href={item.href} onClick={handleClick(item.href)}>
        <item.Icon width={16} height={16} />
        <span>{item.label}</span>
      </a>
    </li>
  ))}
</ul>
      </nav>
    </div>
  );
}
