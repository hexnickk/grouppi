FROM node:22

RUN mkdir -p /app
WORKDIR /app

COPY package.json package-lock.json .
RUN npm ci
RUN npx playwright install-deps
RUN npx playwright install

COPY . .
