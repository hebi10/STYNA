import Link from "next/link";
import MainBanner from "./_components/MainBanner";
import ProductSection from "./_components/ProductSection";
import DynamicCategorySection from "./_components/DynamicCategorySection";
import { SITE_INFO } from "@/shared/constants/siteInfo";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <MainBanner />

      <section className={styles.curationStrip}>
        <div className={styles.sectionContainer}>
          <div className={styles.curationGrid}>
            <article className={styles.curationItem}>
              <p className={styles.sectionEyebrow}>오늘의 기획전</p>
              <h2>출근룩을 가볍게 완성하는 여름 셋업</h2>
              <p>
                구김이 덜한 셔츠, 차분한 슬랙스, 오래 걸어도 편한 로퍼를 한 번에 볼 수 있도록 묶었습니다.
              </p>
            </article>
            <article className={styles.curationItem}>
              <p className={styles.sectionEyebrow}>MD 기준</p>
              <h2>리뷰 4.7 이상 상품 우선</h2>
              <p>비침, 두께, 착용감처럼 사진만으로 놓치기 쉬운 기준을 함께 확인합니다.</p>
            </article>
            <article className={styles.curationItem}>
              <p className={styles.sectionEyebrow}>PORTFOLIO DEMO</p>
              <h2>혜택 안내 예시</h2>
              <p>신규 회원 쿠폰과 무료배송 혜택은 포트폴리오 데모용 안내입니다.</p>
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

      <section id="new-arrivals" className={styles.productBand}>
        <ProductSection
          className={styles.bandSection}
          eyebrow="NEW THIS WEEK"
          title="이번 주 신상"
          subtitle="이번 주 새로 입고된 데일리 셀렉션"
          type="new"
          maxItems={4}
          headerStyle="bordered"
          viewAllLink="/recommend?filter=new"
          viewAllLabel="전체보기"
        />
      </section>

      <section className={styles.mdNoteSection}>
        <div className={styles.sectionContainer}>
          <p className={styles.sectionEyebrow}>MD&apos;S NOTE</p>
          <div className={styles.noteGrid}>
            <h2 className={styles.noteTitle}>
              이번 주에는 단독으로 입기 좋은 상의와 가볍게 들 수 있는 백을 중심으로 골랐습니다.
            </h2>
            <p className={styles.noteText}>
              전체적으로 블랙, 아이보리, 실버 톤을 맞춰 출근룩과 주말룩에 모두 섞기 쉬운 상품을 우선 배치했습니다.
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
              현재 적용 가능한 혜택은 이벤트 페이지에서 확인하세요.
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
          title="이번 주 시즌오프"
          subtitle="리뷰 4.7 이상 상품을 중심으로 모은 일주일 특가"
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
            <h2>CUSTOMER CENTER</h2>
            <p>{SITE_INFO.supportPhone} · {SITE_INFO.supportHours}</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>CONTACT</h2>
            <p>{SITE_INFO.supportEmail}</p>
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
