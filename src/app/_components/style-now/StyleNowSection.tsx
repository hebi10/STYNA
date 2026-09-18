import Image from 'next/image';
import Link from 'next/link';
import { STYLE_NOW_SEASONS } from './styleNowData';
import styles from './StyleNowSection.module.css';

export default function StyleNowSection() {
  return (
    <section className={styles.section} aria-labelledby="style-now-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <div className={styles.titleBlock}>
            <p className={styles.kicker}>STYLE NOW</p>
            <h2 id="style-now-title">스타일나우</h2>
          </div>
          <div className={styles.headerCopy}>
            <p className={styles.headerLead}>
              지금 계절에 어울리는 스타일을 시즌별 무드와 함께 살펴보세요.
            </p>
            <p className={styles.headerSubcopy}>
              화보와 대표 상품을 연결해 각 계절의 분위기를 한 장면처럼 구성했습니다.
            </p>
          </div>
        </header>

        <div className={styles.seasonGrid}>
          {STYLE_NOW_SEASONS.map((season, index) => (
            <Link
              key={season.key}
              href={`/style-now/${season.key}`}
              className={styles.seasonCard}
              aria-label={`${season.label} 스타일 보러 가기`}
            >
              <div className={styles.cardImageFrame}>
                <Image
                  src={season.categoryImage.localPath}
                  alt={season.categoryImage.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 25vw"
                  className={styles.cardImage}
                />
              </div>
              <div className={styles.cardContent}>
                <div className={styles.cardHeading}>
                  <span className={styles.cardIndex}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.cardSeason}>{season.label}</span>
                  <span className={styles.cardAction} aria-hidden="true">
                    VIEW →
                  </span>
                </div>
                <p>{season.homeDescription ?? season.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
