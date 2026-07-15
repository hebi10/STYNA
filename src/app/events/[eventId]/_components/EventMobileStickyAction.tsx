import styles from './EventCommerceBlocks.module.css';

interface EventMobileStickyActionProps {
  statusLabel: string;
  label: string;
  disabled?: boolean;
  onAction: () => void;
}

export default function EventMobileStickyAction({
  statusLabel,
  label,
  disabled = false,
  onAction,
}: EventMobileStickyActionProps) {
  return (
    <aside className={styles.mobileStickyAction} aria-label="이벤트 핵심 행동">
      <span className={styles.mobileStatus}>{statusLabel}</span>
      <button
        type="button"
        className={styles.mobileActionButton}
        disabled={disabled}
        onClick={onAction}
      >
        {label}
      </button>
    </aside>
  );
}
