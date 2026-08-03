import {
  addDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { InquiryService } from '../inquiryService';

type InquiryNotificationService = typeof InquiryService & {
  subscribeToUnreadInquiries: (
    options: { audience: 'admin' | 'customer'; userId: string },
    onChange: (hasUnread: boolean) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  markInquiriesRead: (
    inquiryIds: string[],
    audience: 'admin' | 'customer',
  ) => Promise<void>;
};

const notificationService = InquiryService as InquiryNotificationService;

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => ({ path: 'inquiries' })),
  doc: jest.fn(() => ({ path: 'inquiries/inquiry-1' })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value) => ({ type: 'limit', value })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => ({ kind: 'serverTimestamp' })),
  updateDoc: jest.fn(),
  where: jest.fn((field, operator, value) => ({
    type: 'where',
    field,
    operator,
    value,
  })),
  writeBatch: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));

describe('InquiryService notification payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a customer inquiry with only the admin notification unread', async () => {
    jest.mocked(addDoc).mockResolvedValue({ id: 'inquiry-1' } as never);

    await InquiryService.createInquiry(
      'owner-1',
      'owner@example.com',
      '작성자',
      { category: 'other', title: '문의', content: '문의 내용' },
    );

    expect(jest.mocked(addDoc).mock.calls[0][1]).toEqual({
      userId: 'owner-1',
      userEmail: 'owner@example.com',
      userName: '작성자',
      category: 'other',
      title: '문의',
      content: '문의 내용',
      status: 'waiting',
      unreadForAdmin: true,
      unreadForCustomer: false,
      createdAt: { kind: 'serverTimestamp' },
      updatedAt: { kind: 'serverTimestamp' },
    });
  });

  test('answers atomically and creates a customer notification', async () => {
    await InquiryService.answerInquiry('inquiry-1', {
      content: '답변 내용',
      answeredBy: '관리자',
    });

    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'answered',
      unreadForAdmin: false,
      unreadForCustomer: true,
    }));
  });

  test('maps legacy inquiry notification fields to read', async () => {
    jest.mocked(getDocs).mockResolvedValue({
      docs: [{
        id: 'legacy-1',
        data: () => ({
          userId: 'owner-1',
          category: 'other',
          title: '기존 문의',
          content: '기존 내용',
          status: 'waiting',
          createdAt: { toDate: () => new Date('2026-01-01') },
          updatedAt: { toDate: () => new Date('2026-01-01') },
        }),
      }],
    } as never);

    const inquiries = await InquiryService.getUserInquiries('owner-1');

    expect(inquiries[0]).toEqual(expect.objectContaining({
      unreadForAdmin: false,
      unreadForCustomer: false,
    }));
  });
});

describe('InquiryService unread notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    [
      'customer',
      [
        { type: 'where', field: 'userId', operator: '==', value: 'owner-1' },
        { type: 'where', field: 'unreadForCustomer', operator: '==', value: true },
        { type: 'limit', value: 1 },
      ],
    ],
    [
      'admin',
      [
        { type: 'where', field: 'unreadForAdmin', operator: '==', value: true },
        { type: 'limit', value: 1 },
      ],
    ],
  ] as const)('subscribes to %s unread inquiries with the exact constraints', (
    audience,
    expectedConstraints,
  ) => {
    notificationService.subscribeToUnreadInquiries(
      { audience, userId: 'owner-1' },
      jest.fn(),
    );

    expect(query).toHaveBeenCalledWith(expect.anything(), ...expectedConstraints);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  test('hides the notification and forwards errors from the unread subscription', () => {
    const onChange = jest.fn();
    const onError = jest.fn();
    let errorHandler: ((error: Error) => void) | undefined;
    const onSnapshotMock = onSnapshot as unknown as jest.Mock;
    onSnapshotMock.mockImplementation((_: unknown, __: unknown, onErrorCallback: unknown) => {
      errorHandler = onErrorCallback as (error: Error) => void;
      return jest.fn();
    });

    notificationService.subscribeToUnreadInquiries(
      { audience: 'admin', userId: 'admin-1' },
      onChange,
      onError,
    );
    const error = new Error('permission-denied');
    errorHandler?.(error);

    expect(onChange).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith(error);
  });

  test('reports whether the unread subscription has a document', () => {
    const onChange = jest.fn();
    let snapshotHandler: ((snapshot: { empty: boolean }) => void) | undefined;
    const onSnapshotMock = onSnapshot as unknown as jest.Mock;
    onSnapshotMock.mockImplementation((_: unknown, onNext: unknown) => {
      snapshotHandler = onNext as (snapshot: { empty: boolean }) => void;
      return jest.fn();
    });

    notificationService.subscribeToUnreadInquiries(
      { audience: 'customer', userId: 'owner-1' },
      onChange,
    );
    snapshotHandler?.({ empty: false });
    snapshotHandler?.({ empty: true });

    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });

  test('marks unique customer inquiry ids as read', async () => {
    const batchUpdate = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    jest.mocked(writeBatch).mockReturnValue({
      update: batchUpdate,
      commit: batchCommit,
    } as never);

    await notificationService.markInquiriesRead(
      ['inquiry-1', 'inquiry-1', 'inquiry-2'],
      'customer',
    );

    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), {
      unreadForCustomer: false,
    });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  test('writes only the admin unread field for admin read receipts', async () => {
    const batchUpdate = jest.fn();
    const batchCommit = jest.fn().mockResolvedValue(undefined);
    jest.mocked(writeBatch).mockReturnValue({
      update: batchUpdate,
      commit: batchCommit,
    } as never);

    await notificationService.markInquiriesRead(['inquiry-1'], 'admin');

    expect(batchUpdate).toHaveBeenCalledWith(expect.anything(), {
      unreadForAdmin: false,
    });
  });

  test.each([
    [450, [450]],
    [451, [450, 1]],
  ] as const)('commits %i inquiry read receipts in 450-document batches', async (
    inquiryCount,
    expectedBatchSizes,
  ) => {
    const batchUpdates: jest.Mock[] = [];
    const batchCommits: jest.Mock[] = [];
    jest.mocked(writeBatch).mockImplementation(() => {
      const update = jest.fn();
      const commit = jest.fn().mockResolvedValue(undefined);
      batchUpdates.push(update);
      batchCommits.push(commit);
      return { update, commit } as never;
    });
    const inquiryIds = Array.from(
      { length: inquiryCount },
      (_, index) => `inquiry-${index + 1}`,
    );

    await notificationService.markInquiriesRead(inquiryIds, 'customer');

    expect(writeBatch).toHaveBeenCalledTimes(expectedBatchSizes.length);
    expect(batchUpdates.map((update) => update.mock.calls.length)).toEqual(expectedBatchSizes);
    batchCommits.forEach((commit) => expect(commit).toHaveBeenCalledTimes(1));
    expect(batchUpdates.flatMap((update) => update.mock.calls)).toHaveLength(inquiryCount);
  });
});

describe('InquiryService notification indexes', () => {
  test('declares the customer unread inquiry composite index', () => {
    const indexConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'firestore.indexes.json'), 'utf8'),
    ) as {
      indexes: Array<{
        collectionGroup: string;
        queryScope: string;
        fields: Array<{ fieldPath: string }>;
      }>;
    };
    const inquiryIndexes = indexConfig.indexes
      .filter((index) => index.collectionGroup === 'inquiries' && index.queryScope === 'COLLECTION')
      .map((index) => index.fields.map((field) => field.fieldPath));

    expect(inquiryIndexes).toContainEqual(['userId', 'unreadForCustomer']);
  });
});
