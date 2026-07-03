

import AdminEventList from "./_components/AdminEventList";
import styles from "../_components/AdminSimplePage.module.css";

export default function AdminEventsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>이벤트 관리</h1>
        <p className={styles.description}>이벤트를 생성, 수정, 삭제하고 참여 현황을 관리할 수 있습니다.</p>
      </div>
      
      <div className={styles.content}>
        <AdminEventList />
      </div>
    </div>
  );
}
