# Changelog

All notable changes to FluxArr will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **IMDB Ratings via OMDB**
  - OMDB API integration to fetch IMDB ratings for shows
  - Configure OMDB API key in Settings → Connections (admin only)
  - Test button to verify API key before saving
  - IMDB ratings displayed on show cards (primary) and TVMaze ratings (secondary)
  - Show detail pages display both ratings with labels
  - Background sync fetches IMDB ratings for shows with IMDB IDs
  - Manual IMDB sync available via `npm run sync -- --imdb`

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

[Unreleased]: https://github.com/yourusername/fluxarr/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/fluxarr/releases/tag/v0.1.0
