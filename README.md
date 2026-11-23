# Trio Cooperative

Trio is a web app for running a **susu**, a rotating savings circle. Four friends contributing £50 each build a £200 pot every round. A different member receives the pot each time until all four have had a turn. Trio tracks who has paid, whose turn is next, and which payouts have been recorded.

[Live demo](https://trio-cooperative.vercel.app) · [API health check](https://trio-cooperative-api.onrender.com/api/health)

Contributions and payouts are simulated. No real money moves.

## Walk through a circle

Sign in with a member account and open **My circles**. Select a circle to see its current round. A new circle shows **No open round** until its first cycle starts.

- **Overview** shows the current recipient, contribution deadline, and progress towards the pot.
- **Members** shows who has paid. A signed-in participant can record their own demo contribution.
- **Schedule** shows the payout order across the cycle.
- **Activity** shows recorded payouts. Once everyone has contributed, the circle admin can record the payout and advance to the next recipient.

## How it works

The React frontend calls relative `/api` routes. Vercel forwards those requests to the Express backend on Render. Express uses a session cookie to identify the member and stores session data in PostgreSQL on Neon.

| Component | Implementation |
| --- | --- |
| Frontend | React, TypeScript and Vite in `client/` |
| Backend | Node.js and Express in `server/` |
| Database | PostgreSQL with SQL migrations in `db/migrations/` |
| Sessions | `express-session` with a PostgreSQL store using `connect-pg-simple` |
| Amounts | The API stores amounts in integer pence. The frontend displays them in pounds. |

## Run locally

You'll need Node.js 24, npm, and PostgreSQL running locally. The database commands assume your PostgreSQL user can create a database.

### 1. Install dependencies

```bash
git clone https://github.com/timmyokudzeto/trio_cooperative.git
cd trio_cooperative
npm ci --prefix server
npm ci --prefix client
```

### 2. Set up a fresh database

From the repository root, create the local database and apply the migrations in order.

```bash
createdb trio
for migration in db/migrations/*.sql; do
  psql -X -v ON_ERROR_STOP=1 -d trio -f "$migration" || break
done
```

After all migrations succeed, create the table that keeps members signed in across requests.

```bash
psql -X -v ON_ERROR_STOP=1 -d trio -f server/node_modules/connect-pg-simple/table.sql
```

### 3. Configure the backend

Create `server/.env` using your local PostgreSQL credentials. Generate a session secret with `openssl rand -hex 32` and keep the file private.

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/trio
SESSION_SECRET=YOUR_GENERATED_SECRET
PORT=3000
```

### 4. Start the app

Start the API from the repository root in one terminal.

```bash
cd server
node --env-file=.env index.cjs
```

Open a second terminal at the repository root and start the frontend.

```bash
npm --prefix client run dev
```

Open the local address printed by Vite. The API health check is available at `http://localhost:3000/api/health`. On a fresh database, create a member through `POST /api/auth/register` before signing in. Circle creation, invitations, and cycle setup are available through the API.

## Build and test

```bash
npm --prefix client run build
```

This type-checks the frontend and creates the production bundle in `client/dist/`.

For backend tests, prepare a separate local `trio_test` database with the schema applied. Set `DATABASE_URL` to that test database before running the suite, since it takes precedence over `PGDATABASE`.

```bash
npm --prefix server run test:backend
```

## Deployment

Vercel builds the frontend from `client/`. Render installs dependencies with `npm ci` and runs `npm start` from `server/`. The backend reads `DATABASE_URL` and `SESSION_SECRET` from Render's environment. The `/api/health` endpoint checks connectivity to the hosted database.