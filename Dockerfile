FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27-alpine AS api
WORKDIR /app
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -buildvcs=false -trimpath -o /universal-post-studio ./cmd/server

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap fonts-dejavu-core libcairo2 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN groupadd --system app && useradd --system --gid app app
RUN mkdir -p /app/generated && chown -R app:app /app/generated
COPY --from=api /universal-post-studio ./universal-post-studio
COPY --from=web /app/web/dist ./web/dist
COPY design_system ./design_system
USER app
EXPOSE 8080
ENV APP_ADDR=:8080 WEB_DIST=web/dist
ENTRYPOINT ["./universal-post-studio"]
