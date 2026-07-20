import { downloadUsersCsv } from './downloadUsersCsv';

describe('downloadUsersCsv', () => {
  const createObjectURL = jest.fn(() => 'blob:users-csv');
  const revokeObjectURL = jest.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
  });

  test('uses the existing dated filename and cleans up the temporary URL and anchor', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadUsersCsv('\ufeffID,이름', new Date('2026-07-20T15:30:00.000Z'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toMatchObject({
      href: 'blob:users-csv',
      download: 'users_2026-07-20.csv',
    });
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:users-csv');
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  test('revokes the object URL and removes the anchor when clicking throws', () => {
    const clickError = new Error('click failed');
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw clickError;
    });

    expect(() => downloadUsersCsv('ID,이름', new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      clickError
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:users-csv');
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  test('validates the filename date before creating an object URL', () => {
    expect(() => downloadUsersCsv('ID,이름', new Date('invalid'))).toThrow(RangeError);

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(document.body.querySelector('a')).toBeNull();
  });

  test('revokes the object URL when configuring the download anchor throws', () => {
    const link = document.createElement('a');
    const downloadError = new Error('download setter failed');
    Object.defineProperty(link, 'download', {
      configurable: true,
      set: () => {
        throw downloadError;
      },
    });
    jest.spyOn(document, 'createElement').mockReturnValue(link);

    expect(() => downloadUsersCsv('ID,이름', new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      downloadError
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:users-csv');
    expect(link.isConnected).toBe(false);
  });

  test('falls back to removing the anchor from its parent when link.remove throws', () => {
    jest.spyOn(Element.prototype, 'remove').mockImplementation(() => {
      throw new Error('remove failed');
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    expect(() =>
      downloadUsersCsv('ID,이름', new Date('2026-07-20T00:00:00.000Z'))
    ).not.toThrow();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:users-csv');
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  test('preserves a click error after the remove fallback succeeds', () => {
    const clickError = new Error('click failed');
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw clickError;
    });
    jest.spyOn(Element.prototype, 'remove').mockImplementation(() => {
      throw new Error('remove failed');
    });

    expect(() => downloadUsersCsv('ID,이름', new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      clickError
    );

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  test('revokes the object URL when both anchor removal methods fail', () => {
    const fallbackError = new Error('removeChild failed');
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    jest.spyOn(Element.prototype, 'remove').mockImplementation(() => {
      throw new Error('remove failed');
    });
    jest.spyOn(Node.prototype, 'removeChild').mockImplementation(() => {
      throw fallbackError;
    });

    expect(() => downloadUsersCsv('ID,이름', new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      fallbackError
    );

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:users-csv');
  });
});
