// All motion for the page: smooth scrolling (Lenis) + GSAP timelines and scroll-driven animation.
// Everything here is progressive: without JS, or with "reduce motion" on, the page is fully visible and static.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { motionForced, prefersReducedMotion } from './prefs';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
// Sections carry their own top padding, so landing a section at the very top keeps
// its heading clear of the fixed header (same as the original anchor behaviour).
const HEADER_OFFSET = 0;

let lenis: Lenis | null = null;

// While a nav click is gliding the page, skip work the user won't see (header hiding,
// indicator hops, slow reveals) — that's what made long jumps stutter.
let jumping = false;
let moveIndicator: ((link: HTMLAnchorElement | null) => void) | null = null;
const FAST_PX_PER_FRAME = 55;
const isFast = () => jumping || Math.abs(lenis?.velocity ?? 0) > FAST_PX_PER_FRAME;
/** Use as a ScrollTrigger onEnter: if we arrived at speed, finish the entrance instantly. */
const finishIfFast = (self: ScrollTrigger) => { if (isFast()) self.animation?.progress(1); };
/** onEnter, onLeave, onEnterBack, onLeaveBack — entrances never rewind once shown. */
const ENTRANCE = 'play complete play none';
const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* ----------------------------------------------------------------------------- smooth scroll */
function initSmoothScroll() {
  lenis = new Lenis({ autoRaf: false, lerp: 0.12, prevent: (node) => !!node.closest('[data-lenis-prevent]') });
  ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Pause page scrolling while a dialog (NFL demo, chat on mobile) owns the screen.
  window.addEventListener('scroll-lock', (e) => ((e as CustomEvent<boolean>).detail ? lenis?.stop() : lenis?.start()));
}

function initAnchors() {
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || link.hasAttribute('data-chat-open') || event.defaultPrevented) return;
    const id = link.getAttribute('href')!;
    const target = id === '#top' || id === '#' ? 0 : $(id);
    if (target === null) return;
    event.preventDefault();
    if (link.hasAttribute('data-nav-link')) moveIndicator?.(link);
    if (lenis) {
      // Duration scales with distance (0.6–1.2s) so short hops feel snappy and long ones don't drag.
      const destY = target === 0 ? 0 : target.getBoundingClientRect().top + scrollY + HEADER_OFFSET;
      const distance = Math.abs(destY - scrollY);
      jumping = true;
      document.documentElement.classList.add('is-jumping');
      $('[data-header]')?.classList.remove('is-hidden');
      lenis.scrollTo(target, {
        offset: HEADER_OFFSET,
        duration: Math.min(1.2, Math.max(0.6, distance / 4000)),
        easing: expoOut,
        lock: true,
        onComplete: () => {
          jumping = false;
          document.documentElement.classList.remove('is-jumping');
        },
      });
    } else if (target === 0) window.scrollTo({ top: 0 });
    else target.scrollIntoView();
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });
}

/* ----------------------------------------------------------------------------- header + nav */
function initHeader() {
  const header = $('[data-header]');
  const bar = $('[data-progress]');
  if (bar) gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.25 } });
  if (!header) return;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header.classList.toggle('scrolled', y > 12);
      if (jumping) return;
      const menuOpen = $('[data-nav]')?.classList.contains('open');
      header.classList.toggle('is-hidden', self.direction === 1 && y > 520 && !menuOpen);
    },
  });
}

function initNavIndicator() {
  const indicator = $('[data-nav-indicator]');
  const links = $$<HTMLAnchorElement>('[data-nav-link]');
  if (!indicator || !links.length) return;

  let current: HTMLAnchorElement | null | undefined;
  const moveTo = (link: HTMLAnchorElement | null) => {
    if (link === current) return;
    current = link;
    links.forEach((l) => l.classList.toggle('is-active', l === link));
    if (!link) return gsap.to(indicator, { opacity: 0, duration: 0.3, overwrite: 'auto' });
    gsap.to(indicator, { x: link.offsetLeft, width: link.offsetWidth, opacity: 1, duration: 0.55, ease: 'expo.out', overwrite: 'auto' });
  };
  moveIndicator = moveTo;
  // Sections passed mid-jump don't steal the indicator from the link that was clicked.
  const onSection = (link: HTMLAnchorElement | null) => (self: ScrollTrigger) => { if (self.isActive && !jumping) moveTo(link); };

  links.forEach((link) => {
    const section = $(link.getAttribute('href')!);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: onSection(link),
    });
  });
  ScrollTrigger.create({ trigger: '#top', start: 'top top', end: 'bottom 45%', onToggle: onSection(null) });
}

