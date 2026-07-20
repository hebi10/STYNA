import { createCsv, escapeCsvCell } from './csv';

describe('escapeCsvCell', () => {
  test('serializes primitive values and valid dates deterministically', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(new Date('2026-07-20T01:02:03.004Z'))).toBe(
      '2026-07-20T01:02:03.004Z'
    );
  });

  test('serializes an invalid date as an empty cell', () => {
    expect(escapeCsvCell(new Date('invalid'))).toBe('');
  });

  test.each([
    ['=SUM(1,2)', "'=SUM(1,2)"],
    ['+cmd', "'+cmd"],
    ['-10', "'-10"],
    ['@lookup', "'@lookup"],
    ['\tvalue', "'\tvalue"],
    ['\rvalue', "'\rvalue"],
    ['\nvalue', "'\nvalue"],
    ['  =SUM(1,2)', "'  =SUM(1,2)"],
    ['\t +cmd', "'\t +cmd"],
    ['\u00a0@lookup', "'\u00a0@lookup"],
  ])('neutralizes spreadsheet formula payload %p before CSV quoting', (value, expected) => {
    const escaped = escapeCsvCell(value);

    if (/[",\r\n]/u.test(expected)) {
      expect(escaped).toBe(`"${expected.replace(/"/gu, '""')}"`);
    } else {
      expect(escaped).toBe(expected);
    }
  });

  test('serializes a negative number as neutralized text', () => {
    expect(escapeCsvCell(-1200)).toBe("'-1200");
  });

  test.each([
    ['plain', 'plain'],
    [' leading text', ' leading text'],
    ['1+1', '1+1'],
  ])('does not alter non-formula text %p', (value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected);
  });

  test.each([
    ['a,b', '"a,b"'],
    ['a"b', '"a""b"'],
    ['a\rb', '"a\rb"'],
    ['a\nb', '"a\nb"'],
    ['a\r\nb', '"a\r\nb"'],
  ])('applies RFC 4180 escaping to %p', (value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected);
  });
});

describe('createCsv', () => {
  test('joins cells with commas and rows with CRLF', () => {
    expect(
      createCsv([
        ['이름', '설명'],
        ['홍길동', '쉼표, 따옴표"'],
        ['둘째 줄', '줄바꿈\n값'],
      ])
    ).toBe('이름,설명\r\n홍길동,"쉼표, 따옴표"""\r\n둘째 줄,"줄바꿈\n값"');
  });

  test('returns an empty string for no rows', () => {
    expect(createCsv([])).toBe('');
  });
});
