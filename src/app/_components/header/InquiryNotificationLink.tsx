import Link from "next/link";

interface InquiryNotificationLinkProps {
  isAdmin: boolean;
  className: string;
  onNavigate?: () => void;
}

export default function InquiryNotificationLink({
  isAdmin,
  className,
  onNavigate,
}: InquiryNotificationLinkProps) {
  const href = isAdmin
    ? "/admin/inquiries?filter=unread"
    : "/cs/inquiry?tab=list";
  const label = isAdmin ? "새 고객 문의 확인" : "새 문의 답변 확인";

  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      onClick={onNavigate}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
    </Link>
  );
}
