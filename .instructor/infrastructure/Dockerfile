# Image for the class facilitator and board. Build context is the repository root.
FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY config.js ./
COPY .instructor/*.js .instructor/
ENV NODE_ENV=production
RUN mkdir /data && chown node /data
USER node
