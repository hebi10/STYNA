import Link from "next/link";
import MainBanner from "./_components/MainBanner";
import ProductSection from "./_components/ProductSection";
import DynamicCategorySection from "./_components/DynamicCategorySection";
import FeaturedProducts from "./_components/FeaturedProducts";
import { SITE_INFO } from "@/shared/constants/siteInfo";
import { formatSignupBenefit } from "@/shared/constants/commercePolicy";
import styles from "./page.module.css";
import { routeMetadata } from "@/shared/constants/routeMetadata";

export const metadata = routeMetadata.home;

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.visuallyHidden}>STYNA 패션 쇼핑몰</h1>
      <MainBanner />

      <section className={styles.curationStrip}>
        <div className={styles.sectionContainer}>
          <div className={styles.curationGrid}>
            <article className={styles.curationItem}>
              <p className={styles.sectionEyebrow}>스타일 조합 안내</p>
              <h2>여름 셋업 조합</h2>
              <p>
                셔츠, 슬랙스, 로퍼를 함께 살펴보는 스타일 조합 예시입니다.
              </p>
            </article>
            <article className={styles.curationItem}>
                <p className={styles.sectionEyebrow}>상품 데이터</p>
                <h2>상품별 평점·리뷰 확인</h2>
                <p>평점과 리뷰 수는 각 상품에 현재 등록된 데이터를 기준으로 표시합니다.</p>
            </article>
            <article className={styles.curationItem}>
              <p className={styles.sectionEyebrow}>PORTFOLIO DEMO</p>
              <h2>현재 구현된 가입 혜택</h2>
              <p>{formatSignupBenefit()}. 실제 결제는 진행되지 않는 포트폴리오 데모입니다.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.categorySection}>
        <div className={styles.sectionContainer}>
          <div className={styles.compactHeader}>
            <div>
              <p className={styles.sectionEyebrow}>SHOP BY USE</p>
              <h2 className={styles.sectionTitle}>카테고리</h2>
              <p className={styles.sectionDescription}>
                TOP, BOTTOM, SHOES, SPORTS 중심으로 데일리 룩에 바로 쓰기 좋은 상품만 노출합니다.
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
        eyebrow="EDITOR'S SELECTION"
        viewAllLabel="전체보기"
      />

      <section id="new-arrivals" className={styles.productBand}>
        <ProductSection
          className={styles.bandSection}
          eyebrow="NEW THIS WEEK"
          title="신상품"
          subtitle="isNew로 표시된 상품"
          type="new"
          maxItems={4}
          headerStyle="bordered"
          viewAllLink="/recommend?filter=new"
          viewAllLabel="전체보기"
        />
      </section>

      <section className={styles.mdNoteSection}>
        <div className={styles.sectionContainer}>
          <p className={styles.sectionEyebrow}>편집 추천</p>
          <div className={styles.noteGrid}>
            <h2 className={styles.noteTitle}>
              상의와 가방을 함께 보는 스타일 조합
            </h2>
            <p className={styles.noteText}>
              블랙, 아이보리, 실버 톤 상품을 함께 확인할 수 있는 조합 예시입니다.
            </p>
          </div>
          <div className={styles.comboGrid}>
            <article>
              <span>01</span>
              <strong>화이트 셔츠 + 블랙 슬랙스</strong>
              <p>가장 실패 없는 출근 조합</p>
            </article>
            <article>
              <span>02</span>
              <strong>스니커즈 + 미니멀 백</strong>
              <p>주말 외출에 편한 데일리 조합</p>
            </article>
            <article>
              <span>03</span>
              <strong>실버 주얼리 + 베이지 니트</strong>
              <p>단순한 룩에 포인트 주기 좋은 조합</p>
            </article>
          </div>
        </div>
      </section>

      <section id="best-ranking" className={styles.rankingBand}>
        <ProductSection
          className={styles.bandSection}
          eyebrow="BEST RANKING"
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

      <section className={styles.reviewHighlight}>
        <div className={styles.sectionContainer}>
          <div className={styles.compactHeader}>
            <div>
              <p className={styles.sectionEyebrow}>PORTFOLIO DEMO</p>
              <h2 className={styles.sectionTitle}>스타일 코멘트 예시</h2>
              <p className={styles.sectionDescription}>
                아래 문구와 평점은 포트폴리오 데모용 예시이며 실제 고객 리뷰가 아닙니다.
              </p>
            </div>
          </div>
          <div className={styles.reviewGrid}>
            <article>
              <p>생각보다 탄탄해서 단독으로 입기 좋아요.</p>
              <span>베이직 코튼 셔츠 / 4.8</span>
            </article>
            <article>
              <p>출근용으로 들기 좋은데 내부 포켓이 실용적이에요.</p>
              <span>미니멀 숄더백 / 4.7</span>
            </article>
            <article>
              <p>오래 걸어도 발이 편해서 매일 신고 있습니다.</p>
              <span>클래식 스니커즈 / 4.6</span>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.saleNotice}>
        <div className={styles.saleNoticeInner}>
          <div>
            <p className={styles.sectionEyebrow}>PORTFOLIO DEMO</p>
            <h2 className={styles.saleNoticeTitle}>혜택 안내 예시</h2>
                <p className={styles.saleNoticeText}>
                  현재 적용 가능한 혜택은 이벤트 페이지에서 확인하세요. 검증 완료된 이벤트만 표시됩니다.
                </p>
          </div>
          <div className={styles.saleNoticeActions}>
            <Link href="/events" className={styles.promoButton}>
              진행 이벤트 보기
            </Link>
          </div>
        </div>
      </section>

      <section id="sale-products" className={styles.productBand}>
        <ProductSection
          className={styles.bandSection}
          eyebrow="SEASON OFF"
          title="할인 상품"
          subtitle="현재 할인가가 등록된 상품"
          type="sale"
          maxItems={4}
          variant="sale"
          headerStyle="bordered"
          viewAllLink="/main/sale"
          viewAllLabel="전체보기"
        />
      </section>

      <section className={styles.serviceInfo}>
        <div className={styles.serviceGrid}>
          <div className={styles.serviceItem}>
            <h2>PORTFOLIO CONTACT</h2>
            <p>{SITE_INFO.supportEmail} · 답변 시점은 보장하지 않습니다.</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>DEMO REFERENCE</h2>
            <p>{SITE_INFO.supportPhone} · {SITE_INFO.supportHours} 화면 구성용 참고</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>ORDER GUIDE</h2>
            <p>주문 및 쿠폰 적용 흐름은 데모 데이터로 확인할 수 있습니다.</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>PORTFOLIO</h2>
            <p>{SITE_INFO.demoNotice}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
