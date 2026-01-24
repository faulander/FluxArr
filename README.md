<img width="2363" height="1329" alt="image" src="https://github.com/user-attachments/assets/4a30cfcf-75ca-46f5-a839-ca051037b39f" />

# FluxArr

A modern TV show discovery and management app that helps you find new shows and send them directly to your Sonarr instances.

## What is FluxArr?

FluxArr pulls TV show data from TVMaze and presents it in a beautiful, searchable interface. Found a show you want to watch? Send it to Sonarr with one click and let your media server handle the rest.

## Features

### Discover Shows
- Browse thousands of TV shows with cover art, ratings, and detailed information
- Search by title to quickly find what you're looking for
- Filter by genre, language, status, network, rating, premiere date, and more
- Use include/exclude filters for precise control over search results
- IMDB ratings displayed alongside TVMaze ratings (via OMDB API)

### Multi-Sonarr Support
- Connect multiple Sonarr instances (e.g., one for English content, one for German)
- See which Sonarr instance(s) already have each show
- Add shows to any connected instance with quality profile and root folder selection
- Shared instances available for multi-user setups

### Saved Filters
- Create filter presets for your favorite configurations
- Set a default filter that loads automatically
- Apply saved filters with one click

### Background Sync
- Automatic TVMaze data synchronization keeps your library current
- Incremental updates fetch only what's changed
- Configure sync intervals to your preference

### Additional Features
- Dark/light theme support
- User authentication with registration
- System logs with filtering and export
- Health monitoring endpoint for Docker deployments

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/faulander/fluxarr.git
cd fluxarr

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Run database migrations
npm run db:migrate

# Sync TV show data from TVMaze
npm run sync

# Start the app
npm run dev
```

Open http://localhost:5173 and create your account.

### First-Time Setup

1. **Register** - Create your user account
2. **Add Sonarr** - Go to Settings → Sonarr and connect your instance(s)
3. **Browse** - Head to Discover to explore shows
4. **Send** - Click any show and hit "Send to Sonarr"

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# App settings
PUBLIC_APP_NAME="FluxArr"
PUBLIC_APP_URL="http://localhost:5173"

# Session secret (generate a random string)
AUTH_SECRET="your-secret-key-here"
```

### Connecting Sonarr

1. Go to **Settings → Connections**
2. Click **Add** in the Sonarr section
3. Enter your Sonarr URL (e.g., `http://localhost:8989`)
4. Enter your API key (found in Sonarr → Settings → General → Security)
5. Test the connection and save

You can add multiple Sonarr instances and set one as the default.

### IMDB Ratings (OMDB)

FluxArr can display IMDB ratings alongside TVMaze ratings by connecting to the OMDB API.

1. Get a free API key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) (1,000 requests/day)
2. Go to **Settings → Connections** (admin only)
3. Click **Configure** in the OMDB section
4. Enter your API key and test the connection
5. Save - IMDB ratings will be fetched during the next sync

You can also run a dedicated IMDB sync:
```bash
npm run sync -- --imdb
```

## Data Sync

FluxArr uses TVMaze as its data source. The background job handles automatic updates, but you can also sync manually:

```bash
# Incremental sync (only recent changes)
npm run sync

# Full sync (rebuilds entire database)
npm run sync:full
```

Configure sync frequency in **Settings → Background Jobs**.

## Docker Deployment

The easiest way to run FluxArr is with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/yourusername/fluxarr.git
cd fluxarr

# Start with Docker Compose
docker compose up -d

# View logs
docker compose logs -f
```

Open http://localhost:3001 and create your account.

The included `docker-compose.yml` handles everything:
- Builds the image from source
- Persists database in a Docker volume
- Auto-restarts on failure
- Health monitoring

### Manual Docker

```bash
# Build the image
docker build -t fluxarr .

# Run the container
docker run -d \
  --name fluxarr \
  -p 3000:3000 \
  -v fluxarr-data:/app/data \
  --restart unless-stopped \
  fluxarr
```

The container includes a health check at `/api/health`.

### Data Persistence

The SQLite database is stored in `/app/data` inside the container. The docker-compose.yml mounts this to a named volume (`fluxarr-data`) for persistence.

To backup your data:
```bash
docker cp fluxarr:/app/data/fluxarr.db ./backup.db
```

### Initial TVMaze Sync

On first launch, you can trigger a data sync through the Settings UI or run it manually:

```bash
docker compose exec fluxarr npm run sync
```

The background job will handle incremental updates after the initial sync.

## Development

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run check        # Type checking
npm run lint         # Lint code
npm run format       # Format code
```

## License

MIT
