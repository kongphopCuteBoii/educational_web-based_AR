// Catalogue providers must return a direct, browser-loadable GLB URL before an item is selectable.
// NIH 3D supports GLB downloads, but its current public site does not document a search API
// or guarantee that download-page URLs are direct, CORS-enabled GLB resources. Do not guess either.
const NIH3D_SEARCH_URL = 'https://3d.nih.gov/discover';

const STARTER_ASSETS = [
    { id: 'water-molecule', title: 'Water molecule (H₂O)', summary: 'Chemistry · molecular structure · oxygen and hydrogen', preview: '', modelUrl: new URL('../models/h2o.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'water molecule h2o chemistry oxygen hydrogen atom molecule science' },
    { id: 'argon-atom', title: 'Argon atom', summary: 'Chemistry · element · electron shells', preview: '', modelUrl: new URL('../models/ar18.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'argon atom electron shell element chemistry proton electron atomic model science' },
    { id: 'saturn', title: 'Saturn', summary: 'Astronomy · planet · rings', preview: '', modelUrl: new URL('../models/saturn.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'saturn planet astronomy space ring solar system gas giant' },
    { id: 'sun', title: 'Sun', summary: 'Astronomy · star · solar system', preview: '', modelUrl: new URL('../models/sun.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'sun star astronomy space solar system solar energy' },
    { id: 'camel', title: 'Camel', summary: 'Biology · animal · desert adaptation', preview: '', modelUrl: new URL('../models/camel_r.glb', import.meta.url).href, assetUrl: '', license: 'Project bundled model', source: 'Bundled', keywords: 'camel animal biology desert dromedary bactrian mammal adaptation' }
];

function localMatches(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return STARTER_ASSETS.filter((asset) => {
        const haystack = [asset.title, asset.summary, asset.keywords].join(' ').toLowerCase();
        return terms.every((term) => haystack.includes(term));
    });
}

export async function searchAssets(query) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false, source: 'bundled' };
    const assets = localMatches(normalizedQuery);
    return {
        assets,
        page: 1,
        hasMore: false,
        source: 'bundled',
        notice: assets.length
            ? 'Showing bundled models with verified local GLB paths. NIH 3D is not yet enabled as a selectable provider because direct file URLs and browser CORS have not been verified.'
            : 'No bundled model matches this search. NIH 3D can be browsed separately, but its search/download integration is not enabled yet.',
        externalSearchUrl: NIH3D_SEARCH_URL
    };
}

// The AR manifest pipeline and catalogue share this resolver contract.
export async function resolveModel(item) {
    return {
        url: item.modelUrl || '',
        source: item.source || (item.modelUrl ? 'bundled model' : 'unresolved catalogue candidate'),
        attribution: item.license || null,
        assetUrl: item.assetUrl || null,
        assetName: item.title || item.id || null
    };
}
