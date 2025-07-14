// src/theme/DocItem/Layout/index.tsx

import React from "react";
import clsx from "clsx";
import { useWindowSize } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import DocItemPaginator from "@theme-original/DocItem/Paginator";
import DocVersionBanner from "@theme-original/DocVersionBanner";
import DocVersionBadge from "@theme-original/DocVersionBadge";
import DocItemFooter from "@theme-original/DocItem/Footer";
import DocItemTOCMobile from "@theme-original/DocItem/TOC/Mobile";
import DocItemTOCDesktop from "@theme-original/DocItem/TOC/Desktop";
import DocItemContent from "@theme-original/DocItem/Content";
import DocBreadcrumbs from "@theme-original/DocBreadcrumbs";
import ContentVisibility from "@theme-original/ContentVisibility";
import PageFeedback from "@site/src/components/PageFeedback";
import DocsHelpPopup from '@site/src/components/DocsHelpPopup';

import styles from "./styles.module.css";

function useDocTOC() {
  const { frontMatter, toc } = useDoc();
  const windowSize = useWindowSize();

  const hidden = frontMatter.hide_table_of_contents;
  const canRender = !hidden && toc.length > 0;

  const mobile = canRender ? <DocItemTOCMobile /> : undefined;

  const desktop =
    canRender && (windowSize === "desktop" || windowSize === "ssr") ? (
      <DocItemTOCDesktop />
    ) : undefined;

  return {
    hidden,
    mobile,
    desktop,
  };
}

export default function DocItemLayout({ children }: React.PropsWithChildren<{}>) {
  const docTOC = useDocTOC();
  const { metadata } = useDoc();

  return (
    <>
      <DocsHelpPopup />
      <div className="row">
        {/* Main content column */}
        <div className={clsx("col", !docTOC.hidden && styles.docItemCol)}>
          <ContentVisibility metadata={metadata} />
          <DocVersionBanner />
          <div className={styles.docItemContainer}>
            <article>
              <DocBreadcrumbs />
              <DocVersionBadge />
              {docTOC.mobile}
              <DocItemContent>{children}</DocItemContent>
              <DocItemPaginator />
              <PageFeedback />
              <DocItemFooter />
            </article>
          </div>
        </div>

        {/* Right sidebar (desktop TOC) */}
        {docTOC.desktop && (
          <div className="col col--3">
            {docTOC.desktop}
          </div>
        )}
      </div>
    </>
  );
}
