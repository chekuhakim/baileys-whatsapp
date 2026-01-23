# Stage 1: Build the React dashboard
FROM node:20-alpine AS dashboard-builder

WORKDIR /app/dashboard

# Copy dashboard package files
COPY dashboard/package*.json ./

# Install dependencies
RUN npm ci

# Copy dashboard source
COPY dashboard/ ./

# Build the dashboard
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 and Ghostscript
RUN apk add --no-cache python3 make g++ ghostscript

# Copy backend package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Copy backend source
COPY bot.js ./
COPY API_GUIDE.md ./

# Copy built dashboard from builder stage
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist

# Create directories for persistent data
RUN mkdir -p /app/auth_info_baileys /app/uploads /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "bot.js"]
