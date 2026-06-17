FROM golang:latest

WORKDIR /app

# Instalar Air para hot reload
RUN go install github.com/air-verse/air@latest

COPY go.mod ./
RUN go mod tidy

CMD ["air"]
