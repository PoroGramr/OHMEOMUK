FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=http://ohmeomuk-backend:8080
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run typecheck && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_URL=http://ohmeomuk-backend:8080
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
COPY --from=build --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/next.config.ts ./next.config.ts
USER app
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
