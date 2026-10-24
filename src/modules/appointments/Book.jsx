import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import Calendar from './Calendar.jsx';
import { f12, nm, sv } from '../../lib/utils.js';
import { createAppointment, dayLabel, next14, nextOpenSlot, refOf, slots, validateBooking } from './logic.js';

const STEPS = ['Select service', 'Select faculty', 'Date & time', 'Confirm details'];

const longDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

export default function Book({ pre }) {
  const { db, me, commit, toast, go } = useApp();

  // Coming from "Book now" on Find Faculty: staff and service are already known
  const preService = pre ? (db.staff_services.find((x) => x.staff_id === pre) || {}).service_id : '';
  const [step, setStep] = useState(preService ? 3 : 1);
  const [serviceId, setServiceId] = useState(preService || '');
  const [staffId, setStaffId] = useState(preService ? pre : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [bookedId, setBookedId] = useState('');

  const facultyFor = (sid) => db.users.filter((u) => u.role === 'staff' && u.active
    && db.staff_services.some((x) => x.staff_id === u.id && x.service_id === sid));

  const pickService = (id) => { if (id !== serviceId) { setServiceId(id); setStaffId(''); setDate(''); setTime(''); } };
  const pickStaff = (id) => { if (id !== staffId) { setStaffId(id); setDate(''); setTime(''); } };
  const pickDate = (d) => { setDate(d); setTime(''); };

  const submit = () => {
    const booking = { studentId: me.id, staffId, serviceId, date, time, reason: reason.trim() };
    const error = validateBooking(db, booking);
    if (error) { toast(error); return setStep(3); }
    setBookedId(createAppointment(commit, me, booking));
  };

  const startOver = () => {
    setStep(1); setServiceId(''); setStaffId(''); setDate(''); setTime(''); setReason(''); setBookedId('');
  };

  // ---------- Success screen ----------
  if (bookedId) {
    return (
      <div className="success-card card">
        <div className="success-icon"><Icon name="calendarCheck" size={38} /></div>
        <div className="success-eyebrow">REQUEST SUBMITTED</div>
        <h2>Your appointment request is on its way</h2>
        <p className="text-muted">{nm(db, staffId)} will review your request. We’ll let you know as soon as the status changes.</p>
        <div className="success-summary">
          <div><div className="text-muted text-small">Reference</div><b>{refOf(bookedId)}</b></div>
          <div><div className="text-muted text-small">Date & time</div><b>{longDate(date)} · {f12(time)}</b></div>
          <div><div className="text-muted text-small">Status</div><StatusPill status="pending" /></div>
        </div>
        <div className="success-actions">
          <button className="button button-primary" onClick={() => go('mine')}>View my appointments</button>
          <button className="button" onClick={startOver}>Book another</button>
        </div>
      </div>
    );
  }

  // ---------- Step content ----------
  const canContinue = (step === 1 && serviceId) || (step === 2 && staffId) || (step === 3 && date && time) || step === 4;
  const open = staffId && date ? slots(db, staffId, date) : [];
  const stripDays = staffId
    ? next14().filter((d) => slots(db, staffId, d).length > 0).slice(0, 5)
    : [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Book an Appointment</h1>
          <p className="page-subtitle">Complete the steps below to submit an appointment request.</p>
        </div>
      </div>

      <div className="stepper card">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'current' : '';
          return (
            <div className="stepper-item" key={label}>
              <div className={'step ' + state}>
                <span className="step-circle">{n < step ? <Icon name="check" size={16} /> : n}</span>
                <span className="step-label"><small>Step {n}</small>{label}</span>
              </div>
              {n < STEPS.length && <span className="step-line" />}
            </div>
          );
        })}
      </div>

      <div className="card wizard-panel">
        {step === 1 && (
          <>
            <h2>What can we help you with?</h2>
            <p className="text-muted">Choose the service that best matches your needs.</p>
            <div className="choice-grid">
              {db.services.map((s) => {
                const total = facultyFor(s.id).length;
                return (
                  <button key={s.id} disabled={!total} className={'choice' + (serviceId === s.id ? ' selected' : '')} onClick={() => pickService(s.id)}>
                    <span className="choice-icon"><Icon name="calendar" /></span>
                    <span className="choice-main">
                      <b>{s.name}</b>
                      <span className="text-muted text-small">Meet with an adviser for focused guidance and support.</span>
                      <span className="choice-meta">{total} faculty available</span>
                    </span>
                    <span className="radio">{serviceId === s.id && <Icon name="check" size={14} />}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Choose a faculty member</h2>
            <p className="text-muted">These faculty members offer {sv(db, serviceId)}.</p>
            <div className="choice-list">
              {facultyFor(serviceId).map((u) => {
                const next = nextOpenSlot(db, u.id);
                return (
                  <button key={u.id} className={'choice' + (staffId === u.id ? ' selected' : '')} onClick={() => pickStaff(u.id)}>
                    <Avatar name={u.name} />
                    <span className="choice-main">
                      <b>{u.name}</b>
                      <span className="text-muted text-small">{u.title || 'Faculty'}</span>
                      <span className="choice-meta"><Icon name="clock" size={14} /> Next: {next ? dayLabel(next.date) + ', ' + f12(next.time) : 'no open slots'}</span>
                    </span>
                    <span className="radio">{staffId === u.id && <Icon name="check" size={14} />}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Select a date and time</h2>
            <p className="text-muted">Available times for {nm(db, staffId)}.</p>

            <div className="date-strip">
              {stripDays.map((d) => {
                const openCount = slots(db, staffId, d).filter((s) => !s.busy).length;
                const parsed = new Date(d + 'T00:00');
                return (
                  <button key={d} disabled={!openCount} className={'date-tile' + (date === d ? ' selected' : '')} onClick={() => pickDate(d)}>
                    <small>{parsed.toLocaleDateString(undefined, { weekday: 'short' })}</small>
                    <b>{String(parsed.getDate()).padStart(2, '0')}</b>
                    <small>{openCount ? openCount + ' slots' : 'Full'}</small>
                  </button>
                );
              })}
            </div>
            {!stripDays.length && <p className="error-text">This person has not published any availability yet.</p>}

            <label>Or pick another date</label>
            <Calendar selected={date} onSelect={pickDate} />

            {date && (
              <>
                <h3 className="times-heading">Available times <span className="text-muted">{longDate(date)}</span></h3>
                <div className="time-grid">
                  {open.map((s) => (
                    <button key={s.t} disabled={s.busy} className={'time-slot' + (time === s.t ? ' selected' : '')} onClick={() => setTime(s.t)}>{f12(s.t)}</button>
                  ))}
                </div>
                {open.every((s) => s.busy) && <p className="text-muted text-small">No open times on this day. Try another date.</p>}
                <div className="legend"><span>Available</span><span className="selected">Selected</span><span className="unavailable">Unavailable</span></div>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h2>Review your request</h2>
            <p className="text-muted">Confirm that the appointment details are correct before submitting.</p>
            <div className="review-layout">
              <div className="review-card">
                <div className="review-row"><span className="choice-icon"><Icon name="book" /></span><div><div className="text-muted text-small">Service</div><b>{sv(db, serviceId)}</b></div></div>
                <div className="review-row"><span className="choice-icon"><Icon name="userPlus" /></span><div><div className="text-muted text-small">Faculty member</div><b>{nm(db, staffId)}</b></div></div>
                <div className="review-row"><span className="choice-icon"><Icon name="calendar" /></span><div><div className="text-muted text-small">Date & time</div><b>{longDate(date)} · {f12(time)}</b></div></div>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Reason for appointment <span className="text-muted">(optional)</span></label>
                <textarea rows="6" placeholder="Share a short note to help your faculty member prepare…" value={reason} onChange={(e) => setReason(e.target.value)} />
                <p className="text-muted text-small" style={{ marginTop: 8 }}>Do not include sensitive personal information.</p>
              </div>
            </div>
          </>
        )}

        <div className="wizard-footer">
          <button className="button" onClick={() => (step === 1 ? go('dashboard') : setStep(step - 1))}>{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 4
            ? <button className="button button-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue <Icon name="arrow" size={16} /></button>
            : <button className="button button-primary" onClick={submit}>Submit appointment request <Icon name="arrow" size={16} /></button>}
        </div>
      </div>
    </>
  );
}
