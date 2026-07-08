import Link from "next/link";
import MainBanner from "./_components/MainBanner";
import ProductSection from "./_components/ProductSection";
import DynamicCategorySection from "./_components/DynamicCategorySection";
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
              <p className={styles.sectionEyebrow}>혜택</p>
              <h2>07.14까지 무료배송</h2>
              <p>신규 회원 10% 쿠폰과 3만원 이상 무료배송 혜택을 함께 적용합니다.</p>
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
          subtitle="최근 7일간 리뷰 수와 장바구니 저장 수를 기준으로 집계했습니다."
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
              <p className={styles.sectionEyebrow}>REVIEW HIGHLIGHT</p>
              <h2 className={styles.sectionTitle}>이번 주 고객 리뷰</h2>
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
            <p className={styles.sectionEyebrow}>SEASON EVENT</p>
            <h2 className={styles.saleNoticeTitle}>7월 멤버십 위크</h2>
            <p className={styles.saleNoticeText}>
              신규 회원 10% 쿠폰과 무료배송 쿠폰을 07.14까지 함께 지급합니다.
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
            <p>평일 10:00 - 17:00, 점심 12:30 - 13:30, 주말 및 공휴일 휴무</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>BANK INFO</h2>
            <p>국민 000000-00-000000, 예금주 STYNA</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>RETURN / EXCHANGE</h2>
            <p>서울 성동구 성수이로 00, STYNA 물류센터. 교환 및 반품은 게시판 접수 후 진행됩니다.</p>
          </div>
          <div className={styles.serviceItem}>
            <h2>COMPANY</h2>
            <p>상호명 STYNA, 대표 박도영, 사업자등록번호 000-00-00000</p>
          </div>
        </div>
      </section>
    </div>
  );
}
