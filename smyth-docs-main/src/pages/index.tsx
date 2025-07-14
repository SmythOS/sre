import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Head from '@docusaurus/Head';
import styles from './index.module.css';

/** ----------  Hero header  ---------- */
function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>

        <div className={styles.buttons}>
         <Link className="button button--secondary button--lg" to="/docs/">
         Docs - Start Here ⏱️
         </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.ReactElement {
  const {siteConfig} = useDocusaurusContext();

  return (
    <>
      {/* page-level <head> */}
      <Head>
        <title>{`Hello from ${siteConfig.title}`}</title>
        <meta
          name="description"
          content="Description will go into a meta tag in <head />"
        />
      </Head>

      <Layout>
        <HomepageHeader />
        <main>
          <HomepageFeatures />
        </main>
      </Layout>
    </>
  );
}