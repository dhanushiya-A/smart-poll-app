# Supabase Setup for Smart Poll App

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional, defaults to `5000`)

## Step-by-step setup

1. Create or sign in to a Supabase account at https://app.supabase.com.
2. Create a new project.
3. In the project settings, copy the `API URL` and set it to `SUPABASE_URL`.
4. In `Settings > API`, copy the `anon public` key and set it to `SUPABASE_ANON_KEY`.
5. In `Settings > API`, copy the `service_role` key and set it to `SUPABASE_SERVICE_ROLE_KEY`.
6. Create the following tables using the provided SQL schema in `supabase-schema.sql`.
7. Create a `.env` file in the project root and populate it with the values from `.env.example`.
8. Install dependencies:
   - `npm install`
9. Start the app:
   - `npm start`
10. Open the browser at `http://127.0.0.1:5000/`.

## Notes

- The server uses the service role key for database operations and auth verification.
- The frontend still talks to the backend API at `/api/*`.
- Authentication is handled by Supabase Auth via backend wrappers.
