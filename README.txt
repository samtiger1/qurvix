QURVIX COMPLETE STARTER PROJECT
===============================

Included:
- Responsive QURVIX website
- Category filtering and search
- Supabase email/password authentication
- Member comments (new comments are pending moderation)
- Admin content dashboard (articles and external download links)
- Privacy, Terms and Contact starter pages
- Supabase SQL schema and row-level security policies

IMPORTANT: This package is a complete starter implementation, but live authentication,
database, admin publishing and comments will NOT work until you connect your own Supabase
project. GitHub Pages alone cannot securely provide those backend services.

SETUP (one-time):
1. Create a Supabase project at https://supabase.com/
2. In Supabase > SQL Editor, run all of supabase_setup.sql.
3. In Supabase > Project Settings > API, copy Project URL and anon/public key.
4. Open config.js and replace the two placeholder values. NEVER use service_role key.
5. In Supabase > Authentication > URL Configuration, add your GitHub Pages URL to
   Site URL and Redirect URLs, e.g. https://YOUR_GITHUB_USERNAME.github.io/qurvix/
6. Sign up on your live QURVIX site with your own email.
7. In Supabase > Authentication > Users, copy your user UUID.
8. In SQL Editor run:
   update public.profiles set role='admin' where id='PASTE-YOUR-USER-UUID';
9. In Supabase > Authentication settings, choose whether email confirmation is required.
10. Publish all files in this folder to the ROOT of your existing GitHub repository,
    replacing the old index.html and adding the other files. Commit to main.
11. Open your GitHub Pages URL and test signup, login, comments and admin publishing.

HOW ADMIN MODERATION WORKS:
- Members can submit comments after logging in.
- New comments have approved=false, so they are not public.
- Admin moderation is supported by the database policy; a moderation UI can be added
  in a future iteration. For now, use Supabase Table Editor > comments to set approved=true
  or delete unwanted comments.
- Admin can add/edit/delete articles and external download links in the website dashboard.

DOWNLOAD SAFETY:
- Add only official/trusted external download URLs.
- Do not upload copyrighted game/app installers without permission.
- This website stores links and text, not user-uploaded files.

SECURITY:
- The anon/public key is intended for browser use when Row Level Security is enabled.
- Never expose a service_role key in config.js or any public repository.
- Review RLS policies and legal pages before inviting users.
- Do not enable AdSense until your content, privacy disclosures and site meet the
  current AdSense policies and eligibility requirements.

LIMITATIONS:
- This starter includes comments and likes? Likes are not implemented in this package.
- Replies and user profile editing are not implemented in this package.
- Admin comment moderation currently uses Supabase dashboard.
- No file uploads are included by design.
