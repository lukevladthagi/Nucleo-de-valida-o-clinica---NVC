FROM node:24-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_CREATE_BASE_URL
ARG NEXT_PUBLIC_CREATE_HOST
ARG NEXT_PUBLIC_PROJECT_GROUP_ID

ENV NEXT_PUBLIC_CREATE_BASE_URL=$NEXT_PUBLIC_CREATE_BASE_URL
ENV NEXT_PUBLIC_CREATE_HOST=$NEXT_PUBLIC_CREATE_HOST
ENV NEXT_PUBLIC_PROJECT_GROUP_ID=$NEXT_PUBLIC_PROJECT_GROUP_ID

COPY . .

RUN corepack enable \
  && corepack yarn install --immutable \
  && corepack yarn workspace web build

FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4003

COPY --from=builder /app ./

EXPOSE 4003

CMD ["sh", "-c", "corepack enable && corepack yarn workspace web next start --port 4003"]
