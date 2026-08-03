const {
  buildPublicationPlan,
  deserializeBackupValue,
  parseExpectedPublic,
  parsePublicationCommand,
  publishPublication,
  rollbackPublication,
  serializeBackupValue,
  stagePublication,
} = require('./event-publication');
const {
  PUBLICATION_VERSION,
  buildPublicationManifest,
} = require('./event-publication-manifest');
const imageDecisions = require('./event-publication-image-decisions.json');

function createPlan() {
  return {
    version: PUBLICATION_VERSION,
    documents: Array.from({ length: 32 }, (_, index) => ({
      id: index < 22 ? `legacy-${index + 1}` : `new-${index - 21}`,
      source: index < 22 ? 'legacy' : 'new',
      data: {
        title: `이벤트 ${index + 1}`,
        publicationVersion: PUBLICATION_VERSION,
        publicPolicyVerified: false,
        isActive: true,
      },
      deleteFields: index < 22 ? ['couponCode'] : [],
    })),
  };
}

function createRuntime(documents = {}) {
  const writes = [];
  const backups = [];
  return {
    projectId: 'hebimall',
    writes,
    backups,
    async readEvents(ids) {
      return ids.map(id => ({ id, data: documents[id] || null }));
    },
    async commitWrites(nextWrites) {
      writes.push(...nextWrites);
    },
    async writeBackup(filePath, backup) {
      backups.push({ filePath, backup });
    },
  };
}

describe('event publication CLI safety', () => {
  test('명시적으로 지원하는 명령만 허용한다', () => {
    for (const command of ['analyze', 'stage', 'verify', 'publish', 'rollback']) {
      expect(parsePublicationCommand([command])).toBe(command);
    }
    expect(() => parsePublicationCommand(['delete'])).toThrow('지원하지 않는 명령');
  });

  test('verify 공개 상태 플래그는 true와 false만 허용한다', () => {
    expect(parseExpectedPublic({})).toBe(false);
    expect(parseExpectedPublic({ 'expect-public': 'false' })).toBe(false);
    expect(parseExpectedPublic({ 'expect-public': 'true' })).toBe(true);
    expect(() => parseExpectedPublic({ 'expect-public': 'yes' }))
      .toThrow(/expect-public/);
  });

  test('Timestamp marker를 포함한 백업 값을 손실 없이 직렬화한다', () => {
    const timestamp = {
      toDate: () => new Date('2026-07-31T00:00:00.000Z'),
    };
    const serialized = serializeBackupValue({
      startDate: timestamp,
      nested: [{ endDate: timestamp }],
    });

    expect(serialized).toEqual({
      startDate: { __type: 'timestamp', value: '2026-07-31T00:00:00.000Z' },
      nested: [{
        endDate: { __type: 'timestamp', value: '2026-07-31T00:00:00.000Z' },
      }],
    });
    expect(deserializeBackupValue(serialized, value => `timestamp:${value}`)).toEqual({
      startDate: 'timestamp:2026-07-31T00:00:00.000Z',
      nested: [{ endDate: 'timestamp:2026-07-31T00:00:00.000Z' }],
    });
  });

  test('stage는 백업 후 32개 문서를 모두 비공개 상태로 기록한다', async () => {
    const runtime = createRuntime(Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => [
        `legacy-${index + 1}`,
        { title: `기존 ${index + 1}`, publicPolicyVerified: false },
      ]),
    ));

    const plan = createPlan();
    plan.documents.find(document => document.source === 'new').deleteFields = [
      'targetCategories',
    ];
    const result = await stagePublication(runtime, plan, 'backup.json');

    expect(result).toMatchObject({ staged: 32, verifiedTrue: 0 });
    expect(runtime.backups).toHaveLength(1);
    expect(runtime.backups[0].backup.documents).toHaveLength(22);
    expect(runtime.writes).toHaveLength(32);
    expect(runtime.writes.every(write => (
      write.data.publicPolicyVerified === false
    ))).toBe(true);
    expect(runtime.writes.find(write => write.id === 'new-1').deleteFields).toEqual([]);
  });

  test('publish는 완전히 일치하는 stage와 명시 확인이 있을 때만 공개한다', async () => {
    const plan = createPlan();
    const current = Object.fromEntries(
      plan.documents.map(document => [document.id, document.data]),
    );
    const runtime = createRuntime(current);

    await expect(publishPublication(runtime, plan, {
      confirmProject: 'other-project',
      confirmCount: 32,
    })).rejects.toThrow(/프로젝트 확인/);
    expect(runtime.writes).toHaveLength(0);

    const result = await publishPublication(runtime, plan, {
      confirmProject: 'hebimall',
      confirmCount: 32,
    });
    expect(result).toEqual({ published: 32 });
    expect(runtime.writes).toHaveLength(32);
    expect(runtime.writes.every(write => (
      write.data.publicPolicyVerified === true
    ))).toBe(true);
  });

  test('재검증 계획은 이미 stage된 신규 문서의 createdAt을 보존한다', async () => {
    const manifest = buildPublicationManifest();
    const runtime = {
      projectId: 'hebimall',
      bucketName: 'hebimall.firebasestorage.app',
      timestampNow: () => 'new-timestamp',
      timestampFromIso: value => value,
      async readEvents(ids) {
        return ids.map(id => {
          const event = manifest.events.find(item => item.id === id);
          return {
            id,
            data: event.source === 'new'
              ? {
                publicationVersion: PUBLICATION_VERSION,
                createdAt: 'preserved-timestamp',
              }
              : {},
          };
        });
      },
      async readProducts(ids) {
        return ids.map(id => ({ id, data: { status: 'active' } }));
      },
    };

    const plan = await buildPublicationPlan(runtime, manifest, imageDecisions);

    expect(
      plan.documents.find(document => document.source === 'new').data.createdAt,
    ).toBe('preserved-timestamp');
  });

  test('rollback은 신규 문서를 삭제하지 않고 비공개·비활성 상태로 보존한다', async () => {
    const runtime = createRuntime();
    const backup = {
      projectId: 'hebimall',
      version: PUBLICATION_VERSION,
      documents: [
        { id: 'legacy-1', data: { title: '복원', publicPolicyVerified: false } },
      ],
    };

    const result = await rollbackPublication(runtime, backup, ['new-1', 'new-2']);

    expect(result).toEqual({ restored: 1, disabledNew: 2, deleted: 0 });
    expect(runtime.writes).toContainEqual({
      id: 'new-1',
      merge: true,
      data: {
        publicPolicyVerified: false,
        isActive: false,
      },
      deleteFields: [],
    });
    expect(runtime.writes.every(write => write.operation !== 'delete')).toBe(true);
  });
});