/* ----------------------------------------------------------------------------- hero intro */
function initHero() {
  const title = $('[data-hero-title]');
  const items = $$('[data-hero-item]');
  const chips = $$('[data-hero-stack] span');
  const visual = $('[data-hero-visual]');
  const codeLines = $$('.system-card .code-line');
  const typed = $('[data-type]');
  const stats = $$('.floating-stat');
  const fullCommand = typed?.textContent ?? '';

  gsap.set([title, ...items, $('[data-hero-stack]'), visual], { visibility: 'visible' });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });

  if (title) {
    const split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    tl.from(split.lines, { yPercent: 115, duration: 1.3, stagger: 0.12 }, 0);
  }
  tl.from(items, { y: 26, opacity: 0, duration: 1.1, stagger: 0.09 }, 0.35)
    .from(chips, { y: 14, opacity: 0, scale: 0.9, duration: 0.7, stagger: 0.05 }, 0.8);

  if (visual) {
    tl.from(visual, { y: 60, opacity: 0, rotateX: 14, transformPerspective: 1200, duration: 1.5 }, 0.25)
      .from(codeLines, { x: -14, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, 0.8)
      .from(stats, { scale: 0.6, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'back.out(1.8)' }, 1.1);
  }

  if (typed && fullCommand) {
    typed.textContent = '';
    const state = { n: 0 };
    tl.to(state, {
      n: fullCommand.length,
      duration: fullCommand.length * 0.032,
      ease: 'none',
      onUpdate: () => { typed.textContent = fullCommand.slice(0, Math.round(state.n)); },
    }, 1.35);
  }

  // Idle float on the stat chips once they're in.
  tl.add(() => {
    const floats = stats.map((el, i) => gsap.to(el, { y: i ? 8 : -8, duration: 2.6 + i, ease: 'sine.inOut', repeat: -1, yoyo: true }));
    ScrollTrigger.create({ trigger: '#top', start: 'top top', end: 'bottom top', onToggle: (self) => floats.forEach((t) => (self.isActive ? t.play() : t.pause())) });
  });

  // Hero drifts away as you scroll past it.
  gsap.to('[data-hero-copy]', { yPercent: -12, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  if (visual) gsap.to(visual, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  $$('[data-glow]').forEach((glow, i) =>
    gsap.to(glow, { y: i ? -260 : 220, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1 } }),
  );
}

/* ----------------------------------------------------------------------------- section reveals */
function initHeadings() {
  $$('[data-scramble]').forEach((el) => {
    const text = el.textContent ?? '';
    gsap.to(el, {
      scrambleText: { text, chars: '0123456789/—', speed: 0.6, revealDelay: 0.15 },
      duration: 1.1,
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: ENTRANCE, onEnter: finishIfFast },
    });
  });

  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: ENTRANCE, onEnter: finishIfFast },
        }),
    });
  });
}

function initReveals() {
  const reveals = $$('.reveal').filter((el) => !el.closest('#top'));
  gsap.set(reveals, { y: 34, opacity: 0 });
  const show = (batch: Element[]) =>
    isFast()
      ? gsap.set(batch, { y: 0, opacity: 1, overwrite: 'auto' })
      : gsap.to(batch, { y: 0, opacity: 1, duration: 1.1, stagger: 0.12, ease: 'expo.out', overwrite: 'auto' });
  ScrollTrigger.batch(reveals, {
    start: 'top 88%',
    onEnter: show,
    onEnterBack: show, // scrolling up into a section that was skipped (e.g. page restored at the bottom)
    onLeave: (batch) => gsap.set(batch, { y: 0, opacity: 1, overwrite: 'auto' }),
  });

  // About: the lead paragraph "reads itself" as you scroll through it.
  const lead = $('.about-copy .lead-copy');
  if (lead) {
    SplitText.create(lead, {
      type: 'words',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, {
          opacity: 0.18,
          stagger: 0.04,
          ease: 'none',
          scrollTrigger: { trigger: lead, start: 'top 80%', end: 'bottom 45%', scrub: true },
        }),
    });
  }
  gsap.from('.about-card__row', {
    x: 24, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: '.about-card', start: 'top 82%', toggleActions: ENTRANCE, onEnter: finishIfFast },
  });
}

function initTimeline() {
  const timeline = $('[data-timeline]');
  if (!timeline) return;
  const progress = document.createElement('span');
  progress.className = 'timeline-progress';
  progress.setAttribute('aria-hidden', 'true');
  timeline.prepend(progress);

  gsap.fromTo(progress, { scaleY: 0 }, {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: timeline, start: 'top 60%', end: 'bottom 60%', scrub: 0.4 },
  });
  $$('.timeline-item', timeline).forEach((item) => {
    ScrollTrigger.create({ trigger: item, start: 'top 60%', end: 'max', toggleClass: { targets: item, className: 'is-reached' } });
    gsap.from($$('li, .tag-row span', item), {
      x: 18, opacity: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out',
      scrollTrigger: { trigger: item, start: 'top 78%', toggleActions: ENTRANCE, onEnter: finishIfFast },
    });
  });
}

