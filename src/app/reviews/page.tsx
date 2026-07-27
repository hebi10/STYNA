import PageHeader from "@/app/_components/PageHeader";
import ReviewList from "./_components/ReviewList";
import { ReviewProvider } from "@/context/reviewProvider";
import styles from "./page.module.css";

export default function ReviewsPage() {
  return (
    <div className={styles.container}>
      <PageHeader
        title="리뷰"
        description="고객들의 생생한 후기를 확인해보세요"
        breadcrumb={[
          { label: '홈', href: '/' },
          { label: '리뷰' }
        ]}
      />
      
      <div className={styles.content}>
        <ReviewProvider>
          <ReviewList />
        </ReviewProvider>
      </div>
    </div>
  );
}
