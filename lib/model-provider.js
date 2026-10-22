// Public, keyless model catalogue adapter for 3DAssets.dev.
// Only accept candidates with a strong semantic match; otherwise use the configured fallback.
const API_BASE = 'https://3dassets.dev/api/v1/assets';

function candidateList(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ['assets', 'results', 'items', 'data']) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
}

function candidateText(candidate) {
    const tags = Array.isArray(candidate?.tags)
        ? candidate.tags.map((tag) => typeof tag === 'string' ? tag : tag?.name || tag?.slug || '')
        : [];
    return [
        candidate?.name,
        candidate?.title,
        candidate?.slug,
        candidate?.summary,
        candidate?.description,
        ...tags
    ].filter(Boolean).join(' ').toLowerCase();
}

function getModelUrl(candidate) {
    const url = candidate?.cdnUrl || candidate?.cdn_url || candidate?.modelUrl || candidate?.model_url;
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

function scoreCandidate(candidate, terms) {
    const haystack = candidateText(candidate);
    return terms.reduce((score, term) => {
        const normalized = String(term || '').trim().toLowerCase();
        if (!normalized) return score;
        return score + (haystack.includes(normalized) ? (normalized.includes(' ') ? 3 : 2) : 0);
    }, 0);
}

export async function resolveModel(item, statusCb = () => {}) {
    const fallbackUrl = item.modelUrl;
    const query = item.providerQuery;
    if (!query || item.provider !== '3dassets') {
        return { url: fallbackUrl, source: 'bundled fallback', attribution: null };
    }

    const params = new URLSearchParams({ q: query, limit: '10', sort: 'relevance' });
    const endpoint = `${API_BASE}?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        statusCb(`Searching model catalogue: ${item.title || item.id}...`);
        const response = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            mode: 'cors',
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`catalogue responded ${response.status}`);

        const payload = await response.json();
        const candidates = candidateList(payload);
        const terms = Array.isArray(item.providerMatchTerms) ? item.providerMatchTerms : [];
        const ranked = candidates
            .map((candidate) => ({
                candidate,
                score: scoreCandidate(candidate, terms),
                url: getModelUrl(candidate)
            }))
            .filter((entry) => entry.score >= (Number(item.providerMinimumScore) || 4))
            .sort((a, b) => b.score - a.score);

        // Search responses may omit the CDN URL; resolve the winning asset by slug.
        for (const entry of ranked.slice(0, 3)) {
            if (!entry.url && entry.candidate?.slug) {
                const detailResponse = await fetch(
                    `${API_BASE}/${encodeURIComponent(entry.candidate.slug)}`,
                    { headers: { Accept: 'application/json' }, mode: 'cors', signal: controller.signal }
                );
                if (detailResponse.ok) {
                    const detailPayload = await detailResponse.json();
                    const detail = detailPayload?.asset || detailPayload?.data || detailPayload;
                    entry.url = getModelUrl(detail);
                    entry.candidate = detail;
                }
            }
        }
        const matched = ranked.find((entry) => entry.url);

        if (matched) {
            const best = matched.candidate;
            return {
                url: matched.url,
                source: '3DAssets.dev',
                attribution: best.license?.attributionText || best.attributionText || null,
                assetName: best.name || best.title || best.slug || item.title,
                assetUrl: best.slug ? `https://3dassets.dev/assets/${encodeURIComponent(best.slug)}` : null
            };
        }
        console.info(`No confidently matched external model for ${item.id}; using bundled fallback.`);
    } catch (error) {
        console.warn(`External model lookup failed for ${item.id}; using bundled fallback.`, error);
    } finally {
        clearTimeout(timeout);
    }

    return { url: fallbackUrl, source: 'bundled fallback', attribution: null };
}
