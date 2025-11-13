# Docker Setup for Job Board

This document explains how to run the Starfinder 2E Job Board using Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- `.env.local` file with required environment variables (see below)

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Email Configuration (for invitations)
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM="Your App <noreply@yourdomain.com>"

# Optional: LLM Configuration (for job generation)
OPENAI_API_KEY=your-openai-api-key
# OR
GOOGLE_API_KEY=your-google-api-key
```

## Quick Start

### Development Mode

Run the development server with hot-reload:

```powershell
npm run docker:dev
```

This will:
- Build the Next.js app image
- Start PostgreSQL database (port 5432)
- Start Adminer database UI (port 8080)
- Start the Next.js dev server (port 3000)

Access:
- **App**: http://localhost:3000
- **Adminer**: http://localhost:8080 (DB management UI)

To stop:

```powershell
npm run docker:dev:down
```

### Production Build

Build the production Docker image:

```powershell
npm run docker:build
```

This PowerShell script:
- Reads `NEXT_PUBLIC_*` vars from `.env.local`
- Passes them as build args to Docker
- Builds an optimized production image tagged as `job-board:prod`

Run the production image:

```powershell
npm run docker:prod:run
```

Access the app at http://localhost:3000

## How It Works

### Security & RLS Preservation

**Important**: This Docker setup **preserves Row Level Security (RLS)** completely:

- ✅ Service role keys are used only at runtime (not baked into image)
- ✅ RLS policies remain active on Supabase
- ✅ Admin operations still bypass RLS where needed using service role client
- ✅ Secrets are loaded from `.env.local` at runtime via `--env-file`

The fix we applied moves Supabase admin client creation from module-scope to request-time, which:
1. Allows builds to succeed without env vars
2. Keeps RLS security intact
3. Follows Next.js best practices for runtime env vars

### Build-Time vs Runtime Variables

**Build-time** (required during `npm run build`):
- `NEXT_PUBLIC_SUPABASE_URL` - Inlined into browser bundle
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Inlined into browser bundle
- `NEXT_PUBLIC_APP_URL` - Inlined into browser bundle

**Runtime** (required when app runs):
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side secret, never exposed to browser
- `SENDGRID_API_KEY` - Server-side secret
- `OPENAI_API_KEY` / `GOOGLE_API_KEY` - Server-side secrets

### Multi-Stage Dockerfile

The `Dockerfile` uses a multi-stage build:

1. **Builder stage** (Node 24):
   - Installs all dependencies
   - Builds Next.js app with public env vars
   - Creates optimized production bundle

2. **Runner stage** (Node 24 slim):
   - Copies only production dependencies
   - Copies built `.next` folder
   - Runs `next start` (production server)
   - Much smaller final image size

### Development with docker-compose

The `docker-compose.yml` provides:

- **app**: Next.js dev server with bind-mounted source for hot-reload
- **db**: PostgreSQL 15 database for local development
- **adminer**: Web-based DB management UI

Volumes:
- `pgdata`: Persists database data between restarts
- `node_modules`: Prevents permission issues with bind-mounted source

## Manual Docker Commands

If you prefer manual control:

### Build Production Image

```powershell
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key `
  --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 `
  -t job-board:prod `
  -f Dockerfile .
```

### Run Production Container

```powershell
docker run --rm -p 3000:3000 --env-file .env.local job-board:prod
```

### Start Development Stack

```powershell
docker compose up --build
```

### View Logs

```powershell
docker compose logs -f app
```

### Stop and Remove Containers

```powershell
docker compose down
```

### Remove Volumes (Reset Database)

```powershell
docker compose down -v
```

## Database Migrations

To run Supabase migrations against the local PostgreSQL database:

```powershell
# Install Supabase CLI if not already installed
# See: https://supabase.com/docs/guides/cli

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

Alternatively, use Adminer (http://localhost:8080) to manually run SQL migrations from `supabase/migrations/`.

## Troubleshooting

### Build fails with "supabaseUrl is required"

**Cause**: Build-time env vars not available.

**Solution**: Use `npm run docker:build` script or pass `--build-arg` for each `NEXT_PUBLIC_*` variable.

### App fails at runtime with "Missing Supabase credentials"

**Cause**: Runtime env vars not provided.

**Solution**: Ensure `.env.local` exists and contains all required vars. Use `--env-file .env.local` when running container.

### File changes not reflected (dev mode)

**Cause**: Bind mount not working or Next.js cache issue.

**Solution**: 
```powershell
docker compose down
docker compose up --build
```

### Port already in use

**Cause**: Another service is using port 3000, 5432, or 8080.

**Solution**: Stop conflicting service or edit ports in `docker-compose.yml`.

### Windows file watcher issues

**Cause**: Docker Desktop + Windows can have file watcher limits.

**Solution**: Add to `.env.local`:
```bash
CHOKIDAR_USEPOLLING=true
```

## Notes

- The production image does NOT contain `.env.local` or secrets - they must be provided at runtime
- `NEXT_PUBLIC_*` variables are safe to inline (they're visible in browser anyway)
- Service role keys and API keys should NEVER be committed to git
- For production deployment, use proper secrets management (e.g., AWS Secrets Manager, Azure Key Vault)
- The local PostgreSQL is for development only - production uses Supabase hosted database
