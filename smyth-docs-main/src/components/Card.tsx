import React, { PropsWithChildren } from "react";
import Link from "@docusaurus/Link";
import clsx from "clsx";
import styles from "./Card.module.css";

export interface CardProps {
  title: string;
  description: string;
  to: string;
}

export function CardGrid({ children }: PropsWithChildren<{}>) {
  return <div className={styles.cardGrid}>{children}</div>;
}

export function Card({ title, description, to }: CardProps) {
  return (
    <Link
      className={clsx("no-underline", styles.card)}
      to={to}
      aria-label={`Navigate to ${title}`}
    >
      <h3>{title}</h3>
      <p>{description}</p>
    </Link>
  );
}
