# ============================================================
# STAGE 1: Build Stage — compile the React/Vite app
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching trick — see backend Dockerfile).
COPY package.json package-lock.json ./

# Install ALL dependencies (we need vite, @vitejs/plugin-react, etc. to build).
RUN npm ci

# Copy the rest of the source code.
COPY . .

# Build the production bundle.
# Vite outputs static files to the /app/dist folder.
RUN npm run build

# ============================================================
# STAGE 2: Production Stage — serve with Nginx
# ============================================================
# Nginx is a high-performance web server. Perfect for serving static files.
# The full node image would be wasteful here — we only need a file server.
FROM nginx:alpine AS production

# Remove the default Nginx welcome page.
RUN rm -rf /usr/share/nginx/html/*

# Copy our built React app (the dist/ folder) into Nginx's serving directory.
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx config (handles React Router's client-side routing).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx serves on port 80 by default.
EXPOSE 80

# Start Nginx in the foreground (containers need a foreground process).
CMD ["nginx", "-g", "daemon off;"]
