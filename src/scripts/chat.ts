// Support-chat style contact flow: name → email → message → review + reCAPTCHA → send via EmailJS.
// All visitor input is rendered with textContent (never innerHTML).
import { send } from '@emailjs/browser';
import { gsap } from 'gsap';
import { prefersReducedMotion } from './prefs';

type Step = 'name' | 'email' | 'message' | 'review' | 'sent';
type Grecaptcha = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => number;
  getResponse: (id?: number) => string;
  reset: (id?: number) => void;
};
const w = window as unknown as { grecaptcha?: Grecaptcha; onChatCaptchaReady?: () => void };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINKEDIN = 'https://www.linkedin.com/in/fbanda/';
const PROMPTS: Record<'name' | 'email' | 'message', { placeholder: string; label: string; type: string }> = {
  name: { placeholder: 'Type your name…', label: 'Your name', type: 'text' },
  email: { placeholder: 'you@example.com', label: 'Your email address', type: 'email' },
  message: { placeholder: 'Write your message…  (Shift + Enter for a new line)', label: 'Your message', type: 'text' },
};

export function initChat() {
  const root = document.querySelector<HTMLElement>('[data-chat]');
  if (!root) return;
  const panel = root.querySelector<HTMLElement>('[data-chat-panel]')!;
  const launcher = root.querySelector<HTMLButtonElement>('[data-chat-launcher]')!;
  const log = root.querySelector<HTMLOListElement>('[data-chat-log]')!;
  const form = root.querySelector<HTMLFormElement>('[data-chat-form]')!;
  const input = root.querySelector<HTMLTextAreaElement>('[data-chat-input]')!;
  const label = root.querySelector<HTMLElement>('[data-chat-label]')!;
  const honeypot = root.querySelector<HTMLInputElement>('[data-chat-hp]')!;
  const { configured, siteKey = '', publicKey = '', serviceId = '', templateId = '' } = root.dataset;
  const reduce = prefersReducedMotion();
  const mobile = matchMedia('(max-width: 560px)');

  const data = { name: '', email: '', message: '' };
  let step: Step = 'name';
  let started = false;
  let busy = false;
  let returnToReview = false;
  let captchaId: number | undefined;
  let lastFocus: HTMLElement | null = null;

  /* ---------------------------------------------------------------- rendering */
  const scrollToEnd = () => log.scrollTo({ top: log.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });

  const addItem = (from: 'bot' | 'me', content: Node | string, extraClass = '') => {
    const li = document.createElement('li');
    li.className = `chat-msg chat-msg--${from} ${extraClass}`.trim();
    if (typeof content === 'string') li.textContent = content;
    else li.append(content);
    log.append(li);
    if (!reduce) gsap.from(li, { y: 14, opacity: 0, scale: 0.96, transformOrigin: from === 'me' ? '100% 100%' : '0% 100%', duration: 0.45, ease: 'back.out(1.6)' });
    scrollToEnd();
    return li;
  };

  const typing = async (ms: number) => {
    const li = document.createElement('li');
    li.className = 'chat-msg chat-msg--bot chat-typing';
    li.setAttribute('aria-label', 'Robot is typing');
    li.innerHTML = '<span></span><span></span><span></span>';
    log.append(li);
    scrollToEnd();
    await new Promise((r) => setTimeout(r, reduce ? 150 : ms));
    li.remove();
  };

  const say = async (...lines: (string | Node)[]) => {
    for (const line of lines) {
      const len = typeof line === 'string' ? line.length : 60;
      await typing(Math.min(400 + len * 14, 1300));
      addItem('bot', line);
    }
  };

  const linkedInLine = (lead: string) => {
    const frag = document.createDocumentFragment();
    const a = Object.assign(document.createElement('a'), { href: LINKEDIN, target: '_blank', rel: 'noreferrer', textContent: 'LinkedIn' });
    frag.append(lead, a, '.');
    return frag;
  };

  const setComposer = (s: Step) => {
    const enabled = s === 'name' || s === 'email' || s === 'message';
    form.classList.toggle('is-disabled', !enabled);
    input.disabled = !enabled;
    if (!enabled) {
      input.placeholder = s === 'sent' ? 'Message sent' : 'Review your message above';
      input.rows = 1;
      input.value = '';
      autosize();
      return;
    }
    const p = PROMPTS[s];
    input.placeholder = p.placeholder;
    label.textContent = p.label;
    input.setAttribute('inputmode', p.type === 'email' ? 'email' : 'text');
    input.setAttribute('autocomplete', s === 'name' ? 'name' : s === 'email' ? 'email' : 'off');
    input.rows = s === 'message' ? 3 : 1;
    input.value = returnToReview ? data[s] : '';
    autosize();
    if (!panel.hidden) input.focus();
  };

  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  };

  /* ---------------------------------------------------------------- review + captcha */
  const summary = () => {
    const card = document.createElement('div');
    card.className = 'chat-summary';
    (['name', 'email', 'message'] as const).forEach((key) => {
      const row = document.createElement('div');
      row.className = 'chat-summary__row';
      const k = Object.assign(document.createElement('span'), { className: 'chat-summary__key', textContent: key });
      const v = Object.assign(document.createElement('p'), { className: 'chat-summary__val', textContent: data[key] });
      const edit = Object.assign(document.createElement('button'), { type: 'button', className: 'chat-chip', textContent: 'Edit' });
      edit.setAttribute('aria-label', `Edit ${key}`);
      edit.addEventListener('click', () => editField(key));
      row.append(k, edit, v);
      card.append(row);
    });
    return card;
  };

  const loadCaptcha = () =>
    new Promise<void>((resolve, reject) => {
      if (w.grecaptcha?.render) return resolve();
      w.onChatCaptchaReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?onload=onChatCaptchaReady&render=explicit';
      s.async = true;
      s.onerror = () => reject(new Error('recaptcha'));
      document.head.append(s);
    });

  const showReview = async () => {
    step = 'review';
    returnToReview = false;
    setComposer('review');
    await say('Here’s what I’ll send:');
    addItem('bot', summary(), 'chat-msg--wide');

    if (configured !== 'true') {
      await say(linkedInLine('Messaging isn’t switched on yet — for now, the best way to reach me is '));
      return;
    }

    await say('Last step: confirm you’re human, then hit send.');
    const box = document.createElement('div');
    box.className = 'chat-verify';
    const holder = document.createElement('div');
    const error = Object.assign(document.createElement('p'), { className: 'chat-error' });
    error.setAttribute('role', 'alert');
    const sendBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'button button--primary chat-send-final' });
    sendBtn.innerHTML = 'Send message <span aria-hidden="true">→</span>';
    box.append(holder, error, sendBtn);
    addItem('bot', box, 'chat-msg--wide');

    try {
      await loadCaptcha();
      captchaId = w.grecaptcha!.render(holder, {
        sitekey: siteKey,
        theme: 'dark',
        size: panel.clientWidth < 360 ? 'compact' : 'normal',
        callback: () => (error.textContent = ''),
      });
      scrollToEnd();
    } catch {
      error.textContent = 'reCAPTCHA couldn’t load — check your connection or content blocker, then try again.';
    }

    sendBtn.addEventListener('click', async () => {
      if (busy) return;
      if (honeypot.value) return; // bots fill hidden fields; drop silently
      const token = captchaId !== undefined ? w.grecaptcha?.getResponse(captchaId) : '';
      if (!token) { error.textContent = 'Please tick “I’m not a robot” first.'; return; }
      busy = true;
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      try {
        await send(
          serviceId,
          templateId,
          { from_name: data.name, reply_to: data.email, message: data.message, 'g-recaptcha-response': token },
          { publicKey, blockHeadless: true, limitRate: { id: 'chat-contact', throttle: 30_000 } },
        );
        box.remove();
        step = 'sent';
        setComposer('sent');
        await say(`Sent! Thanks, ${data.name} — I’ll get back to you at ${data.email} as soon as possible.`);
      } catch {
        w.grecaptcha?.reset(captchaId);
        sendBtn.disabled = false;
        sendBtn.innerHTML = 'Try again <span aria-hidden="true">→</span>';
        error.textContent = '';
        await say(linkedInLine('That didn’t go through. Please try again in a moment, or reach me on '));
      } finally {
        busy = false;
      }
    });
  };

  const editField = async (key: 'name' | 'email' | 'message') => {
    if (busy || step === 'sent') return;
    log.querySelectorAll('.chat-verify').forEach((el) => el.closest('li')?.remove());
    log.querySelectorAll<HTMLButtonElement>('.chat-summary .chat-chip').forEach((b) => (b.disabled = true));
    captchaId = undefined;
    returnToReview = true;
    step = key;
    await say(key === 'name' ? 'Sure — what should I call you?' : key === 'email' ? 'No problem. What’s the right email?' : 'Go ahead — what would you like to say?');
    setComposer(key);
  };

  /* ---------------------------------------------------------------- flow */
  const advance = async (value: string) => {
    if (step === 'name') {
      if (value.length < 2) return say('Could you tell me your name? Even just a first name is fine.');
      data.name = value.slice(0, 80);
      if (returnToReview) return showReview();
      step = 'email';
      await say(`Nice to meet you, ${data.name}! What email address should I reply to?`);
    } else if (step === 'email') {
      if (!EMAIL_RE.test(value)) return say('Hmm, that doesn’t look like an email address — mind double-checking it?');
      data.email = value.slice(0, 254);
      if (returnToReview) return showReview();
      step = 'message';
      await say('Got it. What would you like to say?');
    } else if (step === 'message') {
      if (value.length < 10) return say('Could you add a little more detail? At least a sentence helps.');
      data.message = value;
      return showReview();
    }
    setComposer(step);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value || busy || input.disabled) return;
    busy = true;
    input.value = '';
    autosize();
    input.disabled = true;
    addItem('me', step === 'message' ? value : value.replace(/\s+/g, ' '));
    try { await advance(value); } finally {
      busy = false;
      if (step === 'name' || step === 'email' || step === 'message') { input.disabled = false; input.focus(); }
    }
  });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  const start = async () => {
    started = true;
    step = 'name';
    input.disabled = true;
    input.placeholder = '…';
    await say('Hey there 👋', 'Thanks for stopping by. Leave your name, email and a message, and I’ll get back to you.', 'First up — what’s your name?');
    setComposer('name');
  };

  const restart = () => {
    if (busy) return;
    log.replaceChildren();
    Object.assign(data, { name: '', email: '', message: '' });
    returnToReview = false;
    captchaId = undefined;
    start();
  };

  /* ---------------------------------------------------------------- open / close */
  const open = () => {
    if (!panel.hidden) return input.focus();
    lastFocus = document.activeElement as HTMLElement | null;
    panel.hidden = false;
    root.classList.add('is-open');
    launcher.setAttribute('aria-expanded', 'true');
    if (mobile.matches) window.dispatchEvent(new CustomEvent('scroll-lock', { detail: true }));
    if (!reduce) gsap.fromTo(panel, { opacity: 0, y: 24, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out', clearProps: 'transform,opacity' });
    if (!started) start();
    else input.focus();
  };

  const close = () => {
    if (panel.hidden) return;
    const done = () => {
      panel.hidden = true;
      root.classList.remove('is-open');
      launcher.setAttribute('aria-expanded', 'false');
      window.dispatchEvent(new CustomEvent('scroll-lock', { detail: false }));
      (lastFocus ?? launcher).focus();
    };
    if (reduce) return done();
    gsap.to(panel, { opacity: 0, y: 16, scale: 0.96, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(panel, { clearProps: 'all' }); done(); } });
  };

  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest('[data-chat-open]');
    if (!trigger) return;
    e.preventDefault();
    if (trigger === launcher && !panel.hidden) close();
    else open();
  });
  root.querySelector('[data-chat-close]')?.addEventListener('click', close);
  root.querySelector('[data-chat-restart]')?.addEventListener('click', restart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });

  // Launcher slides in once the hero intro has played.
  if (!reduce) gsap.from(launcher, { y: 90, opacity: 0, duration: 1, ease: 'expo.out', delay: 2.2 });
}
