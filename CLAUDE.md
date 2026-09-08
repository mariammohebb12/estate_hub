# Estate Hub — Project Brief for Claude Code

## What this app is
A real estate mobile app (iOS + Android via Expo/React Native) that combines
buying, selling, and renting into one app with a mode toggle, plus AI-assisted
search and AI-assisted listing creation.

## Tech stack (do not deviate without discussion)
- **Frontend**: React Native + Expo (TypeScript)
- **Navigation**: React Navigation
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI**: OpenAI API (GPT-4o-mini) — called ONLY from Supabase Edge Functions,
  never directly from the client. Never hardcode or expose API keys client-side.
- **Push notifications**: Expo Notifications + push tokens stored in Supabase

## Core concept
- Single account per user. No separate buyer/seller account types.
- Users toggle between **Buy**, **Rent**, and **Sell** modes at any time from
  the same account (persistent mode switcher, e.g. in header or profile).
- Mode determines what the home feed and navigation show.

## Design direction
Visual reference: clean, photo-forward real estate app UI (see attached
Dribbble reference — Cozmiq real estate UI).
- Big hero photography on cards and detail screens
- Rounded corners throughout (cards, buttons, chips, images)
- Light/white backgrounds, minimal chrome, photography does the work
- Pill-shaped filter chips (e.g. "Comfy," "Resort," "Beach," "Villa")
- 2-column grid for listing cards: photo, name, location, price, heart/favorite icon
- Bottom tab bar: Home, Favorites (heart), Bookings/Calendar, Search, Profile
- Detail screen: full-bleed hero image carousel, agent/seller contact card,
  overview text block, prominent black CTA button at bottom
  ("Book Viewing" for buy mode, "Book Dates" for rent mode)
- Typography: clean sans-serif, clear hierarchy (large title, muted subtext)

## Feature breakdown

### Buyer / Renter mode (build this first, with seed/dummy data)
- Home feed: grid of listing cards, pull to refresh
- Manual filters: bedrooms, price range, location, property type
- AI search bar: natural language input (e.g. "modern 2 bedroom near the
  beach") — sent to an Edge Function, which calls OpenAI to extract structured
  filters (bedrooms, style keywords, location hints), then filters/ranks listings
- AI search and manual filters both available and can combine
- Favorites: heart icon on cards, saved list accessible from bottom tab
- Listing detail page: photo gallery, description, price, location, agent info
- **Buy flow**: shows owner/agent contact info + available viewing time slots
  (sequential, fixed slots e.g. 10:00-10:30, 10:30-11:00). Booking a slot locks
  it. Sends push notification to the seller on booking.
- **Rent flow**: shows a calendar for selecting available rental date range,
  price is per-night as set by the seller

### Seller mode (build second, wires into real data)
- "My Listings" screen: list of the seller's own properties + status
  (Available / Under Offer / Sold / Rented)
- Create/edit listing form: title, description, price, bedrooms, property
  type, location, multi-photo upload (gallery, not single photo)
- AI-enhance button next to text fields (e.g. title, description) — sends
  current field text to an Edge Function, which calls OpenAI to improve the
  writing, returns suggested text for the user to accept/edit
- Availability management: seller sets which time slots they're available
  for tours (buy mode) or blocks off rental date ranges (rent mode) — this
  directly populates what buyers/renters see as bookable
- Changing listing status to Under Offer/Sold/Rented cancels remaining future
  open slots and should notify anyone with a slot booked after that point

### Shared
- Auth: signup/login (Supabase Auth)
- Profile screen: user info, mode switcher, push notification settings
- Push notifications: seller notified when a buyer books a slot

## Data model (see schema.sql for full detail)
Tables: users, listings, listing_photos, availability_slots, bookings, favorites

## Conventions
- TypeScript everywhere, strict mode
- Functional components + hooks only
- Keep API calls (Supabase client, Edge Function calls) in a dedicated
  `/services` or `/api` folder, not inline in components
- Feature-based folder structure under `/screens` (e.g. `/screens/buyer`,
  `/screens/seller`, `/screens/shared`)
- One focused feature/screen per Claude Code task — do not ask for
  "build the whole app" in one prompt
- Commit after each working feature

## Out of scope for v1 (do not build unless asked)
- Payments / in-app purchases
- In-app messaging/chat between buyer and seller (phone/message icons are
  just tap-to-call / tap-to-text using the device's native apps for now)
- Reviews/ratings
- Multi-language support
