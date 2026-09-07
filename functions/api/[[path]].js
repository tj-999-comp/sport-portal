export async function onRequest(context) {
  if (!context.env.SPORTAL_API) {
    return new Response('API service binding is not configured', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  return context.env.SPORTAL_API.fetch(context.request);
}
