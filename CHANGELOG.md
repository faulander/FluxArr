# Changelog

All notable changes to FluxArr will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.3] - 2026-02-16

### Added

- **Movie Filter Panel** - Dedicated filter panel for movies with language, genre, status, country, TMDB/IMDB rating, release date, and runtime filters
- **Saved Filters: Movie Support** - Filters page now has a Shows/Movies tab toggle; saved filters are scoped by content type with separate defaults
- **Movie Requests** - Requests page now has a Shows/Movies tab toggle showing Radarr request status (Downloaded, Monitored, Pending, Failed) with poster thumbnails

### Changed

- Saved filters now store a `content_type` column (`show` or `movie`) to separate show and movie filter presets
- Default filter logic is now scoped per content type (show default and movie default are independent)
- Requests API accepts `type` parameter (`show` or `movie`) to fetch the correct request type

## [0.4.2] - 2026-02-16

### Added

- **Movie Browse Page** - Phase 3 of movie integration
  - New "Movies" navigation item with Film icon
  - Movies grid page with search, sort (TMDB Rating, IMDB Rating, Title, Release Date, Popularity, Updated), and infinite scroll
  - Movie card component with TMDB poster images, ratings (IMDB + TMDB), status badges, and Radarr quick-add
  - Movie detail page with hero section, poster, tagline, genre badges, overview, and production info
  - Radarr integration on movie detail: status banner showing which instances have the movie, "Send to Radarr" dialog with instance/quality profile/root folder selection
  - External links to IMDb and TMDB from movie detail page
  - Budget and revenue display with formatted currency
  - TMDB attribution on movie pages (required by TMDB Terms of Service)
  - API routes: `/api/movies` (paginated query with search/sort/filter), `/api/movies/options` (filter options)

### Changed

- Renamed "Discover" navigation item to "Shows"
- Renamed "Discover Shows" page title to "Shows"
- Renamed "Back to Discover" link on show detail page to "Back to Shows"

## [0.4.1] - 2026-02-16

### Added

- **Radarr Integration** - Phase 2 of movie integration
  - Radarr API client (v3 API) with test connection, quality profiles, root folders, movie lookup, and add movie
  - Radarr config management: add/edit/delete instances per user, set default, shared configs for admins
  - Radarr library sync: caches all movies from connected Radarr instances with TMDB ID mapping
  - Radarr library sync background job (default: every 5 minutes)
  - Movie request tracking: tracks movies added to Radarr with status (pending/added/downloading/completed/failed)
  - Radarr section in Settings > Connections with add dialog, test connection, and instance management
  - API routes: `/api/radarr/configs` (CRUD), `/api/radarr/test`, `/api/radarr/add`
  - Radarr logger for monitoring sync operations in Settings > Logs

## [0.4.0] - 2026-02-16

### Added

- **Movie Database Foundation** - Phase 1 of movie integration
  - New `movies` table with TMDB as primary data source (~20,000-50,000 movies seeded on first sync)
  - Full-text search (FTS5) on movie titles and overviews
  - TMDB API client with rate limiting, discover, popular, top-rated, search, and changes endpoints
  - TMDB sync background job: seeds on first run, then incremental updates every 6 hours
  - TMDB API key configuration in Settings > Connections (admin only) with test button
  - Movie query layer with filter support: language, genre, status, country, TMDB rating, IMDB rating, release date, runtime
  - Movie-specific filter types with sort options: title, TMDB rating, IMDB rating, release date, popularity, updated
  - TMDB logger for monitoring sync operations in Settings > Logs

### Changed

- OMDB IMDB ratings sync now also fetches ratings for movies (uses remaining budget after shows)

## [0.3.4] - 2026-02-16

### Added

- **IMDB Rating Sort** - New "IMDB Rating" option in the sort dropdown (existing "Rating" renamed to "TVMaze Rating" for clarity)
- **IMDB Rating Filter** - New IMDB Rating min/max fields in the filter panel with "Include shows without IMDB rating" checkbox
- IMDB rating filter badge shown in the active filters bar

## [0.3.3] - 2026-02-16

### Added

- **OMDB Background Job** - IMDB ratings now sync automatically as a background job (Settings > Jobs)
  - Configurable interval (default: every 15 minutes)
  - Batch size auto-calculated from OMDB plan limit and interval to use the full daily quota
  - Premium plan (100k/day) covers all ~80k shows within the first day
  - Enable/disable, adjust interval, and trigger manually from the Jobs settings page
  - OMDB sync logs visible in Settings > Logs under the "OMDB" source

### Changed

- OMDB sync in CLI worker (`npm run sync`) now uses 90% of the daily budget per run instead of a fixed small batch (90k for premium, 90 for free)

### Fixed

- IMDB ratings were not being fetched automatically - the sync only ran via the external CLI script (`npm run sync`), not as part of the app's background job system

## [0.3.2] - 2025-01-25

### Added

