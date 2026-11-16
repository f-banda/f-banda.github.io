# f-banda.com

Personal portfolio — a single page built with [Astro](https://astro.build), animated with
[GSAP](https://gsap.com) (ScrollTrigger, SplitText, ScrambleText) and [Lenis](https://lenis.darkroom.engineering) smooth scrolling,
and deployed to GitHub Pages by GitHub Actions.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

The site honours the visitor's "reduce motion" setting. Add `?motion=on` to the URL to preview full motion anyway.

## Structure

- `src/pages/index.astro` — the page (all text lives here)
- `src/components/ChatWidget.astro` + `src/scripts/chat.ts` — the "Message me" support-chat contact form
- `src/config/contact.ts` — reCAPTCHA + EmailJS keys for the chat (setup steps inside)
- `src/scripts/motion.ts` — scroll and intro animations; `src/scripts/site.ts` — nav and NFL demo dialog
- `src/styles/` — `global.css` (original design), `motion.css`, `chat.css`
- `public/` — files copied as-is (`CNAME`, images, favicon)

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it.
One-time: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
