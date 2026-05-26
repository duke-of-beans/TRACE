FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY pwa/package.json pwa/
COPY operator/package.json operator/
RUN npm ci && cd pwa && npm ci && cd ../operator && npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/shared ./shared
COPY --from=build /app/api ./api
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/migrations ./migrations

EXPOSE 3100
CMD ["node", "--import", "tsx", "src/index.ts"]
