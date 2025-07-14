import React from 'react';
import styles from './Card.module.css';

type Props = {
  children: React.ReactNode;
};

export default function CardGrid({ children }: Props) {
  return <div className={styles.cardGrid}>{children}</div>;
}
