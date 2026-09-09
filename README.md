# KISEKI NO OTO — 奇跡ノ音

**KISEKI NO OTO** is a web platform for a Colombian net-label focused on J-Core and Jaycore music.

The website combines the label's identity, music catalogue, and audio player into a single interactive experience. Each release has its own visual environment, while the persistent player allows users to continue listening while navigating the catalogue.

## Features

* **Music catalogue** — Browse the label's releases with artwork, metadata, and audio.
* **Persistent audio player** — Playback continues while navigating between sections.
* **Audio waveform** — Generates a waveform from the actual audio file for track navigation.
* **Dynamic visual themes** — The interface adapts its accent color to the currently selected release.
* **Release pages** — Each release has its own visual presentation and external links.
* **Bilingual interface** — Spanish and English support.
* **Responsive design** — Optimized for desktop and mobile devices.
* **KERNEL CMS** — Private administration interface for managing releases, artwork, and audio.
* **Authentication & authorization** — Google Sign-In with an editor allowlist for catalogue management.
* **Private media storage** — Audio and artwork are stored in Cloudflare R2 and accessed through protected application routes.

## Tech Stack

* **Astro 7**
* **React 19**
* **TypeScript**
* **Firebase / Firestore**
* **Cloudflare R2**
* **Cloudflare Workers**
* **pnpm**

## Architecture

The public website is built with Astro and React, using a single React island for the interactive audio player and catalogue experience.

Firestore stores the release catalogue, while Cloudflare R2 handles audio and artwork storage. Media files are served through the application's routes rather than exposing the storage bucket directly.

The administration interface, **KERNEL**, is separated from the public application and protected through Google authentication and an editor allowlist.

```text
                    ┌─────────────────┐
                    │   Astro + React │
                    │   Public Site   │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
           ┌──────▼──────┐      ┌──────▼──────┐
           │  Firestore  │      │ Cloudflare  │
           │  Catalogue  │      │     R2      │
           └─────────────┘      │ Audio/Media │
                                └─────────────┘
                             │
                     ┌───────▼───────┐
                     │    KERNEL     │
                     │  Admin / CMS  │
                     └───────────────┘
```

## Getting Started

### Requirements

* Node.js `>= 22.12.0`
* pnpm

### Installation

```bash
pnpm install
```

Copy the environment variables:

```bash
cp .env.example .env
```

Then start the development server:

```bash
pnpm astro dev
```

The application will be available at:

```text
http://localhost:4321
```

## Commands

| Command               | Description                                |
| :-------------------- | :----------------------------------------- |
| `pnpm dev`            | Start the development server               |
| `pnpm build`          | Build the production application           |
| `pnpm check`          | Run TypeScript and Astro checks            |
| `pnpm test`           | Run unit tests                             |
| `pnpm icons`          | Regenerate icons and social preview assets |
| `npx wrangler deploy` | Deploy to Cloudflare Workers               |

## Testing

The project includes automated tests covering core application logic, including:

* Audio player state
* Catalogue validation
* Derived catalogue data
* Application utilities

## Deployment

The application is deployed on **Cloudflare Workers**.

The production environment uses:

* **Firestore** for catalogue data
* **Cloudflare R2** for audio and artwork
* **Cloudflare Workers** for the application and media routes

Sensitive server-side configuration is provided through Cloudflare environment secrets.

## Project Structure

```text
src/
├── components/      # UI components
├── lib/             # Application logic and data
├── pages/           # Astro routes
└── ...

docs/
└── ...              # Project documentation
```

## Keyboard Shortcuts

| Key       | Action                 |
| :-------- | :--------------------- |
| `1` – `4` | Switch between views   |
| `Space`   | Play / pause           |
| `←` `→`   | Seek ±5 seconds        |
| Any key   | Skip the boot sequence |
