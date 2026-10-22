// Public catalogue adapter. The remote object manifest may be empty or unavailable,
// so keep a local starter index rather than presenting an empty feed as a successful search.
const API_BASE = 'https://three.ws/api/objects/library';
let libraryPromise;

const STARTER_ASSETS = [
    { id: 'water-molecule', title: 'Water molecule (H₂O)', summary: 'Chemistry · molecular structure · oxygen and hydrogen', preview: '', modelUrl: new URL('../models/h2o.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'water molecule h2o chemistry oxygen hydrogen atom molecule science' },
    { id: 'argon-atom', title: 'Argon atom', summary: 'Chemistry · element · electron shells', preview: '', modelUrl: new URL('../models/ar18.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'argon atom electron shell element chemistry proton electron atomic model science' },
    { id: 'saturn', title: 'Saturn', summary: 'Astronomy · planet · rings', preview: '', modelUrl: new URL('../models/saturn.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'saturn planet astronomy space ring solar system gas giant' },
    { id: 'sun', title: 'Sun', summary: 'Astronomy · star · solar system', preview: '', modelUrl: new URL('../models/sun.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'sun star astronomy space solar system solar energy' },
    { id: 'camel', title: 'Camel', summary: 'Biology · animal · desert adaptation', preview: '', modelUrl: new URL('../models/camel_r.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'camel animal biology desert dromedary bactrian mammal adaptation' }
];

function normalizeAsset(candidate) {
    const id = String(candidate?.name || candidate?.id || candidate?.url || '');
    const title = candidate?.label || candidate?.title || candidate?.name || id || 'Untitled model';
    return {
        id: id || title,
        title,
        summary: [
            ...(Array.isArray(candidate?.categories) ? candidate.categories : []),
            ...(Array.isArray(candidate?.tags) ? candidate.tags : []),
            candidate?.source ? 'Source: ' + candidate.source : ''
        ].filter(Boolean).join(' · ') || 'CC0 3D object',
        preview: candidate?.thumb || candidate?.thumbnail || candidate?.preview || '',
        modelUrl: candidate?.url || '',
        assetUrl: candidate?.url ? 'https://three.ws/app#model=' + encodeURIComponent(candidate.url) + '&kind=object&title=' + encodeURIComponent(title) : '',
        license: candidate?.license || 'CC0',
        keywords: [title, candidate?.name, ...(candidate?.categories || []), ...(candidate?.tags || [])].filter(Boolean).join(' ')
    };
}

async function loadLibrary(signal) {
    if (!libraryPromise) {
        libraryPromise = fetch(API_BASE + '?limit=1000&offset=0', {
            headers: { Accept: 'application/json' }, mode: 'cors', signal
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

function pageNumber(value) { return Math.max(1, Number(value) || 1); }

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false };

    let library = [];
    let sourceUnavailable = false;
    try {
        library = await loadLibrary(options.signal);
        sourceUnavailable = library.length === 0;
    } catch {
        sourceUnavailable = true;
    }

    // Local starter models keep the feed useful if the upstream manifest is empty/down.
    const combined = [...STARTER_ASSETS, ...library];
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = combined.map((asset) => {
        const haystack = [asset.title, asset.summary, asset.id, asset.keywords || ''].join(' ').toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { asset, score };
    }).filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.asset.title.localeCompare(b.asset.title))
      .map((entry) => entry.asset);

    const usedStarterFallback = matches.length === 0 && pageNumber(options.page) === 1;
    if (usedStarterFallback) matches.push(...STARTER_ASSETS);

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 24));
    const start = (page - 1) * limit;
    return {
        assets: matches.slice(start, start + limit),
        page,
        hasMore: start + limit < matches.length,
        source: sourceUnavailable ? 'local-fallback' : 'remote-and-local',
        notice: usedStarterFallback ? 'No exact matches were found. Showing the available starter models instead.' : (sourceUnavailable ? 'Remote catalogue is unavailable; showing local starter models where relevant.' : '')
    };
}

// Retained for the existing AR code; catalogue selection remains separate.
export async function resolveModel(item) {
    return { url: item.modelUrl, source: 'bundled fallback', attribution: null };
}
