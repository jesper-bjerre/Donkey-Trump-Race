# Single image: Node game server that also serves the built browser client.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm deploy --filter @dtr/server --prod --legacy /out/server \
  && cp -r packages/server/dist /out/server/dist \
  && cp -r packages/client-web/dist /out/client

FROM node:22-alpine
# The runtime only needs `node`: drop the bundled npm/corepack (and their vulnerable
# transitive dependencies) and pick up Alpine security fixes.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production PORT=8080 CLIENT_DIST_DIR=/app/client
COPY --from=build /out/server ./
COPY --from=build /out/client ./client
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "dist/main.js"]
