// Public, keyless catalogue adapter for three.ws' CC0 object library.
// Search results provide direct GLB URLs and optional thumbnails.
const API_BASE = 'https://three.ws/api/catalog';

function candidateList(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ['items', 'results', 'objects', 'assets', 'data']) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
}

function pick(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function getModelUrl(candidate) {
    const url = candidate?.url || candidate?.modelUrl || candidate?.model_url || candidate?.cdnUrl;
    if (typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && /\.glb(?:$|\?)/i.test(parsed.pathname + parsed.search)
            ? parsed.href
            : null;
    } catch {
        return null;
    }
}

export function normalizeAsset(candidate) {
    const id = String(candidate?.id || candidate?.slug || candidate?.key || candidate?.url || '');
    const title = pick(candidate?.title, candidate?.name, candidate?.label, id, 'Untitled model');
    const license = candidate?.license;
    return {
        id: id || title,
        title,
        summary: pick(candidate?.summary, candidate?.description, candidate?.source, 'CC0 model from the three.ws object library.'),
        preview: pick(candidate?.thumb, candidate?.thumbnail, candidate?.thumbnailUrl, candidate?.preview, candidate?.image),
        modelUrl: getModelUrl(candidate),
        assetUrl: pick(candidate?.pageUrl, candidate?.detailsUrl, candidate?.sourceUrl),
        license: pick(typeof license === 'string' ? license : license?.name, 'Check the source asset metadata')
    };
}

export async function searchAssets(query, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 24));
    const params = new URLSearchParams({
        q: String(query || '').trim(),
        kind: 'object',
        limit: String(limit),
        offset: String((page - 1) * limit)
    });
    const response = await fetch(API_BASE + '?' + params.toString(), {
        headers: { Accept: 'application/json' },
        mode: 'cors',
        signal: options.signal
    });
    if (!response.ok) throw new Error('Catalogue request failed (' + response.status + ')');
    const payload = await response.json();
    const assets = candidateList(payload).map(normalizeAsset).filter((asset) => asset.modelUrl);
    const total = Number(payload?.total);
    const nextOffset = Number(payload?.next_offset);
    const hasMore = Number.isFinite(total)
        ? (page * limit) < total
        : Number.isFinite(nextOffset)
            ? nextOffset >= 0
            : assets.length >= limit;
    return { assets, page, hasMore };
}

// Retained for the existing AR code; catalogue selection remains a separate flow.
export async function resolveModel(item) {
    return { url: item.modelUrl, source: 'bundled fallback', attribution: null };
}
