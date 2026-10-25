// Turns weekly availability blocks into bookable 30-minute slots. Pure functions: no database, easy to test.
const { SLOT_MINUTES, weekdayOf, addDays, toMinutes, fromMinutes } = require('./campusTime');

// Every slot start time ('HH:MM') that a set of blocks offers on a given weekday.
function slotTimesForWeekday(blocks, weekday) {
    const times = new Set();
    for (const b of blocks) {
        if (b.weekday !== weekday) continue;
        for (let t = toMinutes(b.start); t + SLOT_MINUTES <= toMinutes(b.end); t += SLOT_MINUTES) times.add(fromMinutes(t));
    }
    return [...times].sort();
}

// blocks: [{ weekday, start, end }]   taken: Set of 'YYYY-MM-DD HH:MM' that already have a pending/approved appointment
// now: { date, time } in campus time. Returns [{ date, slots: [{ time, busy }] }] for days that have at least one slot.
function slotsForRange({ blocks, taken, from, days, now }) {
    const out = [];
    for (let i = 0; i < days; i += 1) {
        const date = addDays(from, i);
        if (date < now.date) continue;
        const slots = slotTimesForWeekday(blocks, weekdayOf(date)).map((time) => ({
            time,
            busy: taken.has(`${date} ${time}`) || (date === now.date && time <= now.time),
        }));
        if (slots.length) out.push({ date, slots });
    }
    return out;
}

// Does one of the blocks contain this exact slot? (right weekday, starts on a 30-minute step, ends inside the block)
function blockContainsSlot(block, weekday, time) {
    if (block.weekday !== weekday) return false;
    const t = toMinutes(time);
    return t >= toMinutes(block.start) && t + SLOT_MINUTES <= toMinutes(block.end) && (t - toMinutes(block.start)) % SLOT_MINUTES === 0;
}

module.exports = { slotTimesForWeekday, slotsForRange, blockContainsSlot };
