'use client';

import { useEffect, useState } from 'react';
import styles from './EventProductShowcase.module.css';

interface EventInformationSectionsProps {
  contentHtml?: string;
  contentParagraphs?: string[];
  benefitItems: string[];
  participationSteps: string[];
  noticeItems: string[];
}

const SECTION_IDS = [
  'event-information-benefits',
  'event-information-participation',
  'event-information-notices',
] as const;

export default function EventInformationSections({
  contentHtml,
  contentParagraphs = [],
  benefitItems,
  participationSteps,
  noticeItems,
}: EventInformationSectionsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState([true, true, true]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const applyViewportState = (matches: boolean) => {
      setIsMobile(matches);
      setOpenSections(matches ? [true, false, false] : [true, true, true]);
    };
    const handleChange = (event: MediaQueryListEvent) => {
      applyViewportState(event.matches);
    };

    applyViewportState(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleSection = (index: number) => {
    if (!isMobile) return;

    setOpenSections(current =>
      current.map((isOpen, currentIndex) => (currentIndex === index ? !isOpen : isOpen)),
    );
  };

  const sections = [
    {
      title: '혜택 안내',
      content: (
        <>
          {contentHtml && (
            <div
              className={styles.eventContent}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}
          {contentParagraphs.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {benefitItems.length > 0 && (
            <ul>
              {benefitItems.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      title: '참여·사용 방법',
      content: (
        <ol>
          {participationSteps.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ),
    },
    {
      title: '유의사항',
      content: (
        <ul>
          {noticeItems.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <section className={styles.information} aria-label="이벤트 상세 정보">
      <div className={styles.informationGrid}>
        {sections.map((section, index) => {
          const panelId = `${SECTION_IDS[index]}-panel`;
          const buttonId = `${SECTION_IDS[index]}-button`;
          const isOpen = openSections[index];

          return (
            <article className={styles.informationSection} key={SECTION_IDS[index]}>
              <h2>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  disabled={!isMobile}
                  onClick={() => toggleSection(index)}
                >
                  <span>{section.title}</span>
                  <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
              </h2>
              <div
                id={panelId}
                className={styles.informationPanel}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
              >
                {section.content}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
