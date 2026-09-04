# Database Migrations

Run migrations against the Supabase transaction-pooler connection before a
production deploy:

```bash
DATABASE_URL="..." npm run db:migrate
```

The runner records each applied file in `schema_migrations`, uses a PostgreSQL
advisory lock so only one deploy migrates at a time, and executes each migration
inside a transaction. Migration files are append-only after production use.

The application still creates missing tables defensively, but deployment must
not rely on a customer request to establish the production schema.
