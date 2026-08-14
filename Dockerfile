# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

# better-sqlite3 là native module, cần toolchain để biên dịch trên alpine.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
# Prisma 7 sinh client vào src/generated, phải có trước khi tsc chạy.
RUN npx prisma generate

COPY . .
RUN npm run build


FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++ wget

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Cần cho `prisma migrate deploy` lúc khởi động container.
COPY prisma ./prisma
COPY prisma.config.ts ./

COPY --from=build /app/dist ./dist

# SQLite nằm trên volume, không nằm trong image.
ENV DATABASE_URL="file:/data/money.db"
VOLUME /data

EXPOSE 3000

# Chạy migration trước rồi mới lên app — thêm cột mới là deploy xong tự áp dụng.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
