# syntax=docker/dockerfile:1

# ---- build: install everything, compile the packages, bundle the web app ----
FROM node:22-alpine AS build
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/games/diwan/package.json packages/games/diwan/
COPY packages/games/tap-race/package.json packages/games/tap-race/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- runtime: production dependencies plus compiled output only ----
FROM node:22-alpine AS runtime
RUN npm install -g pnpm@9
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/web/package.json apps/web/
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/games/diwan/package.json packages/games/diwan/
COPY --from=build /app/packages/games/tap-race/package.json packages/games/tap-race/
RUN pnpm install --frozen-lockfile --prod --filter "@partybox/server..." \
  && npm uninstall -g pnpm \
  && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/games/diwan/dist packages/games/diwan/dist
COPY --from=build /app/packages/games/diwan/LICENSE packages/games/diwan/LICENSE
COPY --from=build /app/packages/games/tap-race/dist packages/games/tap-race/dist

USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "apps/server/dist/index.js"]
