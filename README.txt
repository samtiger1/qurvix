QURVIX ALL-IN-ONE UPDATE
========================

Files:
- index.html
- styles.css
- app.js
- supabase_content_update.sql

IMPORTANT:
1. Keep your existing config.js unchanged. It must contain your Supabase URL and PUBLIC publishable/anon key.
2. Upload/replace the three website files (index.html, styles.css, app.js) in the root of your GitHub repository.
3. In Supabase SQL Editor, run supabase_content_update.sql once.
4. Do NOT share or put a service_role/secret key in config.js.
5. This update uses your existing tables: content, profiles, comments.
6. Existing RLS policies must allow public SELECT of published content and admin-only content management. The SQL migration intentionally does not drop/replace any policies.

Admin:
- User profile must have role = 'admin' in public.profiles.
- Content fields used: title, category, type, description, image_url, url, published, youtube_url, extra_links.
- Extra links format: one per line: Label | https://example.com

Notes:
- This is a discovery/catalog website, not a streaming-only website.
- External links are displayed as links; only add content you have permission to share.
- If Supabase reports a permissions error, do not disable RLS. Check your existing policies.
