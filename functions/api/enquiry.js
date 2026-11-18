// POST /api/enquiry — validates an enquiry, stores it in D1 and emails it via Resend.
// Secrets (set with `wrangler pages secret put`): RESEND_API_KEY, optional ENQUIRY_FROM.

const MAX = { name: 120, email: 160, service: 60, details: 4000 };

const services = new Set([
  'Video Editing',
  'Graphic Design',
  'UGC Ads',
  'Web Development',
  'PR (Coming Soon)',
  'Multiple Services',
  'Other Services'
]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

export async function onRequestPost({ request, env }) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'Invalid request.' }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot: bots fill the hidden "company" field.
  if (clean(body.company)) return json({ ok: true });

  const name = clean(body.name);
  const email = clean(body.email);
  const service = clean(body.service);
  const details = clean(body.details);
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);

  if (name.length < 2 || name.length > MAX.name) return json({ error: 'Please enter a valid name.' }, 400);
  if (!emailOk || email.length > MAX.email) return json({ error: 'Please enter a valid email address.' }, 400);
  if (!services.has(service)) return json({ error: 'Please select a service.' }, 400);
  if (details.length < 10 || details.length > MAX.details) {
    return json({ error: 'Please add a few details about the project.' }, 400);
  }

  const createdAt = new Date().toISOString();

  try {
    await env.DB
      .prepare('INSERT INTO enquiries (name, email, service, details, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(name, email, service, details, createdAt)
      .run();
  } catch (error) {
    console.error('D1 insert failed', error.message);
    return json({ error: 'We could not save your enquiry.' }, 500);
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing — enquiry stored but not emailed.');
    return json({ error: 'Email delivery is not configured yet.' }, 503);
  }

  const to = env.ENQUIRY_TO || 'glowbalbloomwork@gmail.com';
  const from = env.ENQUIRY_FROM || 'Brand Bloom Labs <onboarding@resend.dev>';

  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Service: ${service}`,
    `Received: ${createdAt}`,
    '',
    details
  ].join('\n');

  const html = `
    <h2>New enquiry — Brand Bloom Labs</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}</p>
    <p><strong>Received:</strong> ${createdAt}</p>
    <hr>
    <p style="white-space:pre-line">${escapeHtml(details)}</p>`;

  try {
    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], reply_to: email, subject: `New enquiry — ${service} — ${name}`, text, html })
    });

    if (!resend.ok) {
      const detail = await resend.text();
      console.error('Resend failed', resend.status, detail.slice(0, 300));
      return json({ error: 'We could not deliver your enquiry by email.' }, 502);
    }
  } catch (error) {
    console.error('Resend request failed', error.message);
    return json({ error: 'We could not deliver your enquiry by email.' }, 502);
  }

  return json({ ok: true });
}

// Anything other than POST on this route.
export const onRequest = ({ request }) =>
  request.method === 'POST' ? new Response('Method Not Allowed', { status: 405 }) : json({ error: 'Method Not Allowed' }, 405);
