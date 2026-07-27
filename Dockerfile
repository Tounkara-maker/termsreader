FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite frontend and esbuild backend server
RUN npm run build

# Expose container port (Cloud Run passes PORT env var)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Start production server
CMD ["npm", "start"]