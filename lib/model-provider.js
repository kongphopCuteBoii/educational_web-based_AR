// Catalogue providers must return a direct, browser-loadable GLB URL before an item is selectable.
// Smithsonian's file-search API exposes direct .glb URIs. Poly Haven remains a future provider:
// its current search results do not resolve to a verified direct GLB file URL.
const SMITHSONIAN_API = 'https://3d-api.si.edu/api/v1.0/content/file/search';
const STARTER_ASSETS = [
    { id: 'water-molecule', title: 'Water molecule (H₂O)', summary: 'Chemistry · molecular structure · oxygen and hydrogen', preview: '', modelUrl: new URL('../models/h2o.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'water molecule h2o chemistry oxygen hydrogen atom molecule science' },
    { id: 'argon-atom', title: 'Argon atom', summary: 'Chemistry · element · electron shells', preview: '', modelUrl: new URL('../models/ar18.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'argon atom electron shell element chemistry proton electron atomic model science' },
    { id: 'saturn', title: 'Saturn', summary: 'Astronomy · planet · rings', preview: '', modelUrl: new URL('../models/saturn.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'saturn planet astronomy space ring solar system gas giant' },
    { id: 'sun', title: 'Sun', summary: 'Astronomy · star · solar system', preview: '', modelUrl: new URL('../models/sun.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'sun star astronomy space solar system solar energy' },
    { id: 'camel', title: 'Camel', summary: 'Biology · animal · desert adaptation', preview: '', modelUrl: new URL('../models/camel_r.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'camel animal biology desert dromedary bactrian mammal adaptation' }
];

function pick(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function localMatches(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return STARTER_ASSETS.filter((asset) => {
        const haystack = [asset.title, asset.summary, asset.keywords].join(' ').toLowerCase();
        return terms.some((term) => haystack.includes(term));
    });
}

function normalizeSmithsonian(row) {
    const content = row?.content || {};
    const modelUrl = pick(content.uri);
    // Never surface a result as selectable unless the API gives us a direct GLB file.
    if (!modelUrl || !/^https:\/\//i.test(modelUrl) || !/\.glb(?:$|[?#])/i.test(modelUrl)) return null;
    const title = pick(row.title, 'Untitled Smithsonian model');
    const id = pick(row.url, modelUrl);
    return {
        id: 'smithsonian:' + id,
        title,
        summary: ['Smithsonian 3D', pick(content.quality), content.draco_compressed === 'true' ? 'Draco-compressed GLB' : 'GLB model'].filter(Boolean).join(' · '),
        preview: '',
        modelUrl,
        assetUrl: 'https://3d.si.edu/',
        license: 'Smithsonian Open Access · check item-level rights',
        source: 'Smithsonian 3D',
        keywords: title + ' Smithsonian 3D museum science education'
    };
}

async function searchSmithsonian(query, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(24, Math.max(1, Number(options.limit) || 24));
    const params = new URLSearchParams({
        q: query,
        file_type: 'glb',
        model_type: 'glb',
        start: String((page - 1) * limit),
        rows: String(limit)
    });
    const response = await fetch(SMITHSONIAN_API + '?' + params.toString(), {
        headers: { Accept: 'application/json' },
        signal: options.signal
    });
    if (!response.ok) throw new Error('Smithsonian 3D search returned HTTP ' + response.status);
    const payload = await response.json();
    const assets = (Array.isArray(payload?.rows) ? payload.rows : [])
        .map(normalizeSmithsonian)
        .filter(Boolean);
    const total = Number(payload?.rowCount);
    return {
        assets,
        page,
        hasMore: Number.isFinite(total) && (page * limit) < total,
        source: 'smithsonian',
        notice: assets.length
            ? 'Smithsonian 3D · direct GLB files returned by the API. Selecting dispatches the model URL to the demo event.'
            : 'Smithsonian returned no directly loadable GLB files for this query. Try another term.'
    };
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false };

    const local = localMatches(normalizedQuery);
    try {
        const result = await searchSmithsonian(normalizedQuery, options);
        const seen = new Set(result.assets.map((asset) => asset.id));
        result.assets.push(...local.filter((asset) => !seen.has(asset.id)));
        return result;
    } catch (error) {
        return {
            assets: local,
            page: 1,
            hasMore: false,
            source: 'local-fallback',
            notice: local.length
                ? 'Smithsonian API unavailable (' + error.message + '). Showing matching bundled models only.'
                : 'Smithsonian API unavailable (' + error.message + '), and no bundled models match this search.'
        };
    }
}

// The AR manifest pipeline uses this same resolver before passing the URL to GLTFLoader.
export async function resolveModel(item) {
    return {
        url: item.modelUrl || '',
        source: item.source || (item.modelUrl ? 'bundled model' : 'unresolved catalogue candidate'),
        attribution: item.license || null,
        assetUrl: item.assetUrl || null,
        assetName: item.title || item.id || null
    };
}
