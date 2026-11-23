import { useEffect, useState } from "react";
import CircleDashboard from "./CircleDashboard";
import "./trio.css";
import type { FormEvent } from "react";

type Circle = {
  id: string | number;
  name: string;
};
export type RoundSummary = {
  cycle_id: string | number;
  members: { user_id: string | number; display_name: string; paid: boolean; received_at: string | null }[];
  id: string | number;
  payout_position: number;
  due_on: string;
  recipient_name: string;
  contribution_pence: number;
  paid_count: number;
  member_count: number;
  collected_pence: number;
  target_pence: number;
  payout_eligible: boolean;
  payout_paid_at: string | null;
};

type CircleOverview = Circle & {
  role: string;
  latest_cycle_id: string | number | null;
  round: RoundSummary | null;
};

type Screen =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "circles"; circles: Circle[]; userId: string; name: string }
  | { kind: "error"; message: string };

// Ask Express which screen the current browser session can access.
async function loadScreen(signal?: AbortSignal): Promise<Screen> {
  const me = await fetch("/api/users/me", { signal });

  if (me.status === 401) return { kind: "login" };
  if (!me.ok) throw new Error(`Couldn’t check your session (${me.status}).`);

  const profile = await me.json();
  const user = profile.user ?? profile;
  const response = await fetch("/api/groups", { signal });

  if (response.status === 401) return { kind: "login" };
  if (!response.ok) {
    throw new Error(`Couldn’t load your circles (${response.status}).`);
  }

  const body = await response.json();
  const circles = Array.isArray(body) ? body : body?.groups;

  if (
    !Array.isArray(circles) ||
    !circles.every(
      (circle) =>
        circle &&
        (typeof circle.id === "string" || typeof circle.id === "number") &&
        typeof circle.name === "string",
    )
  ) {
    throw new Error("Unexpected circle data. Check GET /api/groups in Bruno.");
  }

  return { kind: "circles", circles, userId: String(user.id), name: user.display_name ?? user.displayName ?? "You" };
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Couldn’t reach the Trio API.";
}

export default function TrioHome() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedCircle, setSelectedCircle] = useState<CircleOverview | null>(null);
  // Runs when the page opens, including after a browser refresh.
  useEffect(() => {
    const controller = new AbortController();

    loadScreen(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setScreen(next);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setScreen({ kind: "error", message: messageFrom(err) });
        }
      });

    return () => controller.abort();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email")).trim(),
          password: form.get("password"),
        }),
      });

      if (response.status === 401) {
        throw new Error("That email and password didn’t match.");
      }
      if (!response.ok) throw new Error(`Login failed (${response.status}).`);

      const next = await loadScreen();
      if (next.kind === "login") {
        throw new Error("Login succeeded, but the session cookie wasn’t recognised.");
      }
      setScreen(next);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }
async function openCircle(id: Circle["id"]) {
  setError("");
  setBusy(true);

  try {
    const response = await fetch(`/api/groups/${encodeURIComponent(id)}`);

    if (response.status === 401) {
      setSelectedCircle(null);
      setScreen({ kind: "login" });
      return;
    }

    if (!response.ok) {
      throw new Error(`Couldn’t open this circle (${response.status}).`);
    }

    const body = await response.json();
    const circle = body?.group ?? body;

    if (
      !circle ||
      String(circle.id) !== String(id) ||
      typeof circle.name !== "string"
    ) {
      throw new Error("Unexpected circle data. Check Get One Circle in Bruno.");
    }

    const roundId = circle.current_round_id;
let round: RoundSummary | null = null;

if (roundId !== null) {
  if (typeof roundId !== "string" && typeof roundId !== "number") {
    throw new Error("The circle response is missing current_round_id.");
  }

  const roundResponse = await fetch(
    `/api/rounds/${encodeURIComponent(roundId)}`,
  );

  if (roundResponse.status === 401) {
    setSelectedCircle(null);
    setScreen({ kind: "login" });
    return;
  }

  if (!roundResponse.ok) {
    throw new Error(`Couldn’t load the current round (${roundResponse.status}).`);
  }

  const roundBody = await roundResponse.json();

  if (!roundBody.round || String(roundBody.round.id) !== String(roundId)) {
    throw new Error("The API returned an unexpected round.");
  }

  round = roundBody.round;
}

setSelectedCircle({ ...circle, round });
  } catch (err) {
    setError(messageFrom(err));
  } finally {
    setBusy(false);
  }
}
  async function handleLogout() {
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 401) {
        throw new Error(`Couldn’t log out (${response.status}).`);
      }
      setSelectedCircle(null);
      setScreen({ kind: "login" });
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setSelectedCircle(null);
    setError("");
  }

  return <div className="trio">
    <header className="top"><div className="bar">
      <span className="brand"><i className="mark" aria-hidden="true" />Trio</span>
      {screen.kind === "circles" && <>
        <nav aria-label="Main"><button onClick={back}>My circles</button></nav>
        <div className="account"><span>{screen.name}</span><button disabled={busy} onClick={handleLogout}>Sign out</button></div>
      </>}
    </div></header>
    <main className="wrap">
      {screen.kind === "loading" && <p role="status">Loading Trio…</p>}
      {screen.kind === "error" && <><p role="alert">{screen.message}</p><button onClick={() => location.reload()}>Try again</button></>}
      {screen.kind === "login" && <section className="signin panel">
        <i className="mark" aria-hidden="true" /><h1>Sign in</h1><p>Access your savings circles.</p>
        <form onSubmit={handleLogin}>
          <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>}
      {screen.kind === "circles" && (selectedCircle
        ? <CircleDashboard
  key={`${selectedCircle.id}-${selectedCircle.round?.id ?? "none"}`}
  circle={selectedCircle}
  userId={screen.userId}
  onReloadCircle={() => openCircle(selectedCircle.id)}
/>
        : <><h1>My circles</h1><div className="grid">{screen.circles.map(circle =>
          <button className="panel circleLink" key={circle.id} disabled={busy} onClick={() => openCircle(circle.id)}>
            <i className="mark" aria-hidden="true"/><strong>{circle.name}</strong><span aria-hidden="true">→</span>
          </button>)}</div>{!screen.circles.length && <p>You haven’t joined a circle yet.</p>}</>)}
      {error && <p className="notice" role="alert">{error}</p>}
    </main>
  </div>;
}

