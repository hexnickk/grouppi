FROM node:22

RUN mkdir -p /app
WORKDIR /app

COPY package.json package-lock.json .
RUN npm ci

COPY . .

COPY entrypoint.sh .
ENTRYPOINT ["./entrypoint.sh"]
