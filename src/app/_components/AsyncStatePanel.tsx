import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import styles from './AsyncStatePanel.module.css';

export type AsyncStateKind = 'loading' | 'error' | 'empty' | 'permission';

export type AsyncStateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

export interface AsyncStatePanelProps {
  kind: AsyncStateKind;
  title: string;
  description?: string;
  headingLevel?: 'h1' | 'h2';
  primaryAction?: AsyncStateAction;
  secondaryAction?: AsyncStateAction;
}

function StateAction({
  action,
  className,
}: {
  action: AsyncStateAction;
  className: string;
}) {
  if (typeof action.href === 'string') {
    return (
      <Link className={`${styles.action} ${className}`} href={action.href}>
        {action.label}
      </Link>
    );
  }

  return (
    <button className={`${styles.action} ${className}`} type="button" onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export default function AsyncStatePanel({
  kind,
  title,
  description,
  headingLevel = 'h2',
  primaryAction,
  secondaryAction,
}: AsyncStatePanelProps) {
  const liveProps: HTMLAttributes<HTMLElement> = kind === 'loading'
    ? { role: 'status', 'aria-live': 'polite', 'aria-busy': true }
    : kind === 'error'
      ? { role: 'alert' }
      : {};
  const hasActions = Boolean(primaryAction || secondaryAction);
  const Heading = headingLevel;

  return (
    <section className={styles.panel} {...liveProps}>
      {kind === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
      <div className={styles.content}>
        <Heading className={styles.title}>{title}</Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {hasActions && (
        <div className={styles.actions}>
          {primaryAction && (
            <StateAction action={primaryAction} className={styles.primaryAction} />
          )}
          {secondaryAction && (
            <StateAction action={secondaryAction} className={styles.secondaryAction} />
          )}
        </div>
      )}
    </section>
  );
}
