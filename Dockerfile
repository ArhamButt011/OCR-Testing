# # FROM node:22-alpine

# # WORKDIR /app

# # # COPY package*.json ./
# # # RUN npm install --verbose

# # COPY . .

# # RUN npm run build

# # EXPOSE 3000

# # CMD ["npm", "start"]

# #----------------------------------------------------------------------------------
    
# # new file content
# # Build stage
# FROM node:18 AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm install --legacy-peer-deps
# COPY . .
# RUN npm run build

# # Production stage
# FROM node:18
# WORKDIR /app

# # Install PM2
# RUN npm install -g pm2

# COPY --from=builder /app /app

# # PM2 ecosystem file
# COPY ecosystem.config.js /app/ecosystem.config.js

# EXPOSE 3000

# CMD ["pm2-runtime", "start", "ecosystem.config.js"]


FROM node:22-alpine

WORKDIR /app

# COPY package*.json ./
# RUN npm install --verbose

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]