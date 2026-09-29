# DOM encyclopedia architecture

## Goal

Create a large repair and construction reference that feels like a premium native application while staying maintainable when the catalog grows to hundreds or thousands of guides.

The product is task-first: a user should be able to arrive with a practical question such as "how do I cut a socket-box opening in drywall?" and reach a structured answer without reading a generic article about drywall.

## Repository boundary

This repository is the source of truth for the Dom repair encyclopedia.

The application is standalone:

- it does not depend on the main qsen React router;
- it can be deployed at a site root or under a path such as /dom/;
- Vite builds with a relative base;
- the service worker derives its base path from its own registration scope;
- the PWA manifest uses relative start and scope URLs;
- CI and GitHub Pages deployment are owned by this repository.

## Current structure

`index.html`
- minimal React application shell;
- PWA metadata and root mount point.

`src/main.jsx`
- React application and component system;
- hash routing with View Transitions where supported;
- responsive desktop/mobile navigation;
- local search and command palette;
- saved guides in localStorage;
- project workspace and progress;
- guide, catalog and calculator screens;
- install prompt and PWA registration.

`src/styles.css`
- premium visual system;
- dark cinematic landing and warm construction palette;
- desktop workspace and mobile app layouts;
- 3D-style CSS scenes;
- scroll-reveal, hover, tilt and micro-interactions;
- responsive and reduced-motion states.

`content.js`
- category registry;
- structured guide records;
- content remains independent from presentation.

`manifest.webmanifest`, `sw.js`, `icon.svg`
- standalone installable PWA;
- path-portable scope;
- offline shell and runtime asset caching.

`scripts/`
- project validation;
- Vite production build and dist packaging.

## Content model

Each guide has stable fields:

- id
- title
- summary
- category
- task
- material
- difficulty
- duration
- tags
- tools
- materials
- before
- steps
- mistakes
- rescue
- diagram
- verification

The same guide can therefore be discovered through category, material, task, tool, problem or project context without duplicating content.

## Information quality

Construction content must not rely on a single unsourced rule. Recommended evidence order:

1. current regulations and standards when applicable;
2. technical albums and installation manuals from the selected system manufacturer;
3. product technical sheets and safety data;
4. professional practice, clearly labelled as practice rather than a mandatory rule.

MVP guides are marked as working drafts where exact dimensions or system-specific requirements still need verification.

## Route strategy

The React application currently uses portable internal hash routes:

- #/home
- #/catalog
- #/search
- #/category/drywall
- #/guide/drywall-socket-box
- #/calculator
- #/project
- #/saved

When the content taxonomy stabilizes, public indexable guide URLs can be introduced as a separate SEO phase.

## Interaction strategy

Motion should communicate hierarchy rather than decorate every pixel:

- route changes use the browser View Transitions API where available;
- content reveals with IntersectionObserver;
- premium cards can respond to pointer position with subtle perspective tilt;
- primary CTAs use restrained magnetic movement;
- the header exposes scroll progress;
- the command palette opens from Cmd/Ctrl + K;
- all nonessential motion is disabled for prefers-reduced-motion.

## Product principle

The core flow is:

task -> steps -> visual -> mistakes -> rescue -> verified source

The interface should remain useful to a person standing at the worksite with a phone in one hand while still feeling premium on a large desktop display.
