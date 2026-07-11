FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY *.js ./
EXPOSE 4100
CMD ["node", "index.js"]
