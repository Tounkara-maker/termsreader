FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite frontend and esbuild backend server
RUN npm run build

# Expose container port
ENV PORT=3000
EXPOSE 3000

# Start production server
CMD ["npm", "start"]