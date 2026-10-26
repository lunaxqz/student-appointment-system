import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import LoadState from '../../components/LoadState.jsx';
import Calendar from './Calendar.jsx';
import useLoad from '../../lib/useLoad.js';
import { appointmentApi, catalogApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { f12 } from '../../lib/utils.js';
import { dayLabel, longDate } from './logic.js';

const STEPS = ['Select service', 'Select faculty', 'Date & time', 'Confirm details'];
const SLOT_DAYS = 60; // how far ahead the server offers times

// Load the services and faculty first, so the wizard can start on the right step when arriving from Find Faculty.
export default function Book({ pre }) {
  const { data, loading, error, reload } = useLoad((signal) => Promise.all([catalogApi.services(signal), catalogApi.faculty({}, signal)]), []);
  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading…" /></div>;
  return <BookingWizard pre={pre} services={data[0]} faculty={data[1]} />;
}

function BookingWizard({ pre, services, faculty }) {
  const { toast, go } = useApp();

  // Coming from "Book now" on Find Faculty: staff and service are already known
  const preService = pre ? (faculty.find((f) => f.id === pre)?.service_ids[0] || '') : '';
  const [step, setStep] = useState(preService ? 3 : 1);
  const [serviceId, setServiceId] = useState(preService || '');
  const [staffId, setStaffId] = useState(preService ? pre : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [booked, setBooked] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const facultyFor = (sid) => faculty.filter((f) => f.service_ids.includes(sid));
  const staffName = faculty.find((f) => f.id === staffId)?.name || '';
  const serviceName = services.find((x) => x.id === serviceId)?.name || '';

  // Open times come from the server (it knows what is already booked). Loaded once the faculty member is chosen.
  const slotData = useLoad((signal) => (staffId && serviceId ? catalogApi.slots(staffId, serviceId, SLOT_DAYS, signal) : Promise.resolve([])), [staffId, serviceId]);
  const slotDays = slotData.data || [];
  const slotsOn = (d) => slotDays.find((x) => x.date === d)?.slots || [];

  const pickService = (id) => { if (id !== serviceId) { setServiceId(id); setStaffId(''); setDate(''); setTime(''); } };
  const pickStaff = (id) => { if (id !== staffId) { setStaffId(id); setDate(''); setTime(''); } };
  const pickDate = (d) => { setDate(d); setTime(''); };

  const submit = async () => {
    setSubmitting(true);
    try {
      setBooked(await appointmentApi.book({ staff_id: staffId, service_id: serviceId, date, time, reason: reason.trim() }));
    } catch (err) {
      toast(errorMessage(err, 'Could not submit the request.'));
      setTime(''); setStep(3); slotData.reload(); // the slot may have just been taken: show fresh times
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setStep(1); setServiceId(''); setStaffId(''); setDate(''); setTime(''); setReason(''); setBooked(null);
  };

  // ---------- Success screen ----------
  if (booked) {
    return (
      <div className="success-card card">
        <div className="success-icon"><Icon name="calendarCheck" size={38} /></div>
        <div className="success-eyebrow">REQUEST SUBMITTED</div>
        <h2>Your appointment request is on its way</h2>
        <p className="text-muted">{staffName} will review your request. We’ll let you know as soon as the status changes.</p>
        <div className="success-summary">
          <div><div className="text-muted text-small">Reference</div><b>{booked.reference}</b></div>
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
  const open = date ? slotsOn(date) : [];
  const stripDays = slotDays.slice(0, 5).map((d) => d.date);

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
              {services.map((s) => {
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
            <p className="text-muted">These faculty members offer {serviceName}.</p>
            <div className="choice-list">
              {facultyFor(serviceId).map((u) => {
                const next = u.next_open;
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
            <p className="text-muted">Available times for {staffName}.</p>

            <div className="date-strip">
              {stripDays.map((d) => {
                const openCount = slotsOn(d).filter((s) => !s.busy).length;
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
            {slotData.loading && <p className="text-muted text-small">Loading available times…</p>}
            {slotData.error && <p className="error-text">{slotData.error} <button className="link-button" onClick={slotData.reload}>Try again</button></p>}
            {!slotData.loading && !slotData.error && !stripDays.length && <p className="error-text">This person has not published any availability yet.</p>}

            <label>Or pick another date</label>
            <Calendar selected={date} onSelect={pickDate} days={SLOT_DAYS} />

            {date && (
              <>
                <h3 className="times-heading">Available times <span className="text-muted">{longDate(date)}</span></h3>
                <div className="time-grid">
                  {open.map((s) => (
                    <button key={s.time} disabled={s.busy} className={'time-slot' + (time === s.time ? ' selected' : '')} onClick={() => setTime(s.time)}>{f12(s.time)}</button>
                  ))}
                </div>
                {!slotData.loading && open.every((s) => s.busy) && <p className="text-muted text-small">No open times on this day. Try another date.</p>}
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
                <div className="review-row"><span className="choice-icon"><Icon name="book" /></span><div><div className="text-muted text-small">Service</div><b>{serviceName}</b></div></div>
                <div className="review-row"><span className="choice-icon"><Icon name="userPlus" /></span><div><div className="text-muted text-small">Faculty member</div><b>{staffName}</b></div></div>
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
            : <button className="button button-primary" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit appointment request'} <Icon name="arrow" size={16} /></button>}
        </div>
      </div>
    </>
  );
}
