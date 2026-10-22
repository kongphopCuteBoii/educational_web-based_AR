import { searchAssets } from './model-provider.js?v=ef2a448d';
const overlay = document.querySelector('#catalogueOverlay');
const openButton = document.querySelector('#catalogueOpen');
const closeButton = document.querySelector('#catalogueClose');
const form = document.querySelector('#catalogueSearchForm');
const queryInput = document.querySelector('#catalogueQuery');
const status = document.querySelector('#catalogueStatus');
const grid = document.querySelector('#catalogueGrid');
const moreButton = document.querySelector('#catalogueMore');

let currentQuery = '';
let currentPage = 1;
let hasMore = false;
let busy = false;
const cache = new Map();

openButton.addEventListener('click', () => {
    overlay.classList.add('open');
    queryInput.focus();
});
closeButton.addEventListener('click', () => overlay.classList.remove('open'));
overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.classList.remove('open');
});

function renderAssets(assets, append = false) {
    if (!append) grid.replaceChildren();
    assets.forEach((asset) => {
        const card = document.createElement('article');
        card.className = 'assetCard';
        const preview = document.createElement('div');
        preview.className = 'assetPreview';
        preview.textContent = '◇';
        if (asset.preview) {
            const image = document.createElement('img');
            image.loading = 'lazy';
            image.alt = '';
            image.src = asset.preview;
            image.onerror = () => { image.remove(); preview.textContent = '◇'; };
            preview.replaceChildren(image);
        }
        const body = document.createElement('div');
        body.className = 'assetBody';
        const title = document.createElement('h3');
        title.className = 'assetTitle';
        title.textContent = asset.title;
        const summary = document.createElement('p');
        summary.className = 'assetSummary';
        summary.textContent = asset.summary;
        const source = document.createElement('p');
        source.className = 'assetSummary';
        source.textContent = (asset.source || 'External source') + ' · ' + (asset.license || 'License not specified');
        const actions = document.createElement('div');
        actions.className = 'assetActions';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'assetSelect';
        select.textContent = 'Select';
        select.disabled = !asset.modelUrl;
        select.title = asset.modelUrl ? 'Select this GLB model' : 'No direct model file is available';
        select.addEventListener('click', () => {
            if (!asset.modelUrl) {
                status.textContent = 'This candidate has no direct model file, so it cannot enter the display pipeline.';
                return;
            }
            window.dispatchEvent(new CustomEvent('catalogue:model-selected', {
                detail: { ...asset, modelUrl: asset.modelUrl }
            }));
            status.textContent = 'Selected "' + asset.title + '". Direct model URL dispatched; this separated-page demo does not yet insert it into the AR scene.';
            grid.querySelectorAll('.assetSelect').forEach((button) => { button.textContent = 'Select'; });
            select.textContent = 'Selected ✓';
        });
        actions.appendChild(select);
        if (asset.assetUrl) {
            const link = document.createElement('a');
            link.href = asset.assetUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Details ↗';
            actions.appendChild(link);
        }
        body.append(title, summary, source, actions);
        card.append(preview, body);
        grid.appendChild(card);
    });
}

async function search(nextPage = 1) {
    const query = queryInput.value.trim();
    if (!query || busy) return;
    if (nextPage === 1) {
        currentQuery = query;
        grid.replaceChildren();
    }
    busy = true;
    moreButton.style.display = 'none';
    status.textContent = nextPage === 1 ? 'Searching catalogue…' : 'Loading more models…';
    try {
        const key = currentQuery.toLowerCase() + '::' + nextPage;
        let result = cache.get(key);
        if (!result) {
            result = await searchAssets(currentQuery, { page: nextPage, limit: 24 });
            cache.set(key, result);
        }
        renderAssets(result.assets, nextPage > 1);
        currentPage = result.page;
        hasMore = result.hasMore;
        status.textContent = result.notice || (result.assets.length
            ? 'Found ' + result.assets.length + ' candidate(s)' + (hasMore ? ' · more available' : '') + ' for "' + currentQuery + '".'
            : 'No models found for "' + currentQuery + '". Try another search term.');
        moreButton.style.display = hasMore ? 'block' : 'none';
    } catch (error) {
        status.textContent = 'Could not search the catalogue: ' + error.message + '. Check your connection and try again.';
    } finally {
        busy = false;
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(1);
});
moreButton.addEventListener('click', () => {
    if (hasMore) search(currentPage + 1);
});
