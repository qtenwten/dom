# DOM encyclopedia architecture

## Goal

Create a large repair and construction reference that feels like a mobile app and stays maintainable when the catalog grows to hundreds or thousands of guides.

The product is task-first. A user should be able to arrive with a practical question such as "how do I cut a socket-box opening in drywall?" and reach a short, structured answer without reading a generic article about drywall.

## Repository boundary

This repository is the source of truth for the Dom repair encyclopedia.

The application is intentionally standalone:

- it does not depend on the main qsen React router;
- it can be deployed at a site root or under a path such as /dom/;
- the service worker derives its base path from its own registration scope;
- the PWA manifest uses relative start and scope URLs;
- the project has no mandatory build step.

## Current structure

index.html
- application shell;
- sticky global search;
- mobile bottom navigation;
- PWA metadata.

content.js
- category registry;
- structured guide records;
- first drywall guides.

app.js
- hash routing;
- local search;
- saved guides in localStorage;
- category and guide rendering;
- related guides;
- rough partition calculator;
- PWA installation handling.

styles.css
- mobile-first application layout;
- tablet and desktop responsive states;
- safe-area support.

manifest.webmanifest
- standalone launch mode;
- path-portable scope and start URL.

sw.js
- caches only the application shell inside its own scope;
- offline fallback for the standalone app.

icon.svg
- standalone application icon.

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

This model keeps content separate from rendering and lets one guide appear through different discovery paths later, for example material, task, tool, problem or construction node.

## Information quality

Construction content must not rely on a single unsourced rule.

Recommended evidence order:

1. current regulations and standards when applicable;
2. technical albums and installation manuals from the selected system manufacturer;
3. product technical sheets and safety data;
4. professional practice, clearly labelled as practice rather than a mandatory rule.

MVP guides are marked as working drafts where exact dimensions or system-specific requirements still need verification.

## Planned discovery model

A guide should eventually be reachable by multiple facets:

- category: drywall, electrical, plumbing, finishing;
- action: build, cut, fasten, repair, find;
- material: drywall, concrete, brick, wood;
- object: socket box, doorway, shelf, pipe;
- problem: cracked joint, loose box, hidden stud.

The first release uses local weighted text search. The structured fields already support later filtering without migrating content.

## Route strategy

The MVP is a single static application with internal hash routes:

- #/home
- #/search
- #/category/drywall
- #/guide/drywall-socket-box
- #/calculator
- #/saved

When the content taxonomy stabilizes, public indexable guide URLs can be introduced as a separate SEO phase.

## First content block

Drywall is the pilot domain because it exercises most future patterns:

- framing;
- openings;
- cutting;
- fastening;
- insulation;
- finishing;
- hidden structure detection;
- load mounting;
- repair of mistakes.

The starter data includes ten working guides and one material calculator.

## Next milestones

1. Verify every drywall guide against manufacturer systems and applicable current rules.
2. Add source metadata and a visible evidence layer to each recommendation.
3. Expand drywall to a complete practical set, including corners, multiple layers, ceilings, moisture zones and service penetrations.
4. Add purpose-built diagrams and photos.
5. Improve calculator logic for openings, sheet orientation, stock profile lengths and shopping lists.
6. Add project collections such as Bathroom, Garage and Apartment.
7. Add electrical and plumbing sections only after their safety and evidence requirements are defined.
8. Introduce indexable non-hash URLs when the content is mature enough.

## Product principle

The core flow is:

task -> steps -> diagram -> mistakes -> rescue -> verified source

The interface should always optimize for the person who is standing at the worksite with a phone in one hand.
