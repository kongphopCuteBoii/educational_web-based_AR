// Public, keyless catalogue adapter for the three.ws CC0 object library.
// The library manifest explicitly supports browser CORS and contains direct GLB + thumbnail URLs.
const API_BASE = 'https://three.ws/api/objects/library';
let libraryPromise;

function pick(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function normalizeAsset(candidate) {
    const id = String(candidate?.name || candidate?.id || candidate?.url || '');
    const title = pick(candidate?.label, candidate?.title, candidate?.name, id, 'Untitled model');
    return {
        id: id || title,
        title,
        summary: [
            ...(Array.isArray(candidate?.categories) ? candidate.categories : []),
            ...(Array.isArray(candidate?.tags) ? candidate.tags : []),
            candidate?.source ? 'Source: ' + candidate.source : ''
        ].filter(Boolean).join(' · ') || 'CC0 3D object',
        preview: pick(candidate?.thumb, candidate?.thumbnail, candidate?.preview),
        modelUrl: candidate?.url || '',
        assetUrl: candidate?.url || '',
        license: pick(candidate?.license, 'CC0')
    };
}

async function loadLibrary(signal) {
    if (!libraryPromise) {
        libraryPromise = fetch(API_BASE + '?limit=1000&offset=0', {
            headers: { Accept: 'application/json' },
            mode: 'cors',
            signal
        }).then(async (response) => {
            if (!response.ok) throw new Error('Catalogue request failed (' + response.status + ')');
            const payload = await response.json();
            const objects = Array.isArray(payload?.objects) ? payload.objects : [];
            return objects.map(normalizeAsset).filter((asset) => /^https:\/\//i.test(asset.modelUrl));
        }).catch((error) => {
            libraryPromise = null;
            throw error;
        });
    }
    return libraryPromise;
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false };

    const library = await loadLibrary(options.signal);
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = library.map((asset) => {
        const haystack = [asset.title, asset.summary, asset.id].join(' ').toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { asset, score };
    }).filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.asset.title.localeCompare(b.asset.title))
      .map((entry) => entry.asset);

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 24));
    const start = (page - 1) * limit;
    return {
        assets: matches.slice(start, start + limit),
        page,
        hasMore: start + limit < matches.length
    };
}

// Retained for the existing AR code; catalogue selection remains a separate flow.
export async function resolveModel(item) {
    return { url: item.modelUrl, source: 'bundled fallback', attribution: null };
}
