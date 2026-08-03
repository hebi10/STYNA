"use client";

import { useEffect, useState } from "react";
import { InquiryService } from "@/shared/services/inquiryService";

interface UseInquiryNotificationOptions {
  userId: string | null;
  isAdmin: boolean;
  enabled: boolean;
}

export function useInquiryNotification({
  userId,
  isAdmin,
  enabled,
}: UseInquiryNotificationOptions): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!enabled || !userId) {
      setHasUnread(false);
      return;
    }

    setHasUnread(false);
    return InquiryService.subscribeToUnreadInquiries(
      { audience: isAdmin ? "admin" : "customer", userId },
      setHasUnread,
      (error) => {
        console.error("문의 알림 구독 실패:", error);
        setHasUnread(false);
      },
    );
  }, [enabled, isAdmin, userId]);

  return hasUnread;
}
