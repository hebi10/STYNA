import Link from 'next/link';
import MainBanner from './_components/MainBanner';
import ProductSection from './_components/ProductSection';
import DynamicCategorySection from './_components/DynamicCategorySection';
import FeaturedProducts from './_components/FeaturedProducts';
import StynaFilm from './_components/StynaFilm';
import StyleNowSection from './_components/style-now/StyleNowSection';
import PortfolioDemoSection from './_components/PortfolioDemoSection';
import styles from './page.module.css';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata = routeMetadata.home;

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.visuallyHidden}>STYNA 패션 쇼핑몰</h1>
      <MainBanner />

      <section className={styles.categorySection}>
        <div className={styles.sectionContainer}>
          <div className={styles.compactHeader}>
            <div>
              <h2 className={styles.sectionTitle}>카테고리</h2>
              <p className={styles.sectionDescription}>
                TOP, BOTTOM, SHOES, SPORTS 중심으로 일상 룩에 바로 곁들이기 좋은 상품만 노출합니다.
              </p>
            </div>
          </div>
          <DynamicCategorySection
            maxCategories={4}
            className={styles.categoryMoodGrid}
          />
        </div>
      </section>

      <FeaturedProducts
        sectionClassName={styles.productBand}
        viewAllLabel="전체보기"
      />

      <StynaFilm />

      <section id="new-arrivals" className={styles.productBand}>
        <ProductSection
          className={styles.bandSection}
          title="신상품"
          subtitle="이번 주 새로 등록된 상품"
          type="new"
          maxItems={4}
          headerStyle="bordered"
          viewAllLink="/recommend?filter=new"
          viewAllLabel="전체보기"
        />
      </section>

      <section id="best-ranking" className={styles.rankingBand}>
        <ProductSection
          className={styles.bandSection}
          title="베스트 랭킹"
          subtitle="등록된 리뷰 수를 기준으로 정렬한 상위 8개 상품"
          type="bestseller"
          maxItems={8}
          variant="ranking"
          headerStyle="bordered"
          viewAllLink="/recommend?filter=review"
          viewAllLabel="전체보기"
        />
      </section>

      <section id="sale-products" className={styles.productBand}>
        <ProductSection
          className={styles.bandSection}
          title="세일 상품"
          subtitle="현재 세일가가 등록된 상품"
          type="sale"
          maxItems={4}
          variant="sale"
          headerStyle="bordered"
          viewAllLink="/main/sale"
          viewAllLabel="전체보기"
        />
        <div className={styles.eventsEntry}>
          <Link href="/events" className={styles.eventsLink}>
            진행 중인 이벤트 보기
          </Link>
        </div>
      </section>
      
      <StyleNowSection />

      <PortfolioDemoSection />
    </div>
  );
}