- **Sort Shows**
  - New sort dropdown button next to filters on the Discover/Shows page
  - Sort options: Rating (default), Name, First Aired, Recently Updated
  - Click the same sort option to toggle between ascending and descending order
  - Sort preference persists in URL for sharing and bookmarking
  - Sorting works with infinite scroll pagination

## [0.3.1] - 2025-01-24

### Added

- **Changes Page**
  - New "Changes" section in navigation to track TV show updates
  - Displays changes detected during incremental sync: new shows, status changes, rating changes, name changes, network changes, premiere dates
  - Changes grouped by date with show image, description, and timestamp
  - Click any change to navigate to the show detail page
  - Pagination for browsing through change history
  - Changes automatically cleaned up after 30 days

### Fixed

- "Add to Sonarr" overlay button now uses custom highlight color instead of hardcoded green

## [0.3.0] - 2025-01-23

### Added

- **Custom Highlight Colors**
  - New "Appearance" section in Settings
  - Color picker for light mode highlight color
  - Color picker for dark mode highlight color
  - Quick preset colors: Blue, Green, Purple, Orange, Pink, Teal, Red, Default
  - Live preview of color changes
  - Colors persist per-user in the database
  - Colors automatically apply on page load and when switching themes

## [0.2.1] - 2025-01-23

### Fixed

- Requests page now shows correct episode count (monitored episodes vs total including unaired/specials)

## [0.2.0] - 2025-01-23

### Added

- **IMDB Ratings via OMDB**
  - OMDB API integration to fetch IMDB ratings for shows
  - Configure OMDB API key in Settings → Connections (admin only)
  - Test button to verify API key before saving
  - IMDB ratings displayed on show cards (primary) and TVMaze ratings (secondary)
  - Show detail pages display both ratings with labels
  - Smart priority-based IMDB sync that always uses the full daily quota (1000 requests):
    - Priority 1: Shows never fetched (no rating yet)
    - Priority 2: Running/In Development shows
    - Priority 3: Recently ended (< 2 years)
    - Priority 4: Older ended (2-5 years)
    - Priority 5: Very old shows (5+ years)
    - Within each priority, most stale shows are updated first
  - Manual IMDB sync available via `npm run sync -- --imdb`

- **Quick Add to Sonarr**
  - "Add to Sonarr" button appears on hover over show cards
  - Popover with Sonarr instance, quality profile, and root folder selection
  - Button only shows for shows not already in all connected Sonarr instances
  - Centered green button design for better visibility

- **Connections Settings**
  - New unified "Connections" section in settings
  - Sonarr and OMDB configurations in one place

- **Filter Improvements**
  - "Include unrated shows" checkbox in rating filter
  - Shows without ratings can now be included regardless of rating filter settings

### Changed

- Moved Sonarr settings from dedicated section to Connections
- Rating badge on show cards now shows IMDB rating first (when available)

### Fixed

- Filter panel now properly syncs when editing saved filters
- First air date filter works correctly with only "after" or "before" set
- New Filter dialog on filters page now opens correctly
- Docker deployment: migrations path resolution for containerized environments
- Docker deployment: cookie secure flag configurable via COOKIE_SECURE env var for HTTP access

## [0.1.0] - 2025-01-23

### Added

- **Authentication System**
  - User registration and login with secure password hashing
  - Cookie-based session management
  - Role-based access control (admin, user, restricted)

- **TV Show Discovery**
  - TVMaze integration with automatic sync
  - Browse and search TV shows
  - Show detail pages with full metadata
  - Grid view with show cards displaying poster, rating, and status

- **Advanced Filtering**
  - Filter by language, genre, status, type, network, and streaming service
  - Include/exclude logic for flexible filtering
  - Rating range filters (min/max)
  - First aired date filters (before/after)
  - Saved filter presets with quick apply

- **Sonarr Integration**
  - Multiple Sonarr instance support
  - Send shows to Sonarr with quality profile and root folder selection
  - Sonarr library sync every 5 minutes
  - Visual indicators for shows already in Sonarr

- **User Management**
  - Admin dashboard for user management
  - Create, edit, and delete users
  - Role assignment and restrictions

- **Settings**
  - Profile settings with password change
  - Sonarr configuration management
  - Background job status monitoring
  - Application logs viewer (admin only)

- **UI/UX**
  - Responsive design for mobile and desktop
  - Dark and light theme support
  - Toast notifications for user feedback

### Technical

- SvelteKit 2.x with Svelte 5 (runes syntax)
- SQLite database with better-sqlite3
- TailwindCSS 4.x for styling
- shadcn-svelte UI components
- Docker support with health checks

[Unreleased]: https://github.com/yourusername/fluxarr/compare/v0.4.3...HEAD
[0.4.3]: https://github.com/yourusername/fluxarr/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/yourusername/fluxarr/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/yourusername/fluxarr/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/yourusername/fluxarr/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/yourusername/fluxarr/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/yourusername/fluxarr/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/yourusername/fluxarr/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/yourusername/fluxarr/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yourusername/fluxarr/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/yourusername/fluxarr/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yourusername/fluxarr/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourusername/fluxarr/releases/tag/v0.1.0
