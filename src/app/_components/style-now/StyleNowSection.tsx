import Image from 'next/image';
import Link from 'next/link';
import { STYLE_NOW_SEASONS } from './styleNowData';
import styles from './StyleNowSection.module.css';

export default function StyleNowSection() {
  return (
    <section className={styles.section} aria-labelledby="style-now-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <p className={styles.kicker}>STYLE NOW</p>
          <div className={styles.sectionHeading}>
            <h2 id="style-now-title">스타일나우</h2>
            <p>
              계절을 선택해 모델 화보와 대표 상품, 지금 입기 좋은
              스타일을 한 화면에서 살펴보세요.
            </p>
          </div>
        </header>

        <div className={styles.seasonGrid}>
          {STYLE_NOW_SEASONS.map((season) => (
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
                <span className={styles.cardSeason}>{season.label}</span>
                <p>{season.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
