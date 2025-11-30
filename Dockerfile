# Multi-stage Dockerfile for Next.js (Next 16) targeting Node 24 LTS

## Base stage for dependency installation
FROM node:24-bullseye AS deps
WORKDIR /app

# Accept build args for Next.js public env vars
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# Set them as env vars
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY package.json package-lock.json* ./
RUN npm ci

## Development stage
FROM deps AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

## Builder stage
FROM deps AS builder
COPY . .
RUN npm run build

## Runner stage
FROM node:24-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy built app and static assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "run", "start"]
