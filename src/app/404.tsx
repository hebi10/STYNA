import Link from "next/link";
import styles from "./404.module.css";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.floatingShapes}>
        <div className={styles.shape}></div>
        <div className={styles.shape}></div>
        <div className={styles.shape}></div>
        <div className={styles.shape}></div>
      </div>
      
      <div className={styles.content}>
        <div className={styles.illustration}></div>
        
        <div className={styles.errorNumber}>404</div>
        
        <h1 className={styles.title}>
          페이지를 찾을 수 없습니다
        </h1>
        
        <p className={styles.description}>
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.<br/>
          홈으로 돌아가서 다시 시도해보세요.
        </p>
        
        <div className={styles.actions}>
          <Link href="/" className={styles.homeButton}>
            홈으로 돌아가기
          </Link>
          
          <div className={styles.links}>
            <Link href="/main/sale" className={styles.link}>
              세일 상품 보기
            </Link>
            <span className={styles.separator}>|</span>
            <Link href="/recommend?filter=review" className={styles.link}>
              상품 보기
            </Link>
            <span className={styles.separator}>|</span>
            <Link href="/brand" className={styles.link}>
              브랜드 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
