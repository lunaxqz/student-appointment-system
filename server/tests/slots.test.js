// Pure logic: no database and no Express needed.
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.APP_TIMEZONE = 'Asia/Manila';
const { nowParts, isDate, isTime, weekdayOf, addDays, sqlMoment } = require('../utils/campusTime');
const { slotsForRange, blockContainsSlot, slotTimesForWeekday } = require('../utils/slots');

test('campus time is read in the configured time zone', () => {
    // 20:30 UTC on 26 Oct is already 04:30 on 27 Oct in Manila (UTC+8)
    assert.deepEqual(nowParts(new Date('2026-10-26T20:30:00Z')), { date: '2026-10-27', time: '04:30' });
});

test('date and time checks reject impossible values', () => {
    assert.equal(isDate('2026-02-28'), true);
    assert.equal(isDate('2026-02-30'), false);
    assert.equal(isDate('26-02-28'), false);
    assert.equal(isTime('09:30'), true);
    assert.equal(isTime('24:00'), false);
    assert.equal(isTime('9:30'), false);
});

test('weekday and date arithmetic', () => {
    assert.equal(weekdayOf('2026-10-26'), 1); // Monday
    assert.equal(addDays('2026-10-30', 3), '2026-11-02');
});

test('a time zone name can never smuggle SQL into a query', () => {
    process.env.APP_TIMEZONE = "Asia/Manila'; DROP TABLE users; --";
    assert.throws(() => sqlMoment('$1', '$2'));
    process.env.APP_TIMEZONE = 'Asia/Manila';
    assert.match(sqlMoment('$1', '$2'), /AT TIME ZONE 'Asia\/Manila'/);
});

test('a block is cut into 30-minute slots and the end time is not bookable', () => {
    assert.deepEqual(slotTimesForWeekday([{ weekday: 1, start: '09:00', end: '10:30' }], 1), ['09:00', '09:30', '10:00']);
    assert.deepEqual(slotTimesForWeekday([{ weekday: 1, start: '09:00', end: '10:30' }], 2), []);
});

test('taken and already-past slots are busy; other days are untouched', () => {
    const blocks = [{ weekday: 1, start: '09:00', end: '10:30' }];
    const out = slotsForRange({
        blocks, taken: new Set(['2026-10-26 09:30']), from: '2026-10-26', days: 8, now: { date: '2026-10-26', time: '09:10' },
    });
    assert.deepEqual(out[0], { date: '2026-10-26', slots: [{ time: '09:00', busy: true }, { time: '09:30', busy: true }, { time: '10:00', busy: false }] });
    assert.equal(out[1].date, '2026-11-02');
    assert.ok(out[1].slots.every((s) => !s.busy));
});

test('days before today are never offered', () => {
    const out = slotsForRange({ blocks: [{ weekday: 1, start: '09:00', end: '10:00' }], taken: new Set(), from: '2026-10-19', days: 14, now: { date: '2026-10-26', time: '08:00' } });
    assert.equal(out[0].date, '2026-10-26');
});

test('booking must land exactly on a slot inside the block', () => {
    const block = { weekday: 1, start: '09:00', end: '10:30' };
    assert.equal(blockContainsSlot(block, 1, '09:00'), true);
    assert.equal(blockContainsSlot(block, 1, '10:00'), true);
    assert.equal(blockContainsSlot(block, 1, '10:30'), false); // would run past the end
    assert.equal(blockContainsSlot(block, 1, '09:15'), false); // not on a 30-minute step
    assert.equal(blockContainsSlot(block, 2, '09:00'), false); // wrong weekday
});
