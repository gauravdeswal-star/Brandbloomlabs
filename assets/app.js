// Brand Bloom Labs — motion layer, pinned stage, clock and enquiry form.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) document.documentElement.classList.add('js');

/* ---------- nav ---------- */

const nav = document.getElementById('nav');
const navLinks = document.getElementById('nav-links');
const navToggle = document.getElementById('nav-toggle');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(open));
});

navLinks.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- reveals ---------- */

const reveal = (el) => el.classList.add('is-visible');

// Anything already on screen at load is revealed directly and never observed.
document.querySelectorAll('[data-reveal="now"]').forEach((el) => {
  requestAnimationFrame(() => requestAnimationFrame(() => reveal(el)));
});

const pending = new Set(document.querySelectorAll('[data-reveal]:not([data-reveal="now"])'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    reveal(entry.target);
    pending.delete(entry.target);
    observer.unobserve(entry.target);
  });
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

pending.forEach((el) => observer.observe(el));

// Safety net: the same threshold, evaluated on the (already throttled) scroll tick,
// so a throttled or undelivered observer can never leave content invisible.
const checkPending = () => {
  if (!pending.size) return;
  const limit = innerHeight * 0.88;
  pending.forEach((el) => {
    if (el.getBoundingClientRect().top >= limit) return;
    reveal(el);
    observer.unobserve(el);
    pending.delete(el);
  });
};

/* ---------- scroll driven choreography ---------- */

const hero = document.querySelector('.hero');
const heroWord = document.querySelector('.hero__word');
const processSection = document.getElementById('process');
const needle = document.getElementById('dial-needle');
const marquee = document.querySelector('.stage__marquee');
const readout = document.getElementById('stage-readout');
const steps = Array.from(document.querySelectorAll('#steps .step'));
let ticking = false;
let activeStep = 0;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const paint = () => {
  ticking = false;

  nav.classList.toggle('is-stuck', scrollY > 40);
  checkPending();

  if (reduced) return;

  if (hero && heroWord) {
    const height = hero.offsetHeight || 1;
    const p = clamp(scrollY / height);
    heroWord.style.setProperty('--par-word', `${(-p * 26).toFixed(2)}px`);
  }

  if (!processSection || !needle || !marquee) return;

  const travel = processSection.offsetHeight - innerHeight;
  const p = travel > 0 ? clamp(-processSection.getBoundingClientRect().top / travel) : 0;
  const degrees = p * 360;

  needle.style.transform = `rotate(${degrees.toFixed(1)}deg)`;
  marquee.style.setProperty('--mx', `${(-p * 34).toFixed(2)}%`);

  const index = Math.min(3, Math.floor(p * 4));
  if (index !== activeStep) {
    activeStep = index;
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
  }

  readout.textContent = `Step 0${index + 1} / 04 · ${String(Math.round(degrees)).padStart(3, '0')}°`;
};

const requestPaint = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(paint);
};

addEventListener('scroll', requestPaint, { passive: true });
addEventListener('resize', requestPaint);
document.addEventListener('visibilitychange', requestPaint);
requestPaint();

/* ---------- India time ---------- */

const clock = document.getElementById('clock');
const renderClock = () => {
  const time = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit'
  });
  clock.textContent = `IST ${time}`;
};
renderClock();
setInterval(renderClock, 30_000);

/* ---------- founder photo ---------- */

const founderImg = document.getElementById('founder-img');
const hideIfMissing = () => { if (!founderImg.naturalWidth) founderImg.hidden = true; };
founderImg?.addEventListener('load', hideIfMissing);
founderImg?.addEventListener('error', () => { founderImg.hidden = true; });
if (founderImg?.complete) hideIfMissing();

/* ---------- enquiry form ---------- */

const form = document.getElementById('enquiry-form');
const statusEl = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
let sending = false;

const setFieldError = (name, message) => {
  const input = form.elements[name];
  const slot = form.querySelector(`[data-error-for="${name}"]`);
  if (slot) slot.textContent = message || '';
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
};

const validate = (data) => {
  const errors = {};
  if (data.name.trim().length < 2) errors.name = 'Please enter your full name.';
  if (!EMAIL_RE.test(data.email.trim())) errors.email = 'Please enter a valid email address.';
  if (!data.service) errors.service = 'Please choose the service you need.';
  if (data.details.trim().length < 10) errors.details = 'Please add a few details about the project.';
  return errors;
};

const setStatus = (message, type) => {
  statusEl.textContent = message;
  statusEl.className = 'form__status' + (type ? ` is-${type}` : '');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return; // prevent duplicate submissions

  const data = Object.fromEntries(new FormData(form).entries());
  ['name', 'email', 'service', 'details'].forEach((key) => setFieldError(key, ''));

  const errors = validate(data);
  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([key, message]) => setFieldError(key, message));
    setStatus('Please fix the highlighted fields and try again.', 'error');
    form.elements[Object.keys(errors)[0]].focus();
    return;
  }

  sending = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  setStatus('');

  try {
    const response = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'We could not send your enquiry.');

    form.reset();
    setStatus('Thank you — your enquiry has been sent. Gaurav will reply by email soon.', 'success');
  } catch (error) {
    setStatus(
      `${error.message} Please email glowbalbloomwork@gmail.com directly, or message @brandbloomlabs on Instagram.`,
      'error'
    );
  } finally {
    sending = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send enquiry';
  }
});

/* ---------- custom cursor ---------- */

const finePointer = matchMedia('(pointer: fine)').matches;
if (finePointer && !reduced) {
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.innerHTML = '<span class="cursor__dot"></span><span class="cursor__ring"></span>';
  document.body.appendChild(cursor);

  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');

  const interactiveSelector = 'a, button, .pill, .svc, .review, .step, .plate__list li, .spec__row, .direct li, .founder__plate, input, textarea, select, label';

  let mx = 0, my = 0, rx = 0, ry = 0, visible = false;

  addEventListener('mousemove', (event) => {
    mx = event.clientX;
    my = event.clientY;
    if (!visible) { visible = true; cursor.classList.add('is-visible'); }
    const el = document.elementFromPoint(mx, my);
    const over = !!el && !!el.closest(interactiveSelector);
    cursor.classList.toggle('is-hover', over);
  });

  addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  addEventListener('mouseenter', () => { if (visible) cursor.classList.add('is-visible'); });

  const tick = () => {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- theme toggle ---------- */

(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const STORAGE_KEY = 'bbl-theme';

  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    }
  }

  let initial = null;
  try { initial = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (initial !== 'light' && initial !== 'dark') {
    initial = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  apply(initial, false);

  btn.addEventListener('click', function () {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next, true);
  });
})();
