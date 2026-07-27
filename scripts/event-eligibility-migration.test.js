const fs = require('node:fs');
const path = require('node:path');

const {
  KNOWN_REVIEW_EVENT_IDS,
  analyzeEventEligibility,
  main,
  planEventEligibilityPatch,
} = require('./event-eligibility-migration');

describe('event eligibility migration planner', () => {
  test('maps ordinary no-reward legacy events to none without mutating input', () => {
    const event = { id: 'season-sale', title: '시즌 세일' };

    const result = planEventEligibilityPatch(event);

    expect(result.patch).toMatchObject({
      eligibilityType: 'none',
      rewardType: 'none',
    });
    expect(result.requiresManualTargetProducts).toBe(false);
    expect(event).toEqual({ id: 'season-sale', title: '시즌 세일' });
  });

  test.each(['포토 리뷰 이벤트', '착용 후기 이벤트'])(
    'maps legacy review copy "%s" to review but blocks missing target products',
    (title) => {
      expect(planEventEligibilityPatch({ eventType: 'special', title })).toMatchObject({
        patch: { eligibilityType: 'review' },
        requiresManualTargetProducts: true,
      });
    }
  );

  test('does not classify spring preview as a review event', () => {
    expect(planEventEligibilityPatch({
      id: 'event-2026-02-spring-preview',
      eventType: 'new',
      title: '스프링 프리뷰',
    })).toMatchObject({
      patch: { eligibilityType: 'none', rewardType: 'none' },
      requiresManualTargetProducts: false,
    });
  });

  test.each(['.', '..', 'coupon/sub', '__reserved__', '가'.repeat(501)])(
    'blocks an invalid coupon document id from the proposed patch: %s',
    (rewardCouponId) => {
      expect(planEventEligibilityPatch({
        rewardType: 'coupon',
        rewardCouponId,
      })).toMatchObject({
        patch: { rewardType: 'coupon' },
        requiresManualRewardCoupon: true,
        requiresManualConfiguration: true,
      });
    },
  );

  test.each([
    'event-2026-02-knit-review',
    'event-2026-03-photo-review',
    'event-2026-05-best-review',
    'event-2026-07-summer-review',
  ])('maps known review event %s to review with a manual target warning', (id) => {
    expect(KNOWN_REVIEW_EVENT_IDS).toContain(id);
    expect(planEventEligibilityPatch({ id, title: '이벤트' })).toMatchObject({
      patch: { eligibilityType: 'review' },
      requiresManualTargetProducts: true,
    });
  });

  test('preserves valid configuration and normalizes target product ids', () => {
    expect(planEventEligibilityPatch({
      publicPolicyVerified: true,
      eligibilityType: 'delivered',
      rewardType: 'coupon',
      rewardCouponId: ' coupon-1 ',
      targetProducts: [' product-1 ', 'product-2', 'product-1'],
    })).toMatchObject({
      patch: {
        eligibilityType: 'delivered',
        rewardType: 'coupon',
        rewardCouponId: 'coupon-1',
        targetProducts: ['product-1', 'product-2'],
      },
      requiresManualTargetProducts: false,
      requiresManualConfiguration: false,
    });
  });

  test.each([
    ['an empty member', ['product-1', '']],
    ['a nested document path', ['product/child']],
    ['a dot segment', ['.']],
    ['a reserved id', ['__reserved__']],
    ['an oversized id', ['가'.repeat(501)]],
  ])('requires manual target correction for %s', (_name, targetProducts) => {
    const result = planEventEligibilityPatch({
      publicPolicyVerified: true,
      eligibilityType: 'purchase',
      rewardType: 'none',
      targetProducts,
    });

    expect(result.patch).not.toHaveProperty('targetProducts');
    expect(result.requiresManualTargetProducts).toBe(true);
    expect(result.requiresManualConfiguration).toBe(true);
    expect(result.reasons).toContain('invalid_target_products');
  });

  test.each([
    ['missing public verification', { publicPolicyVerified: undefined }],
    ['false public verification', { publicPolicyVerified: false }],
    ['missing eligibility type', { publicPolicyVerified: true, eligibilityType: undefined }],
    ['invalid reward type', { publicPolicyVerified: true, rewardType: ' points ' }],
  ])('keeps %s behind the manual configuration gate', (_name, overrides) => {
    expect(planEventEligibilityPatch({
      eligibilityType: 'none',
      rewardType: 'none',
      ...overrides,
    }).requiresManualConfiguration).toBe(true);
  });

  test.each(['purchase', 'delivered', 'review'])(
    'requires manual target products for %s evidence without product ids',
    (eligibilityType) => {
      expect(planEventEligibilityPatch({ eligibilityType })).toMatchObject({
        patch: { eligibilityType },
        requiresManualTargetProducts: true,
      });
    }
  );

  test('infers coupon rewards only from a non-empty legacy reward coupon id', () => {
    expect(planEventEligibilityPatch({ rewardCouponId: 'coupon-1' }).patch).toMatchObject({
      rewardType: 'coupon',
      rewardCouponId: 'coupon-1',
    });
    expect(planEventEligibilityPatch({ rewardCouponId: '   ' }).patch.rewardType).toBe('none');
  });

  test('reports conditional fields that a merge migration must delete', () => {
    const result = planEventEligibilityPatch({
      publicPolicyVerified: true,
      eligibilityType: 'none',
      rewardType: 'none',
      targetProducts: ['product-1'],
      rewardCouponId: 'coupon-1',
    });

    expect(result.patch).not.toHaveProperty('targetProducts');
    expect(result.patch).not.toHaveProperty('rewardCouponId');
    expect(result.deleteFields).toEqual(['targetProducts', 'rewardCouponId']);
    expect(result.requiresManualConfiguration).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'stale_target_products',
      'stale_reward_coupon_id',
    ]));
  });

  test('summarizes public verification and invalid target manual gates', async () => {
    const report = await analyzeEventEligibility({
      projectId: 'demo-project',
      db: {
        collection: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: [
              {
                id: 'verified-event',
                data: () => ({
                  publicPolicyVerified: true,
                  eligibilityType: 'none',
                  rewardType: 'none',
                }),
              },
              {
                id: 'unverified-event',
                data: () => ({ eligibilityType: 'none', rewardType: 'none' }),
              },
              {
                id: 'invalid-target-event',
                data: () => ({
                  publicPolicyVerified: true,
                  eligibilityType: 'purchase',
                  rewardType: 'none',
                  targetProducts: ['product/child'],
                }),
              },
            ],
          }),
        })),
      },
    });

    expect(report).toMatchObject({
      eventCount: 3,
      manualTargetProductCount: 1,
      manualPublicPolicyVerificationCount: 1,
      manualConfigurationCount: 2,
    });
  });

  test('rejects execute mode before loading any migration runtime', async () => {
    await expect(main(['--execute'])).rejects.toThrow(
      'Event eligibility migration is dry-run only.'
    );
  });

  test('exposes only the read-only analyzer through the package script', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    );

    expect(packageJson.scripts['migrate:events:eligibility:dry-run']).toBe(
      'node scripts/event-eligibility-migration.js analyze'
    );
    expect(JSON.stringify(packageJson.scripts)).not.toMatch(
      /migrate:events:eligibility:(?:execute|write)/
    );
  });
});
