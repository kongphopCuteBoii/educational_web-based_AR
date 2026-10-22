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

function firstString(object, keys) {
    for (const key of keys) {
        const value = object?.[key];
        if (typeof value === 'string' && value.trim()) return value;
        if (typeof value === 'number') return String(value);
    }
    return '';
}

function findGlbFiles(payload) {
    const found = [];
    const seen = new Set();
    function walk(node, context = {}, parentKey = '') {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach((child) => walk(child, context, parentKey));
            return;
        }
        const next = { ...context };
        const submissionId = firstString(node, ['submissionId', 'submission_id']);
        const runId = firstString(node, ['prefectRunId', 'runId', 'workflowRunId', 'workflow_run_id']);
        if (submissionId) next.submissionId = submissionId;
        if (parentKey === 'submissions' && !next.submissionId) {
            next.submissionId = firstString(node, ['id', 'submissionId']);
        }
        if (runId) next.runId = runId;
        if (parentKey === 'workflowRuns' && !next.runId) {
            next.runId = firstString(node, ['prefectRunId', 'id']);
        }
        const fileName = firstString(node, ['fileName', 'filename', 'name', 'originalFilename']);
        const fileId = firstString(node, ['fileId', 'outputFileId', 'id']);
        if (/\\.glb(?:$|[?#])/i.test(fileName) && fileId && next.submissionId && next.runId) {
            const key = [next.submissionId, next.runId, fileId].join('/');
            if (!seen.has(key)) {
                seen.add(key);
                found.push({
                    title: fileName.replace(/\\.glb$/i, '').replace(/[_-]+/g, ' '),
                    modelUrl: 'https://3d.nih.gov/api/submissions/' +
                        encodeURIComponent(next.submissionId) + '/runs/' +
                        encodeURIComponent(next.runId) + '/output-files/' +
                        encodeURIComponent(fileId)
                });
            }
        }
        Object.entries(node).forEach(([key, child]) => {
            if (child && typeof child === 'object') walk(child, next, key);
        });
    }
    walk(payload);
    return found;
}

async function searchNIHById(query, options = {}) {
    const match = query.match(/\b(3DPX[-_ ]?\d+)\b/i);
    if (!match) return null;
    const digits = match[1].match(/\d+/)[0];
    const entryId = '3DPX-' + digits.padStart(6, '0');
    const response = await fetch('https://3d.nih.gov/api/entries/' + encodeURIComponent(entryId), {
        headers: { Accept: 'application/json' },
        signal: options.signal
    });
    if (!response.ok) throw new Error('NIH 3D entry lookup returned HTTP ' + response.status);
    const payload = await response.json();
    const files = findGlbFiles(payload);
    const title = firstString(payload, ['title', 'name', 'entryTitle']) || entryId;
    const license = firstString(payload, ['licenseName', 'license', 'license_name']) || 'Check NIH 3D entry for item-level license';
    const entryUrl = 'https://3d.nih.gov/entries/' + entryId;
    return {
        assets: files.map((file, index) => ({
            id: 'nih3d:' + entryId + ':' + index,
            title: files.length > 1 ? title + ' — ' + file.title : title,
            summary: 'NIH 3D · ' + entryId + ' · GLB output',
            preview: '',
            modelUrl: file.modelUrl,
            assetUrl: entryUrl,
            license,
            source: 'NIH 3D',
            keywords: query
        })),
        page: 1,
        hasMore: false,
        source: 'nih3d',
        notice: files.length
            ? 'NIH 3D entry resolved to GLB download endpoint(s). Select + Load will test each file in Three.js; license and cross-origin access must still be respected.'
            : 'NIH 3D entry was found, but no GLB output could be resolved from its metadata. Open the entry to inspect available files.',
        externalSearchUrl: entryUrl
    };
}

export async function searchAssets(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) return { assets: [], page: 1, hasMore: false, source: 'bundled' };

    const externalSearchUrl = NIH3D_SEARCH_URL + encodeURIComponent(normalizedQuery);
    const local = localMatches(normalizedQuery);

    // NIH 3D's web UI supports keyword discovery (?terms=...), but its browser-facing
    // model API is undocumented and may reject cross-origin requests. Never require an ID
    // before searching, and never imply that remote results were loaded when they were not.
    if (/\b3DPX[-_ ]?\d+\b/i.test(normalizedQuery)) {
        try {
            const nih = await searchNIHById(normalizedQuery, options);
            if (nih) return nih;
        } catch (error) {
            return {
                assets: local,
                page: 1,
                hasMore: false,
                source: 'local-fallback',
                notice: 'NIH 3D direct lookup is unavailable from this page (' + error.message + '). Bundled search is still available; browse NIH 3D by keyword using the link.',
                externalSearchUrl
            };
        }
    }

    return {
        assets: local,
        page: 1,
        hasMore: false,
        source: 'bundled',
        notice: local.length
            ? 'Showing matching bundled models. You can also browse NIH 3D for “' + normalizedQuery + '” using the link below.'
            : 'No bundled models match “' + normalizedQuery + '”. Browse NIH 3D for this keyword using the link below.',
        externalSearchUrl
    };
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
