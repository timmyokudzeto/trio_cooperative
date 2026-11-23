import { useEffect, useState } from "react";

type Id = string | number;

type Props = {
  groupId: Id;
  cycleId: Id;
  showCompletion?: boolean;
};

type Receipt = {
  id: Id;
  recipient: string;
  amountPence: number;
  paidAt: string;
};

type History =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; receipts: Receipt[]; totalRounds: number };

const pounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const paidDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

async function getJson(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal });

  if (!response.ok) {
    throw new Error(`Couldn’t load payout history (${response.status}).`);
  }

  return response.json();
}

export default function PayoutHistory({
  groupId,
  cycleId,
  showCompletion = false,
}: Props) {
  const [history, setHistory] = useState<History>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      const cycle = await getJson(
        `/api/groups/${encodeURIComponent(groupId)}/cycles/${encodeURIComponent(cycleId)}`,
        signal,
      );

      const rows = cycle.rounds ?? cycle.cycle?.rounds;
      if (!Array.isArray(rows)) {
        throw new Error("The cycle response is missing its rounds.");
      }

      const results = await Promise.all(
        rows.map(async (row): Promise<Receipt | null> => {
          const id = row.id ?? row.round_id;
          if (typeof id !== "string" && typeof id !== "number") {
            throw new Error("A scheduled round is missing its ID.");
          }

          const body = await getJson(
            `/api/rounds/${encodeURIComponent(id)}`,
            signal,
          );

          const round = body.round;
          if (!round || String(round.cycle_id) !== String(cycleId)) {
            throw new Error("A round did not match the selected cycle.");
          }

          if (round.payout_paid_at === null) return null;

          if (
            typeof round.payout_paid_at !== "string" ||
            !Number.isFinite(Date.parse(round.payout_paid_at)) ||
            typeof round.recipient_name !== "string" ||
            !Number.isSafeInteger(round.collected_pence)
          ) {
            throw new Error("A payout receipt is missing required details.");
          }

          return {
            id,
            recipient: round.recipient_name,
            amountPence: round.collected_pence,
            paidAt: round.payout_paid_at,
          };
        }),
      );

      const receipts = results
        .filter((item): item is Receipt => item !== null)
        .sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));

      if (!signal.aborted) {
        setHistory({ kind: "ready", receipts, totalRounds: rows.length });
      }
    }

    setHistory({ kind: "loading" });

    load().catch((error: unknown) => {
      if (!signal.aborted) {
        setHistory({
          kind: "error",
          message: error instanceof Error ? error.message : "Couldn’t load receipts.",
        });
      }
    });

    return () => controller.abort();
  }, [groupId, cycleId, attempt]);

  if (history.kind === "loading") {
    return <p role="status">Loading payout history…</p>;
  }

  if (history.kind === "error") {
    return (
      <section className="panel">
        <h2>Payout history</h2>
        <p role="alert">{history.message}</p>
        <button className="foot" onClick={() => setAttempt(attempt + 1)}>
          Try again
        </button>
      </section>
    );
  }

  const { receipts, totalRounds } = history;
  const complete = totalRounds > 0 && receipts.length === totalRounds;

  return (
    <section className="panel">
      <h2>{showCompletion && complete ? "Cycle complete" : "Payout history"}</h2>
      <p>{receipts.length} of {totalRounds} payouts recorded</p>

      {receipts.length === 0 ? (
        <p>The first receipt will appear when the admin records a payout.</p>
      ) : (
        <ul>
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <span className="tick" aria-hidden="true">✓</span>
              <strong>
                {receipt.recipient} received {pounds.format(receipt.amountPence / 100)}
              </strong>
              <small>
                <time dateTime={receipt.paidAt}>
                  {paidDate.format(new Date(receipt.paidAt))}
                </time>
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}