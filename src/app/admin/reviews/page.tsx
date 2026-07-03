
import AdminReviewList from "./_components/AdminReviewList";
import styles from "../_components/AdminSimplePage.module.css";

export default function AdminReviewsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>리뷰 관리</h1>
        <p className={styles.description}>고객 리뷰를 관리하고 모니터링할 수 있습니다.</p>
      </div>
      
      <div className={styles.content}>
        <AdminReviewList />
      </div>
    </div>
  );
}
