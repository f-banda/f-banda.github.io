const header = document.querySelector('[data-header]');
const nav = document.querySelector('[data-nav]');
const navToggle = document.querySelector('[data-nav-toggle]');
const year = document.querySelector('#year');
const toast = document.querySelector('[data-toast]');
const projectModal = document.querySelector('[data-project-modal]');
const projectOpeners = document.querySelectorAll('[data-project-trigger]');
const projectCloseButtons = document.querySelectorAll('[data-project-close]');

if (year) year.textContent = `© ${new Date().getFullYear()}`;

const setProjectModalState = (isOpen) => {
  if (!projectModal) return;
  projectModal.classList.toggle('is-open', isOpen);
  projectModal.setAttribute('aria-hidden', String(!isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

projectOpeners.forEach((trigger) => {
  trigger.addEventListener('click', () => setProjectModalState(true));
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setProjectModalState(true);
    }
  });
});

projectCloseButtons.forEach((button) => {
  button.addEventListener('click', () => setProjectModalState(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && projectModal?.classList.contains('is-open')) {
    setProjectModalState(false);
  }
});

const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

navToggle?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(Boolean(open)));
});

document.querySelectorAll('[data-nav] a').forEach((link) => {
  link.addEventListener('click', () => {
    nav?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

let toastTimer;
document.querySelectorAll('[action-unavailable]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    if (!toast) return;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  });
});
