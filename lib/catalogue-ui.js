import { searchAssets } from './model-provider.js';

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
        const actions = document.createElement('div');
        actions.className = 'assetActions';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'assetSelect';
        select.textContent = 'Select';
        select.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('catalogue:model-selected', { detail: asset }));
            status.textContent = 'Selected "' + asset.title + '". Marker assignment is a separate step.';
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
        body.append(title, summary, actions);
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
        status.textContent = result.assets.length
            ? 'Found ' + result.assets.length + ' candidate(s)' + (hasMore ? ' · more available' : '') + ' for "' + currentQuery + '".'
            : 'No models found for "' + currentQuery + '". Try another search term.';
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
