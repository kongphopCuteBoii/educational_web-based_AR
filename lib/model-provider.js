// Providers must resolve to direct browser-loadable GLB files before a card is selectable.
// NIH 3D's public site has no documented listing API, so free-text discovery remains on its own
// search page. Exact 3DPX IDs can be resolved through the site's public entry metadata endpoint.
const NIH3D_SEARCH_URL = 'https://3d.nih.gov/discover?terms=';

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

async function searchSketchfab(query, options = {}) {
    const url = 'https://api.sketchfab.com/v3/search?type=models&q=' +
        encodeURIComponent(query) + '&downloadable=true&count=24';
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: options.signal });
    if (!response.ok) throw new Error('Sketchfab search returned HTTP ' + response.status);
    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    return results.map((model) => {
        const thumbs = model.thumbnails?.images || [];
        const thumbnail = thumbs.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
        return {
            id: 'sketchfab:' + model.uid,
            title: model.name || 'Untitled 3D model',
            summary: String(model.description || '').replace(/<[^>]*>/g, '').slice(0, 240) ||
                'Community 3D model · ' + (model.user?.displayName || model.user?.username || 'Sketchfab creator'),
            preview: thumbnail?.url || '',
            modelUrl: '',
            assetUrl: model.viewerUrl || ('https://sketchfab.com/3d-models/' + model.uid),
            license: model.license?.label || model.license?.name || model.license || 'Check model page for license',
            licenseUrl: model.license?.url || '',
            creator: model.user?.displayName || model.user?.username || 'Unknown creator',
            source: 'Sketchfab',
            keywords: query,
            viewerUrl: model.embedUrl || ('https://sketchfab.com/models/' + model.uid + '/embed')
        };
    });
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: STARTER_ASSETS, page: 1, hasMore: false, source: 'bundled', notice: 'Browse the starter models or search for a topic to discover remote models.' };

    const local = localMatches(normalizedQuery);
    const externalSearchUrl = NIH3D_SEARCH_URL + encodeURIComponent(normalizedQuery);

    try {
        const remote = await searchSketchfab(normalizedQuery, options);
        const assets = [...local, ...remote];
        return {
            assets,
            page: 1,
            hasMore: false,
            source: 'sketchfab',
            notice: assets.length
                ? 'Found ' + remote.length + ' remote Sketchfab result(s) and ' + local.length + ' matching bundled model(s). Remote previews and model details are available; loading remote files into AR requires authorized GLB downloads.'
                : 'No results found for “' + normalizedQuery + '”. Try another keyword.',
            externalSearchUrl
        };
    } catch (error) {
        return {
            assets: local,
            page: 1,
            hasMore: false,
            source: 'local-fallback',
            notice: 'Remote search could not be reached (' + error.message + '). Showing matching bundled models only.',
            externalSearchUrl
        };
    }
}

export async function resolveModel(item) {
    return {
        url: item.modelUrl || '',
        source: item.source || (item.modelUrl ? 'bundled model' : 'unresolved catalogue candidate'),
        attribution: item.license || null,
        assetUrl: item.assetUrl || null,
        assetName: item.title || item.id || null
    };
}
