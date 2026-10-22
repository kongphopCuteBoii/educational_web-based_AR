// Poly Haven's official public API: semantic + keyword search over CC0 3D models.
// Search returns ranked slugs; /info/{slug} supplies model metadata and thumbnails.
// External candidates are not treated as directly loadable AR models until a compatible file is resolved.
const API_BASE = 'https://api.polyhaven.com';
const STARTER_ASSETS = [
    { id: 'water-molecule', title: 'Water molecule (H₂O)', summary: 'Chemistry · molecular structure · oxygen and hydrogen', preview: '', modelUrl: new URL('../models/h2o.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'water molecule h2o chemistry oxygen hydrogen atom molecule science' },
    { id: 'argon-atom', title: 'Argon atom', summary: 'Chemistry · element · electron shells', preview: '', modelUrl: new URL('../models/ar18.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'argon atom electron shell element chemistry proton electron atomic model science' },
    { id: 'saturn', title: 'Saturn', summary: 'Astronomy · planet · rings', preview: '', modelUrl: new URL('../models/saturn.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'saturn planet astronomy space ring solar system gas giant' },
    { id: 'sun', title: 'Sun', summary: 'Astronomy · star · solar system', preview: '', modelUrl: new URL('../models/sun.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'sun star astronomy space solar system solar energy' },
    { id: 'camel', title: 'Camel', summary: 'Biology · animal · desert adaptation', preview: '', modelUrl: new URL('../models/camel_r.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'camel animal biology desert dromedary bactrian mammal adaptation' }
];
const metadataCache = new Map();

function pick(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function normalizeAsset(candidate, slug) {
    const name = pick(candidate?.name, candidate?.label, candidate?.title, slug || 'Untitled model');
    const tags = Array.isArray(candidate?.tags) ? candidate.tags : [];
    const categories = Array.isArray(candidate?.categories) ? candidate.categories : [];
    const category = pick(candidate?.category, categories.join(', '));
    return {
        id: slug || name,
        title: name.replace(/[_-]+/g, ' '),
        summary: pick(candidate?.description, [category, ...tags].filter(Boolean).join(' · '), 'CC0 3D model'),
        preview: pick(candidate?.thumbnail_url, candidate?.thumbnail, candidate?.preview),
        modelUrl: '',
        assetUrl: 'https://polyhaven.com/a/' + encodeURIComponent(slug || name),
        license: 'CC0 · Poly Haven',
        keywords: [name, category, ...tags].filter(Boolean).join(' ')
    };
}

async function getModelInfo(slug, signal) {
    if (metadataCache.has(slug)) return metadataCache.get(slug);
    const response = await fetch(API_BASE + '/info/' + encodeURIComponent(slug), {
        headers: { Accept: 'application/json' },
        signal
    });
    if (!response.ok) throw new Error('Model metadata returned HTTP ' + response.status);
    const info = await response.json();
    metadataCache.set(slug, info);
    return info;
}

async function searchRemote(query, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 24));
    const params = new URLSearchParams({
        q: String(query || '').trim().toLowerCase(),
        t: 'models',
        limit: String(limit),
        min: '0'
    });
    const response = await fetch(API_BASE + '/search?' + params.toString(), {
        headers: { Accept: 'application/json' },
        signal: options.signal
    });
    if (!response.ok) throw new Error('Poly Haven search returned HTTP ' + response.status);
    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const start = (page - 1) * limit;
    const pageResults = results.slice(start, start + limit);
    const assets = await Promise.all(pageResults.map(async (item) => {
        const slug = typeof item === 'string' ? item : pick(item?.slug, item?.id);
        // Some API response versions may embed metadata directly in each result.
        let info = item?.name || item?.thumbnail_url || item?.description ? item : null;
        if (!info && slug && payload?.assets?.[slug]) info = payload.assets[slug];
        if (!info && slug) info = await getModelInfo(slug, options.signal);
        return normalizeAsset(info || {}, slug);
    }));
    const total = Number(payload?.total);
    const hasMore = Number.isFinite(total) ? start + pageResults.length < total : start + pageResults.length < results.length;
    return {
        assets,
        page,
        hasMore,
        source: 'polyhaven',
        notice: assets.length
            ? 'Poly Haven CC0 models · select a candidate, then open Details to inspect formats.'
            : 'Poly Haven returned no matches. Try a broader search term.'
    };
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false };

    try {
        const result = await searchRemote(normalizedQuery, options);
        const terms = normalizedQuery.toLowerCase().split(/\\s+/).filter(Boolean);
        const local = STARTER_ASSETS.filter((asset) => {
            const haystack = [asset.title, asset.summary, asset.keywords].join(' ').toLowerCase();
            return terms.some((term) => haystack.includes(term));
        });
        const seen = new Set(result.assets.map((asset) => asset.id));
        result.assets.push(...local.filter((asset) => !seen.has(asset.id)));
        return result;
    } catch (error) {
        const terms = normalizedQuery.toLowerCase().split(/\\s+/).filter(Boolean);
        const local = STARTER_ASSETS.filter((asset) => {
            const haystack = [asset.title, asset.summary, asset.keywords].join(' ').toLowerCase();
            return terms.some((term) => haystack.includes(term));
        });
        return {
            assets: local,
            page: 1,
            hasMore: false,
            source: 'local-fallback',
            notice: local.length
                ? 'Poly Haven API unavailable (' + error.message + '). Showing matching bundled models only.'
                : 'Poly Haven API unavailable (' + error.message + '), and no bundled models match this search.'
        };
    }
}

// External Poly Haven results are catalogue candidates, not direct GLB URLs.
// Keep this function safe for any existing caller; selecting a result does not auto-load it into AR.
export async function resolveModel(item) {
    return { url: item.modelUrl || '', source: item.modelUrl ? 'bundled model' : 'external catalogue candidate', attribution: item.license || null };
}
