# 仁義サンシャイン: game + payment server
FROM node:22-slim
WORKDIR /app
COPY index.html ./index.html
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/game.db
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
