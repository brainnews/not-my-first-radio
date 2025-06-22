addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Get the target URL from the query parameter
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  try {
    // Forward the request to the target URL
    const response = await fetch(targetUrl, {
      headers: {
        // Forward the Range header if present (important for streaming)
        'Range': request.headers.get('Range') || '',
        // Add any other headers you want to forward
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0'
      }
    })

    // Create a new response with the same body but with CORS headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': response.headers.get('Content-Type') || 'audio/aac',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Content-Range': response.headers.get('Content-Range') || '',
        'Accept-Ranges': 'bytes'
      }
    })
  } catch (error) {
    return new Response('Error fetching stream: ' + error.message, { status: 500 })
  }
} 