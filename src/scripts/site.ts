// Core page behaviour: mobile nav, footer year, and the NFL project dialog.
// Animations live in motion.ts; the contact chat lives in chat.ts.

const NOTEBOOK = 'https://api.observablehq.com/d/29a945f48b8c39dc.js?v=4';
const RUNTIME = 'https://cdn.jsdelivr.net/npm/@observablehq/runtime@5/dist/runtime.js';
const INSPECTOR_CSS = 'https://cdn.jsdelivr.net/npm/@observablehq/inspector@5/dist/inspector.css';

function initNav() {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const setOpen = (open: boolean) => {
    nav?.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  };
  toggle?.addEventListener('click', () => setOpen(!nav?.classList.contains('open')));
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
}

function initProjectModal() {
  const modal = document.querySelector<HTMLElement>('[data-project-modal]');
  if (!modal) return;
  const status = modal.querySelector<HTMLElement>('[data-nfl-status]');
  let loaded = false;
  let lastFocus: HTMLElement | null = null;

  const loadNotebook = async () => {
    if (loaded) return;
    loaded = true;
    try {
      if (!document.querySelector(`link[href="${INSPECTOR_CSS}"]`)) {
        const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: INSPECTOR_CSS });
        document.head.append(css);
      }
      const [{ Runtime, Inspector }, { default: define }] = await Promise.all([
        import(/* @vite-ignore */ RUNTIME),
        import(/* @vite-ignore */ NOTEBOOK),
      ]);
      new Runtime().module(define, (name: string) => {
        const el = modal.querySelector(`[data-cell="${name}"]`);
        if (el) return new Inspector(el);
        return ['drawField', 'max_frame', 'progress'].includes(name);
      });
      status?.remove();
    } catch {
      loaded = false;
      if (status) status.textContent = 'Couldn’t load the visualizer right now — please try again in a moment.';
    }
  };

  const setOpen = (open: boolean) => {
    modal.classList.toggle('is-open', open);
    modal.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('is-locked', open);
    window.dispatchEvent(new CustomEvent('scroll-lock', { detail: open }));
    if (open) {
      lastFocus = document.activeElement as HTMLElement | null;
      modal.querySelector<HTMLElement>('.project-modal__close')?.focus();
      loadNotebook();
    } else {
      lastFocus?.focus();
    }
  };

  document.querySelectorAll<HTMLElement>('[data-project-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => setOpen(true));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
    });
  });
  modal.querySelectorAll('[data-project-close]').forEach((btn) => btn.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) setOpen(false);
  });
}

export function initSite() {
  const year = document.querySelector('#year');
  if (year) year.textContent = `© ${new Date().getFullYear()}`;
  initNav();
  initProjectModal();
}
