import React from 'react';
import clsx from 'clsx';
import { useThemeConfig } from '@docusaurus/theme-common';
import Logo from '../../Navbar/Logo';
import SearchBar from '@theme/SearchBar';
import CollapseButton from './CollapseButton';
import Content from './Content';
import styles from './styles.module.css';
import '@site/src/css/custom.css';

interface Props {
  path: string;
  sidebar: any;
  onCollapse: () => void;
  isHidden: boolean;
}

function DocSidebarDesktop({ path, sidebar, onCollapse, isHidden }: Props) {
  const {
    navbar: { hideOnScroll },
    docs: {
      sidebar: { hideable },
    },
  } = useThemeConfig();

  return (
    <div
      className={clsx(
        styles.sidebar,
        hideOnScroll && styles.sidebarWithHideableNavbar,
        isHidden && styles.sidebarHidden,
      )}
    >
      {hideOnScroll && <Logo />}
      <div className={styles.sidebarSearch}>
        <SearchBar />
      </div>
      <Content path={path} sidebar={sidebar} />
      {hideable && <CollapseButton onClick={onCollapse} />}
    </div>
  );
}

export default React.memo(DocSidebarDesktop);
