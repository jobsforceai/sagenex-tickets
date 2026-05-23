FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /usr/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY app.js server.js ./
COPY config ./config
COPY controllers ./controllers
COPY middleware ./middleware
COPY models ./models
COPY public ./public
COPY routes ./routes
COPY scripts ./scripts
COPY services ./services
COPY utils ./utils
COPY views ./views

EXPOSE 5000

CMD ["node", "server.js"]