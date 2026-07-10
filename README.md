# Daily Word

A polished, private, daily five-letter Bible word game with Google-authenticated player identity, server-authoritative scoring, practice play, player profiles, and filtered leaderboards.

## Product behavior

- One global daily puzzle, changing at midnight Eastern time.
- Solutions are curated five-letter words found in the NIV Bible. Proper names are allowed. The repository stores only individual words and scripture references—not NIV verse text.
- Six guesses. Correct, present, and absent letters follow standard Wordle-style duplicate-letter rules.
- A player's first submitted guess starts their one counted game for that day.
- Leaving an in-progress game records a loss and a score of 6. The browser warns first; a new page load also closes any unfinished server-side session.
- Players can replay today's puzzle or receive a randomly selected earlier puzzle. All replays are clearly marked as practice before play begins.
- Two leaderboards: most solved and lowest average score. Both can be filtered by today, this week, this month, this year, or all time. Losses and abandoned games count as 6 in the average.
- Player profiles include times played, rated/practice splits, win/loss ratio, win rate, current and best streaks, rated average, guess distribution, and game history.
- Emails are never displayed. A player can edit the public display name initially derived from their Google email address.

## Architecture

- Next.js and TypeScript in a single Cloud Run container.
- Firestore holds `players`, `plays`, and transactional `dailyRecords` collections.
- The server selects and evaluates words; the answer is not sent to the browser before a game ends.
- The production app validates `X-Goog-IAP-JWT-Assertion`, including signature, issuer, and the configured Cloud Run audience. Unsigned identity headers are not trusted.
- Local development uses an in-memory store with demo players and a mock identity.

## Local development

Requirements: Node.js 22 or 24 and pnpm 9.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Demo data is held in memory and resets when the server restarts.

Run all verification:

```bash
pnpm lint
pnpm test
pnpm build
```

## Container

The container listens on Cloud Run's conventional port 8080:

```bash
docker build -t daily-word .
docker run --rm -p 8080:8080 \
  -e DATA_BACKEND=memory \
  -e ALLOW_DEV_AUTH=true \
  daily-word
```

`GET /api/healthz` is an unauthenticated liveness endpoint. All player, game, profile, and leaderboard endpoints require a valid identity outside local development.

## Google Cloud prerequisites

The repository deliberately does not choose or modify a Google Cloud project. Before the first deployment:

1. Create or select a billed Google Cloud project.
2. Enable Cloud Run, Artifact Registry, Firestore, Secret Manager, IAM Credentials, and IAP.
3. Create a Firestore Native Mode database and deploy the included indexes and deny-all client rules:

   ```bash
   gcloud firestore databases create --location=us-east1
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. Give the Cloud Run runtime service account only the Firestore and Secret Manager access it needs (`roles/datastore.user` and access to the puzzle seed secret).
5. Create a stable puzzle seed before the first live puzzle. Never rotate it after launch, or historical date-to-word assignments will change:

   ```bash
   printf '%s' 'generate-a-long-random-value' | \
     gcloud secrets create wordle-puzzle-seed --data-file=-
   ```

6. Enable IAP directly on the Cloud Run service and configure the users, groups, or Workspace domain allowed to play.
7. Set `IAP_AUDIENCE` to:

   ```text
   /projects/PROJECT_NUMBER/locations/REGION/services/SERVICE_NAME
   ```

The application intentionally refuses production requests without a signed, valid IAP JWT. This provides defense in depth if ingress or IAP is later misconfigured.

## GitHub deployment workflow

`.github/workflows/deploy-cloud-run.yml` is a manual deployment workflow using keyless Google Workload Identity Federation. Configure these GitHub repository variables when the Google Cloud project is ready:

| Variable | Example |
| --- | --- |
| `GCP_PROJECT_ID` | `daily-word-prod` |
| `GCP_REGION` | `us-east1` |
| `CLOUD_RUN_SERVICE` | `daily-word` |
| `ARTIFACT_REPOSITORY` | `cloud-run` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/.../providers/github` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | deployment service account email |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | runtime service account email |

The workflow deploys a private service and does not grant user access. IAP access policy remains an explicit Google Cloud configuration step.

## Environment variables

| Variable | Production | Purpose |
| --- | --- | --- |
| `DATA_BACKEND` | `firestore` | Selects persistent storage. |
| `GOOGLE_CLOUD_PROJECT` | Cloud project ID | Used by Application Default Credentials and Firestore. |
| `IAP_AUDIENCE` | Required | Expected signed JWT audience. |
| `PUZZLE_SEED` | Required secret | Keeps the daily schedule stable. |
| `PUZZLE_TIME_ZONE` | `America/New_York` | Daily reset and leaderboard calendar. |
| `PUZZLE_EPOCH` | `2026-01-01` | Beginning of the archive schedule. |
| `ALLOW_DEV_AUTH` | Never in production | Enables a local mock identity. |

## Security notes

- Do not expose the service publicly without IAP merely because the application has identity code. The app and Cloud Run/IAP configuration are complementary controls.
- Do not enable `ALLOW_DEV_AUTH` in Cloud Run.
- Firestore client rules deny all access; the browser communicates only with the authenticated server.
- The daily counted record is created transactionally, preventing two simultaneous tabs from receiving two leaderboard attempts.
