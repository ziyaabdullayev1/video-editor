# Stage 1: Building the code
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Run the built code
FROM node:20-alpine as runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm install --production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000

CMD ["npm", "start"]
