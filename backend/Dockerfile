FROM node:20-alpine
# Install docker CLI so backend can spawn `docker run gosom/...` via host socket
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
