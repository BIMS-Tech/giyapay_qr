FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Dependencies first so this layer is reused when only source changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY controller ./controller
COPY database ./database
COPY middleware ./middleware
COPY model ./model
COPY Routes ./Routes
COPY utils ./utils
COPY index.js ./index.js

# No .env is copied: it is gitignored (so CI cannot build with it) and baking
# secrets into an image is a leak waiting to happen. Cloud Run supplies these
# as environment variables / Secret Manager references instead.

EXPOSE 3000
USER node

# nodemon is a file watcher - pointless and wasteful inside a container.
CMD ["node", "index.js"]
