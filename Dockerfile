# Use Node.js LTS as the base image
FROM node:20-slim

# Install dependencies for Puppeteer and Google Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Create the downloads directory
RUN mkdir -p downloads && chmod 777 downloads

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Set environment for production/headless mode in Docker
ENV NODE_ENV=production
ENV HEADLESS=true

# Expose the API port (defaulting to 3000 if not set)
EXPOSE 3000

# Generate Prisma Client
RUN npx prisma generate

# Start the application
CMD [ "pnpm", "start" ]
