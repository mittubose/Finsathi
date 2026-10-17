# Multi-stage production Dockerfile for FinSathi Financial OS
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

RUN mkdir -p /app/server/data

EXPOSE 3001
VOLUME ["/app/server/data"]

CMD ["node", "server/mcp-server.mjs"]
