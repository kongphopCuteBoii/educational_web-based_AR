// Public CC0 model catalogue adapter using Lazytextures' documented search API.
// This source returns model metadata and previews; model files are packaged as downloads,
// so we do not pretend the archive itself is a directly loadable GLB.
const API_BASE = 'https://lazytextures.net:3000';
const STARTER_ASSETS = [
    { id: 'water-molecule', title: 'Water molecule (H₂O)', summary: 'Chemistry · molecular structure · oxygen and hydrogen', preview: '', modelUrl: new URL('../models/h2o.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'water molecule h2o chemistry oxygen hydrogen atom molecule science' },
    { id: 'argon-atom', title: 'Argon atom', summary: 'Chemistry · element · electron shells', preview: '', modelUrl: new URL('../models/ar18.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'argon atom electron shell element chemistry proton electron atomic model science' },
    { id: 'saturn', title: 'Saturn', summary: 'Astronomy · planet · rings', preview: '', modelUrl: new URL('../models/saturn.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'saturn planet astronomy space ring solar system gas giant' },
    { id: 'sun', title: 'Sun', summary: 'Astronomy · star · solar system', preview: '', modelUrl: new URL('../models/sun.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'sun star astronomy space solar system solar energy' },
    { id: 'camel', title: 'Camel', summary: 'Biology · animal · desert adaptation', preview: '', modelUrl: new URL('../models/camel_r.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', keywords: 'camel animal biology desert dromedary bactrian mammal adaptation' }
];

function pick(...values) {
    return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function normalizeAsset(candidate) {
    const name = pick(candidate?.name, candidate?.label, candidate?.title, 'Untitled model');
    const previewPath = candidate?.preview?.path || candidate?.previewPath || candidate?.thumbnail || '';
    const preview = /^https?:\/\//i.test(previewPath)
        ? previewPath
        : previewPath ? API_BASE + previewPath : '';
    const tags = Array.isArray(candidate?.tags) ? candidate.tags : [];
    const category = pick(candidate?.category, candidate?.subCategory);
    return {
        id: name,
        title: name.replace(/[_-]+/g, ' '),
        summary: [category, ...tags].filter(Boolean).join(' · ') || 'CC0 3D model asset',
        preview,
        modelUrl: '',
        assetUrl: API_BASE + '/Asset/models/' + encodeURIComponent(name),
        license: 'CC0 (verify asset details)',
        keywords: [name, category, ...tags].filter(Boolean).join(' ')
    };
}

async function searchRemote(query, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 24));
    const params = new URLSearchParams({
        q: String(query || '').trim(),
        type: 'models',
        sortBy: 'relevance',
        limit: String(limit),
        offset: String((page - 1) * limit)
    });
    const response = await fetch(API_BASE + '/all/Search?' + params.toString(), {
        headers: { Accept: 'application/json' },
        mode: 'cors',
        signal: options.signal
    });
    if (!response.ok) throw new Error('Model catalogue responded with HTTP ' + response.status);
    const payload = await response.json();
    if (payload?.success === false) throw new Error(payload.error || 'Model catalogue search failed');
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const models = results.filter((item) => !item.assetType || item.assetType === 'models');
    const assets = models.map(normalizeAsset);
    const total = Number(payload?.pagination?.total);
    const hasMore = typeof payload?.pagination?.hasMore === 'boolean'
        ? payload.pagination.hasMore
        : Number.isFinite(total) && page * limit < total;
    return { assets, page, hasMore, source: 'lazytextures', notice: '' };
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false };

    try {
        const result = await searchRemote(normalizedQuery, options);
        // Keep starter models available as candidates when they match the user's query.
        const terms = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const local = STARTER_ASSETS.filter((asset) => {
            const haystack = [asset.title, asset.summary, asset.keywords].join(' ').toLowerCase();
            return terms.some((term) => haystack.includes(term));
        });
        const seen = new Set(result.assets.map((asset) => asset.id));
        result.assets.push(...local.filter((asset) => !seen.has(asset.id)));
        result.notice = result.assets.length ? 'External CC0 model results. Open Details to inspect downloadable files and licensing.' : 'No matching external models were returned. Try a broader term.';
        return result;
    } catch (error) {
        const terms = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);
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
                ? 'External catalogue unavailable (' + error.message + '). Showing matching local models only.'
                : 'External catalogue unavailable (' + error.message + '), and no local models match this search.'
        };
    }
}

// Retained for existing AR code; external catalogue assets are not automatically loaded into AR.
export async function resolveModel(item) {
    return { url: item.modelUrl, source: 'bundled fallback', attribution: null };
}
