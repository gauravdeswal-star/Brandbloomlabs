# Brand Bloom Labs

Single-page site for Brand Bloom Labs (Cloudflare Pages) with a Pages Function
(`functions/api/enquiry.js`) that validates enquiries, stores them in D1 and emails
them to glowbalbloomwork@gmail.com through Resend.

## Files

- `index.html`, `assets/styles.css`, `assets/app.js` — the site (no build step)
- `functions/api/enquiry.js` — `POST /api/enquiry`
- `schema.sql` — D1 table
- `wrangler.toml` — Pages config + D1 binding

## Local preview

```bash
npx wrangler pages dev . --d1 DB=brand-bloom-labs
```

## Deploy

```bash
npx wrangler d1 create brand-bloom-labs          # put the id in wrangler.toml
npx wrangler d1 execute brand-bloom-labs --remote --file=schema.sql
npx wrangler pages project create brand-bloom-labs
npx wrangler pages deploy . --project-name=brand-bloom-labs
npx wrangler pages secret put RESEND_API_KEY --project-name=brand-bloom-labs
npx wrangler pages secret put ENQUIRY_FROM --project-name=brand-bloom-labs   # e.g. Brand Bloom Labs <hello@yourdomain.com>
```

`ENQUIRY_TO` defaults to `glowbalbloomwork@gmail.com`. The Resend sending domain must be
verified, otherwise the API rejects the send (the form then shows an error and the
enquiry is still saved in D1).

## Founder photo

Drop the photograph at `assets/gaurav-kumar.jpg` (4:5 portrait). Until that file exists the
plate shows `assets/portrait-holder.svg`, a drawn achromatic placeholder with registration
marks and "portrait — pending" metadata — no broken image, no invented likeness. The real
photo simply covers the holder once it loads; nothing else needs changing.

## Reading enquiries

```bash
npx wrangler d1 execute brand-bloom-labs --remote --command "SELECT * FROM enquiries ORDER BY id DESC LIMIT 20"
```
