# carstamp.app

The CarStamp website as published: `public/` is the built site, `src/index.js` the Worker that serves it with
security and cache headers, `wrangler.toml` its configuration. Cloudflare deploys every push to `main`.

Nothing here is edited by hand. The sources live in the CarStamp app repository (`website-sources/`); its
`tools/website/publish.sh` builds the site, copies it into `public/` here, commits and pushes.
