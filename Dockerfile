FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_FILE=/app/.data/pathforge.json
EXPOSE 8787
CMD ["node", "src/server.js"]
