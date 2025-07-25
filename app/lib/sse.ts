export async function sseProxy(
    targetUrl: string,
): Promise<Response> {
    let upstream: Response;

    try {
        upstream = await fetch(targetUrl, {
            headers: {
                Accept: 'text/event-stream',
            },
        });
    } catch (e) {
        console.error('[SSE Proxy] Upstream fetch failed', e);
        return new Response('Failed to fetch upstream SSE', { status: 502 });
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
        return new Response('No response body from upstream', { status: 500 });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    writer.write(encoder.encode(':' + ' '.repeat(2048) + '\n\n'));

    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) await writer.write(value);
            }
        } catch (err) {
            console.error('[SSE Proxy] Stream error', err);
        } finally {
            writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
