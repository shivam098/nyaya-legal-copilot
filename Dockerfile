FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY schemas ./schemas
COPY packs ./packs
COPY src ./src
COPY evals ./evals
COPY ui ./ui

RUN mkdir -p /app/data/cases

EXPOSE 4173

CMD ["node", "ui/server.mjs"]
