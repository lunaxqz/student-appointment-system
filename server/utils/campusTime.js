// Campus-local dates and times.
// Availability is entered as clock times ("Monday 09:00") and students pick a date and a time, so the server needs
// one agreed time zone to turn those into exact moments. Set APP_TIMEZONE in server/.env (default Asia/Manila).
// Dates travel as 'YYYY-MM-DD' and times as 'HH:MM' strings; only the database stores real timestamps.

const SLOT_MINUTES = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeZone() {
    const tz = process.env.APP_TIMEZONE || 'Asia/Manila';
    // The zone name is placed inside SQL text (it cannot be a parameter there), so only accept plain zone names.
    if (!/^[A-Za-z0-9_+\-/]+$/.test(tz)) throw new Error('APP_TIMEZONE is not a valid time zone name.');
    try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch { throw new Error(`APP_TIMEZONE "${tz}" is not a known time zone.`); }
    return tz;
}

// Current campus date and time, e.g. { date: '2026-10-26', time: '14:05' }
function nowParts(now = new Date()) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: timeZone(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(now).map((p) => [p.type, p.value])
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const isDate = (text) => typeof text === 'string' && DATE_RE.test(text) && !Number.isNaN(Date.parse(text + 'T00:00:00Z'))
    && new Date(text + 'T00:00:00Z').toISOString().slice(0, 10) === text;
const isTime = (text) => typeof text === 'string' && TIME_RE.test(text);

// 0 = Sunday ... 6 = Saturday. Pure calendar arithmetic, so the time zone does not matter.
const weekdayOf = (date) => new Date(date + 'T00:00:00Z').getUTCDay();

function addDays(date, n) {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

const toMinutes = (time) => { const [h, m] = time.split(':'); return Number(h) * 60 + Number(m); };
const fromMinutes = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

// SQL fragment: a stored timestamp shown as campus-local text. `column` is code, never user input.
const sqlLocalDate = (column) => `to_char(${column} AT TIME ZONE '${timeZone()}', 'YYYY-MM-DD')`;
const sqlLocalTime = (column) => `to_char(${column} AT TIME ZONE '${timeZone()}', 'HH24:MI')`;
// SQL fragment: the exact moment for a date parameter and a time parameter, e.g. sqlMoment('$2', '$3')
const sqlMoment = (dateParam, timeParam) => `((${dateParam}::date + ${timeParam}::time) AT TIME ZONE '${timeZone()}')`;

module.exports = {
    SLOT_MINUTES, timeZone, nowParts, isDate, isTime, weekdayOf, addDays, toMinutes, fromMinutes,
    sqlLocalDate, sqlLocalTime, sqlMoment,
};
