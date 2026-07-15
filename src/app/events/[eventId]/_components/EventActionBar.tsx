import styles from './EventCommerceBlocks.module.css';

export interface EventActionSummaryItem {
  label: string;
  value: string;
}

interface EventActionBarProps {
  items: EventActionSummaryItem[];
  label: string;
  disabled?: boolean;
  onAction: () => void;
}

export default function EventActionBar({
  items,
  label,
  disabled = false,
  onAction,
}: EventActionBarProps) {
  return (
    <section className={styles.actionBar} aria-label="이벤트 혜택 및 참여">
      <ul className={styles.summaryList}>
        {items.slice(0, 3).map(item => (
          <li className={styles.summaryItem} key={`${item.label}-${item.value}`}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <strong className={styles.summaryValue}>{item.value}</strong>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.actionButton}
        disabled={disabled}
        onClick={onAction}
      >
        {label}
      </button>
    </section>
  );
}
