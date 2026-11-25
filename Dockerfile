# 1. Build the static site
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY server ./server
COPY src ./src
RUN npm run build

# 2. Run the small Node server (static files + login + Claude proxy). It needs no npm packages.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8383
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
USER node
EXPOSE 8383
CMD ["node", "server/index.js"]
