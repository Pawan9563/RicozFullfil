# ============================================================
# STAGE 1: Build Stage (install dependencies)
# ============================================================
# We use a lightweight Node.js image as our base.
# "alpine" is a tiny Linux distro (~5MB). The full node image is ~300MB.
FROM node:20-alpine AS builder

# Set the working directory INSIDE the container.
# All subsequent commands run from this path.
WORKDIR /app

# Copy ONLY the package files first.
# Why? Docker caches each step (called a "layer"). If package.json
# hasn't changed, Docker reuses the cached npm install — saving time.
COPY package.json package-lock.json ./

# Install only production dependencies (skip devDependencies like nodemon).
RUN npm ci --omit=dev

# ============================================================
# STAGE 2: Production Stage (the actual running container)
# ============================================================
FROM node:20-alpine AS production

# Create a non-root user for security.
# Running as root inside a container is a bad practice.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy the installed node_modules from the builder stage.
# This is called a "multi-stage build" — keeps the final image lean.
COPY --from=builder /app/node_modules ./node_modules

# Copy the rest of the application source code.
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./

# Switch to the non-root user we created above.
USER appuser

# Tell Docker this container listens on port 8000.
# This is documentation only — it doesn't actually open the port.
EXPOSE 8000

# The command that runs when the container starts.
# We use "node" directly (not nodemon) since this is production.
CMD ["node", "src/index.js"]
