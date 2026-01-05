# GeoScale

AI-powered location-based landing page generator for WordPress.

## Tech Stack

- **React 19.2.0** - UI framework
- **Vite 7.2.0** - Build tool
- **TypeScript 5.9.2** - Type safety
- **Supabase** - Backend, auth, and database
- **Stripe** - Payment processing
- **TanStack Router** - Routing
- **TanStack Query** - Data fetching
- **ShadCN UI** - Component library
- **Tailwind CSS** - Styling

## Project Structure.

```
src/
├── api/          # API client functions
├── components/   # React components
├── hooks/        # Custom React hooks
├── lib/          # Utility libraries (Supabase, utils)
├── pages/        # Page components
├── types/        # TypeScript type definitions
└── utils/        # Helper functions
```

## Environment Variables

Create a `.env` file based on `.env.example`:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key (safe to expose)

**Important**: All sensitive API keys (Google, DataForSEO, OpenAI, Stripe secret keys) are stored in Supabase Secrets and accessed via Edge Functions, not in client-side code.

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

## Production Notes

- The app is configured to prevent page refreshes when switching browser tabs
- Vite is configured to disable HMR in production
- React Query is configured to not refetch on window focus
- Supabase sessions are persisted to prevent auth loss

## WordPress Plugin

A custom WordPress plugin is required for each connected site. See the `wordpress-plugin/` directory (to be created).

