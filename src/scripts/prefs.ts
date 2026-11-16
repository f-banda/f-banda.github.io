// Respect the visitor's "reduce motion" setting. Append ?motion=on to the URL to preview full motion anyway.
export const motionForced = () => /[?&]motion=on\b/.test(location.search);
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches && !motionForced();
