import { useEffect, useState } from "react";
import type { RoundSummary } from "./TrioHome";
import PayoutHistory from "./PayoutHistory";

type Id = string | number;
type Slot = Pick<RoundSummary, "id" | "payout_position" | "recipient_name" | "due_on">;
type Props = {
  circle: {
    id: Id;
    name: string;
    role: string;
    round: RoundSummary | null;
    latest_cycle_id: Id | null;
  };
  userId: string;
  onReloadCircle: () => Promise<void>;
};
const tabs = ["Overview", "Members", "Schedule", "Activity"] as const;
type Tab = typeof tabs[number];
const currency = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = (pence: number) => currency.format(pence / 100);
const date = (value: string) => new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
function Avatar({ name }: { name: string }) {
  return <span aria-hidden="true" className={'avatar tone' + (name.charCodeAt(0) % 4)}>{initials(name)}</span>;
}
async function getJson(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error('Request failed (' + response.status + ').');
  return response.json();
}

export default function CircleDashboard({ circle, userId, onReloadCircle, }: Props) {
  const [round, setRound] = useState(circle.round);
  const [tab, setTab] = useState<Tab>("Overview");
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [scheduleError, setScheduleError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const cycleId = round?.cycle_id;

  useEffect(() => {
    if (cycleId == null) return;
    const controller = new AbortController();
    const signal = controller.signal;
    async function load() {
      const result = await getJson('/api/groups/' + circle.id + '/cycles/' + cycleId, signal);
      const rows = result.rounds ?? result.cycle?.rounds;
      if (!Array.isArray(rows) || !rows.length) throw new Error("Schedule unavailable.");
      const slots = await Promise.all(rows.map(async row => {
        const id = row.id ?? row.round_id;
        const slot = row.recipient_name && row.due_on && row.payout_position
          ? row : (await getJson('/api/rounds/' + encodeURIComponent(id), signal)).round;
        if (!slot?.recipient_name || !slot.due_on || !slot.payout_position || id == null) throw new Error("Unexpected schedule.");
        return { ...slot, id } as Slot;
      }));
      if (!signal.aborted) setSchedule(slots.sort((a, b) => a.payout_position - b.payout_position));
    }
    load().catch(() => { if (!signal.aborted) setScheduleError("The cycle schedule could not be loaded."); });
    return () => controller.abort();
  }, [circle.id, cycleId]);
  async function recordPayout() {
  if (
    !round ||
    saving ||
    circle.role !== "admin" ||
    !round.payout_eligible ||
    round.payout_paid_at
  ) {
    return;
  }

  setSaving(true);
  setNotice("");

  try {
    const response = await fetch(
      `/api/rounds/${encodeURIComponent(round.id)}/payout`,
      { method: "POST" },
    );

    if (!response.ok) {
      if (response.status === 409) {
        setNotice("This round has changed. Reopen the circle to see its latest state.");
        return;
      }
      throw new Error(`Couldn’t record the payout (${response.status}).`);
    }

    // Express accepted the payout. Disable the action immediately,
    // even if the separate request for the next round fails.
    setRound({ ...round, payout_eligible: false });
    setNotice(`Demo payout to ${round.recipient_name} recorded.`);
    await onReloadCircle();
  } catch (error) {
    setNotice(
      error instanceof Error
        ? error.message
        : "Couldn’t confirm the payout. Reopen the circle to check its status.",
    );
  } finally {
    setSaving(false);
  }
}
  async function recordContribution() {
    if (!round || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const path = '/api/rounds/' + encodeURIComponent(round.id);
      const response = await fetch(path + '/contributions', { method: "POST" });
      if (!response.ok && response.status !== 409) throw new Error("Contribution request returned " + response.status + ".");
      const latest = await getJson(path);
      setRound(latest.round);
      setNotice(response.ok ? "Demo contribution recorded." : "Round refreshed. Check your payment status.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t update the round.");
    } finally { setSaving(false); }
  }

  if (!round) {
  return (
    <>
      <h1>{circle.name}</h1>

      {circle.latest_cycle_id != null ? (
        <PayoutHistory
          groupId={circle.id}
          cycleId={circle.latest_cycle_id}
          showCompletion
        />
      ) : (
        <section className="panel">
          <h2>No cycle yet</h2>
          <p>The payout schedule will appear when the first cycle starts.</p>
        </section>
      )}
    </>
  );
}
  const members = round.members;
  const mine = members.find(member => String(member.user_id) === userId);
  const pending = members.filter(member => !member.paid);
  const paid = members.filter(member => member.paid);
  const percent = round.target_pence ? Math.min(100, Math.round(100 * round.collected_pence / round.target_pence)) : 0;
  const overview = tab === "Overview";
  const receipts = paid.filter(member => member.received_at).sort((a,b) => Date.parse(b.received_at!) - Date.parse(a.received_at!));
  const memberRows = (overview ? pending.slice(0, 3) : members).map(member =>
    <li key={member.user_id}><Avatar name={member.display_name}/><strong>{member.display_name}</strong><small className={member.paid ? "pill" : "pill amber"}>{member.paid ? "Paid" : "Pending"}</small></li>);
  const scheduleRows = overview ? schedule.slice(Math.max(0, schedule.findIndex(slot => String(slot.id) === String(round.id)) - 1)).slice(0,4) : schedule;
  return <>
    <div className="heading"><i className="mark big" aria-hidden="true"/><div>
      <div className="title"><h1>{circle.name}</h1><small className="pill">{round.member_count} participants</small></div>
      <p>{money(round.contribution_pence)} per round · Round {round.payout_position} of {round.member_count}</p>
    </div></div>
    <nav className="tabs" aria-label="Circle sections">{tabs.map(item => <button key={item} aria-current={item === tab ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {overview && <>
      <section className="pot"><div className="eyebrow">Current pot</div><div className="amount">{money(round.collected_pence)} <span>/ {money(round.target_pence)}</span></div><p>Collected this round</p>
        <div className="legend"><span>{percent}% collected</span><span>{money(Math.max(0, round.target_pence-round.collected_pence))} remaining</span></div>
        <progress aria-label="Current pot collected" value={percent} max={100}/>
        <div className="paid"><span className="stack">{paid.slice(0,4).map(m => <Avatar key={m.user_id} name={m.display_name}/>)}</span><b>{round.paid_count} of {round.member_count} paid</b></div>
        {round.payout_eligible && !round.payout_paid_at && (
  <div className="payout-action">
    <strong>
      {money(round.collected_pence)} ready for payout to {round.recipient_name}
    </strong>

    {circle.role === "admin" ? (
      <button
        type="button"
        className="foot"
        disabled={saving}
        onClick={recordPayout}
      >
        {saving ? "Recording…" : "Record demo payout"}
      </button>
    ) : (
      <p>Waiting for the circle admin to record the payout.</p>
    )}
  </div>
)}
      </section>
      <section className="panel rotation"><h2>Rotation</h2><div className="track">{[-1,0,1].map(offset => {
        const slot = offset === 0 ? round : schedule.find(s => s.payout_position === round.payout_position + offset);
        const pos = round.payout_position + offset;
        return <div className={offset === 0 ? "current stop" : "stop"} key={offset}>
          {slot ? <Avatar name={slot.recipient_name}/> : <span className="avatar missing">—</span>}
          <span className="eyebrow">{["Previous","Current","Next"][offset+1]}</span><b>{slot?.recipient_name ?? (pos < 1 ? "First round" : pos > round.member_count ? "Final round" : "—")}</b>{slot && <small>{date(slot.due_on)}</small>}
        </div>;
      })}</div></section>
    </>}
    <div className={overview ? "grid" : "single"}>
      {overview && <section className="panel"><h2>My contribution</h2><dl><div><dt>Payment deadline</dt><dd>{date(round.due_on)}</dd></div><div><dt>Round recipient</dt><dd>{round.recipient_name}</dd></div><div><dt>Per member</dt><dd>{money(round.contribution_pence)}</dd></div></dl>
        {mine && <button className="primary" onClick={recordContribution} disabled={saving || mine.paid || !!round.payout_paid_at}>{mine.paid ? "Contribution recorded ✓" : saving ? "Recording…" : "Record my " + money(round.contribution_pence) + " demo contribution"}</button>}
        {notice && <p role="status">{notice}</p>}</section>}
      {(overview || tab === "Members") && <section className="panel"><div className="panelHead"><h2>{overview ? "Member payments" : "Round members"}</h2><small className="pill">{paid.length} of {members.length} paid</small></div><p>{pending.length ? pending.length + " still to pay" : "Everyone has paid this round."}</p><ul>{memberRows}</ul>{overview && <button className="foot" onClick={() => setTab("Members")}>View all round members →</button>}</section>}
      {(overview || tab === "Schedule") && <section className="panel"><h2>Payout order</h2>{!schedule.length && <p role="status">{scheduleError || "Loading schedule…"}</p>}<ol>{scheduleRows.map(slot => <li key={slot.id} className={String(slot.id) === String(round.id) ? "activeRow" : ""}><span>{slot.payout_position}</span><Avatar name={slot.recipient_name}/><strong>{slot.recipient_name}</strong><small>{date(slot.due_on)}</small></li>)}</ol>{overview && <button className="foot" onClick={() => setTab("Schedule")}>View full schedule →</button>}</section>}
      {(overview || tab === "Activity") && <section className="panel"><h2>Round activity</h2>{!receipts.length && <p>No contributions recorded this round.</p>}<ul>{(overview ? receipts.slice(0,3) : receipts).map(m => <li key={m.user_id}><span className="tick" aria-hidden="true">✓</span><strong>{m.display_name} paid {money(round.contribution_pence)}</strong><small>{new Date(m.received_at!).toLocaleString("en-GB", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"})}</small></li>)}</ul>{overview && <button className="foot" onClick={() => setTab("Activity")}>View round activity →</button>}</section>}
    {tab === "Activity" && (
  <PayoutHistory groupId={circle.id} cycleId={round.cycle_id} />
)}
    </div>
  </>;
}
