import { DATA_LIMITS } from 'shared-types';
import { quoteMy, quotePg, redisReply, splitArgs, toCell } from './values';

describe('toCell', () => {
  it('keeps JSON values and turns the rest into text', () => {
    expect(toCell(null)).toEqual({ value: null, cut: false });
    expect(toCell(12n)).toEqual({ value: '12', cut: false });
    expect(toCell({ a: 1 })).toEqual({ value: { a: 1 }, cut: false });
    expect(toCell(Buffer.from([0xde, 0xad]))).toEqual({ value: '\\xdead', cut: false });
    expect(toCell(new Date('2026-11-01T10:00:00Z'))).toEqual({ value: '2026-11-01T10:00:00.000Z', cut: false });
  });
  it('cuts long text and big JSON', () => {
    const long = toCell('x'.repeat(DATA_LIMITS.cellChars + 5));
    expect(long.cut).toBe(true);
    expect((long.value as string).length).toBe(DATA_LIMITS.cellChars + 1);
    expect(toCell({ big: 'y'.repeat(DATA_LIMITS.cellChars) }).cut).toBe(true);
  });
});

describe('quoting', () => {
  it('doubles the quote character', () => {
    expect(quotePg('we"ird')).toBe('"we""ird"');
    expect(quoteMy('we`ird')).toBe('`we``ird`');
  });
});

describe('splitArgs', () => {
  it('splits like redis-cli', () => {
    expect(splitArgs('SET user:1 hello')).toEqual(['SET', 'user:1', 'hello']);
    expect(splitArgs('  SET  "two words"   \'it"s\'  ')).toEqual(['SET', 'two words', 'it"s']);
    expect(splitArgs('SET k "a\\nb\\x41\\"c"')).toEqual(['SET', 'k', 'a\nbA"c']);
    expect(splitArgs('SET k ""')).toEqual(['SET', 'k', '']);
  });
  it('refuses an unclosed quote', () => {
    expect(() => splitArgs('SET k "oops')).toThrow();
    expect(() => splitArgs("SET k 'oops")).toThrow();
  });
});

describe('redisReply', () => {
  it('turns buffers, errors and nested arrays into JSON', () => {
    expect(redisReply([Buffer.from('a'), 1, null, [new Error('WRONGTYPE')]])).toEqual(['a', 1, null, [{ error: 'WRONGTYPE' }]]);
  });
});
