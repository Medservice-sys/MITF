FROM golang:latest

# Instalar Node.js para compilar el frontend de React
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Instalar Air para hot reload en Go
RUN go install github.com/air-verse/air@latest

COPY go.mod ./
RUN go mod tidy

# Copiar proyecto y compilar frontend
COPY . .
RUN cd frontend && npm install && npm run build

CMD ["air"]