function initProjects() {
  $$('[data-parallax-box]').forEach((box) => {
    const layers = $$(':scope > :not(.preview-label)', box);
    gsap.fromTo(layers, { yPercent: 6 }, {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // NFL preview: players run their routes when the card is on screen.
  const field = $('.data-preview');
  if (field) {
    const play = gsap.timeline({ repeat: -1, repeatDelay: 0.6, yoyo: true, paused: true, defaults: { duration: 2.2, ease: 'sine.inOut' } });
    play.to('.player--1', { x: 176, y: 71 }, 0).to('.player--2', { x: 97, y: -108 }, 0).to('.player--3', { x: -46, y: 64 }, 0);
    gsap.from('.route', { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.2, scrollTrigger: { trigger: field, start: 'top 80%', toggleActions: ENTRANCE, onEnter: finishIfFast } });
    ScrollTrigger.create({ trigger: field, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? play.play() : play.pause()) });
  }

  // PlanPebble preview: pebbles drop into their days, then the picked day lights up.
  const calendar = $('.pebble-cal');
  if (calendar) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: calendar, start: 'top 82%', toggleActions: ENTRANCE, onEnter: finishIfFast } });
    tl.from(calendar, { y: 30, rotateX: 12, opacity: 0, transformPerspective: 900, duration: 1, ease: 'expo.out' })
      .from($$('.pebble', calendar), { scale: 0, y: -6, duration: 0.45, ease: 'back.out(3)', stagger: { each: 0.025, from: 'random' } }, 0.35)
      .from('.pebble-day--pick', { scale: 0.6, duration: 0.6, ease: 'back.out(2.2)' }, '-=0.15');
  }

  // Arcade preview: invaders march in steps, the cannon tracks them.
  const arcade = $('.arcade-preview');
  if (arcade) {
    const march = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
    march.to('.pixel-invader', { x: 34, duration: 2.4, ease: 'steps(6)' }, 0).to('.pixel-cannon', { x: 60, duration: 2.4, ease: 'sine.inOut' }, 0);
    ScrollTrigger.create({ trigger: arcade, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? march.play() : march.pause()) });
  }
}

function initMisc() {
  gsap.from('.skill-card', {
    y: 40, opacity: 0, duration: 1, stagger: { each: 0.1, grid: 'auto', from: 'start' }, ease: 'expo.out',
    scrollTrigger: { trigger: '.skills-grid', start: 'top 82%', toggleActions: ENTRANCE, onEnter: finishIfFast },
  });
  const niu = $('[data-float]');
  if (niu) {
    gsap.from(niu, { rotate: -14, scale: 0.7, opacity: 0, duration: 1.4, ease: 'elastic.out(1, 0.6)', scrollTrigger: { trigger: niu, start: 'top 85%', toggleActions: ENTRANCE, onEnter: finishIfFast } });
    gsap.to(niu, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: niu, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  const contact = $('.contact-card');
  if (contact) {
    // One-shot (not scrubbed): the contact card is the last section, so on tall screens the page
    // can't scroll far enough to finish a scroll-linked reveal, which left the card clipped.
    gsap.fromTo(contact, { clipPath: 'inset(12% 8% 12% 8% round 28px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 28px)',
      duration: 1.2,
      ease: 'expo.out',
      clearProps: 'clipPath',
      scrollTrigger: { trigger: contact, start: 'top 90%', toggleActions: ENTRANCE, onEnter: finishIfFast },
    });
  }
}

/* ----------------------------------------------------------------------------- pointer effects */
function initPointer() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const glow = $('[data-cursor-glow]');
  if (glow) {
    const gx = gsap.quickTo(glow, 'x', { duration: 0.8, ease: 'power3' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.8, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { gx(e.clientX); gy(e.clientY); glow.classList.add('is-on'); }, { passive: true });
    document.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
  }

  const card = $('[data-tilt]');
  const visual = $('[data-hero-visual]');
  if (card && visual) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.9, ease: 'power3' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.9, ease: 'power3' });
    gsap.set(card, { rotationX: 3, rotationY: -6, transformPerspective: 1200 });
    visual.addEventListener('pointermove', (e) => {
      const r = visual.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 14 - 6);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 10 + 3);
    });
    visual.addEventListener('pointerleave', () => { rx(3); ry(-6); });
  }

  $$('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  $$('.magnetic').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.28);
      my((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

/* ----------------------------------------------------------------------------- entry */
export function initMotion() {
  (window as unknown as { __motionReady?: boolean }).__motionReady = true;
  initAnchors();

  if (motionForced()) document.documentElement.classList.add('motion-forced');
  const reduce = prefersReducedMotion();
  if (reduce) {
    document.documentElement.classList.add('motion-off');
    const header = $('[data-header]');
    const onScroll = () => header?.classList.toggle('scrolled', scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return;
  }

  initSmoothScroll();
  initHeader();
  initHero();
  initHeadings();
  initReveals();
  initTimeline();
  initProjects();
  initMisc();
  initPointer();
  initNavIndicator();

  // Anything the page loaded past (refresh at the bottom, deep links) is shown immediately,
  // so scrolling back up never reveals empty sections.
  const completePassed = () => {
    ScrollTrigger.getAll().forEach((st) => {
      if (st.animation && !st.vars.scrub && st.progress === 1) st.animation.progress(1);
    });
    $('.reveal').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.88) gsap.set(el, { y: 0, opacity: 1, overwrite: 'auto' });
    });
  };
  ScrollTrigger.addEventListener('refresh', completePassed);
  completePassed();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
