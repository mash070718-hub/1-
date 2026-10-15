# Shared publication storage

Install `setup.sql` in the user's Supabase SQL Editor, create the user's confirmed account, and explicitly add only its UUID to `library_admins`. The hosted [administrator guide](../docs/ADMIN_SETUP.html) contains the full beginner workflow. Never ship a service-role key or password. `docs/cloud-config.json` is the runtime configuration for GitHub Pages; `public/cloud-config.json` is the local Vite counterpart. Keep them synchronized when connecting a real project.

`test-bootstrap.sql` creates a minimal Supabase-style auth schema **only in an empty disposable local PostgreSQL database**, then `test-permissions.sql` exercises actual PostgreSQL roles, privileges, RLS policies, publication visibility and optimistic concurrency. Do not run these two test files in a real Supabase project. They create test accounts and roles. `setup.sql` is the production installation.

Validated locally with PostgreSQL 17, using:

```sh
docker run --name limbus-permission-test -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17-alpine
# Wait until pg_isready reports ready.
docker exec limbus-permission-test pg_isready -U postgres
docker exec -i limbus-permission-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/test-bootstrap.sql
docker exec -i limbus-permission-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/setup.sql
docker exec -i limbus-permission-test psql -U postgres -v ON_ERROR_STOP=1 < supabase/test-permissions.sql
docker rm -f limbus-permission-test
```

This validates SQL access controls in PostgreSQL. Browser tests use a mocked Supabase HTTP boundary; live Auth/PostgREST/Pages integration still requires a user-owned project and administrator account.

## Mirror deck screenshots

Run `screenshots.sql` once in the existing Supabase project's SQL Editor, after `setup.sql`. The beginner guide is [SCREENSHOT_SETUP.html](../docs/SCREENSHOT_SETUP.html). No new keys or passwords are required. The private `mirror-deck-screenshots` bucket accepts WebP files up to 2 MiB. The browser decodes PNG/JPEG/WebP originals, scales to at most 2560 pixels on the longest side, removes metadata by re-encoding, and saves up to three image references per mirror deck. JSON backups preserve references and captions, not image bytes; retain the storage files to restore those backups.

Only library administrators can insert/read draft images. Anonymous and nonadmin users may read only paths referenced by the current published library. Uploads use new immutable paths; removing an attachment from a draft does not delete files or alter the public library. There are no image update/delete policies, preserving published images and old backups.

To test image RLS in an empty disposable PostgreSQL database, run `test-bootstrap.sql`, `setup.sql`, `test-storage-bootstrap.sql`, `screenshots.sql`, then `test-screenshot-permissions.sql`, with `ON_ERROR_STOP=1`. The storage bootstrap is test-only and must never be run in Supabase. The test checks real PostgreSQL policies; it does not stand in for the hosted Supabase Storage HTTP service.
