// droppme — file transfer one-liner generator
// All client-side, no backend.

const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

let templates = [];
let selectedId = null;
const collapsedGroups = new Set(); // group keys whose items are hidden

const filters = {
    os: 'all',
    mode: 'all',
    category: 'all',
    flag: 'all',
    search: '',
    server: 'none',
    stealth: 'all'   // 'stealth' / 'medium' / 'loud' — uses existing tier tags
};

const SERVER_COMPAT = {
    'srv:ftp-write': ['srv:ftp', 'srv:ftp-write'],
    'srv:smb-auth':  ['srv:smb', 'srv:smb-auth'],
    'srv:http-upload': ['srv:http', 'srv:http-upload'],
};
function compatibleServers(picked) {
    return SERVER_COMPAT[picked] || [picked];
}

const SHELL_TAGS = ['powershell', 'cmd', 'bash'];
const CATEGORY_TAGS = ['tool', 'language', 'lolbin', 'service'];

// DOM refs
const ipInput = document.getElementById('ip');
const portInput = document.getElementById('port');
const filenameInput = document.getElementById('filename');
const outdirInput = document.getElementById('outdir');
const outdirToggle = document.querySelector('.outdir-toggle');
const searchInput = document.getElementById('search');

// Per-OS output directories — toggle swaps which one the input edits.
const outdirState = { nix: '', win: '' };
let outdirOS = 'nix';
const techniqueList = document.getElementById('technique-list');
const commandPane = document.getElementById('command-pane');
const toast = document.getElementById('toast');
const resultCount = document.getElementById('result-count');

// ============= Template loading =============
async function loadTemplates() {
    try {
        const res = await fetch('templates.json');
        const data = await res.json();
        templates = data.techniques;
        applyQueryParams();
        rebuildSidebar();
        renderSelected();
    } catch (err) {
        commandPane.innerHTML = '<p style="color:#f85149;padding:1rem;">Error loading templates.json</p>';
        console.error(err);
    }
}

// ============= Placeholder filling =============
// Returns both the plain text (for clipboard) and highlighted HTML (for display).
function fillTemplate(cmdTemplate) {
    const ip = ipInput.value.trim() || '<ATTACKER_IP>';
    const port = portInput.value.trim() || '<PORT>';
    const filename = filenameInput.value.trim() || '<FILENAME>';
    // Pull live value from the input for whichever OS is currently selected
    if (outdirOS === 'nix') outdirState.nix = outdirInput.value.trim();
    else outdirState.win = outdirInput.value.trim();
    const winDir = outdirState.win || 'C:\\temp\\';
    const nixDir = outdirState.nix || '/tmp/';
    const winOut = winDir.endsWith('\\') || winDir.endsWith('/') ? `${winDir}${filename}` : `${winDir}\\${filename}`;
    const nixOut = nixDir.endsWith('/') ? `${nixDir}${filename}` : `${nixDir}/${filename}`;

    const plain = cmdTemplate
        .replaceAll('{ip}', ip)
        .replaceAll('{port}', port)
        .replaceAll('{filename}', filename)
        .replaceAll('{win_out}', winOut)
        .replaceAll('{nix_out}', nixOut);

    const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const html = esc(cmdTemplate)
        .replaceAll('{ip}',       `<span class="hl-ip">${esc(ip)}</span>`)
        .replaceAll('{port}',     `<span class="hl-port">${esc(port)}</span>`)
        .replaceAll('{filename}', `<span class="hl-file">${esc(filename)}</span>`)
        .replaceAll('{win_out}',  `<span class="hl-file">${esc(winOut)}</span>`)
        .replaceAll('{nix_out}',  `<span class="hl-file">${esc(nixOut)}</span>`);

    return { plain, html };
}

// ============= Filtering =============
function passesFilter(tech) {
    const meta = tech.meta || [];

    // OS filter: windows/linux selections also include cross-platform items
    if (filters.os !== 'all') {
        if (filters.os === 'cross') {
            if (!meta.includes('cross')) return false;
        } else {
            if (!meta.includes(filters.os) && !meta.includes('cross')) return false;
        }
    }

    if (filters.mode !== 'all' && !meta.includes(filters.mode)) return false;
    if (filters.category !== 'all' && !meta.includes(filters.category)) return false;
    if (filters.flag !== 'all' && !meta.includes(filters.flag)) return false;

    if (filters.server !== 'none') {
        const wanted = compatibleServers(filters.server);
        const tplSrv = meta.find(m => m.startsWith('srv:'));
        if (tplSrv && !wanted.includes(tplSrv) && tplSrv !== 'srv:client-pair') return false;
    }

    if (filters.stealth !== 'all' && !meta.includes(filters.stealth)) return false;

    if (filters.search) {
        const q = filters.search.toLowerCase();
        // Search across label, notes, when, command, module, and meta tags
        const haystack = [
            tech.label,
            tech.notes,
            tech.when,
            tech.command,
            tech.module,
            (tech.tools || []).join(' '),
            meta.join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
    }

    return true;
}

function osLabelOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('windows')) return 'Windows';
    if (meta.includes('linux')) return 'Linux';
    return 'Cross';
}

function osKeyOf(tech) {
    return osLabelOf(tech).toLowerCase();
}

// Sidebar grouping is broader than OS — extras and languages get their own sections
function sidebarGroupOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('extras')) return 'extras';
    if (meta.includes('language')) return 'language';
    if (meta.includes('windows')) return 'windows';
    if (meta.includes('linux')) return 'linux';
    return 'cross';
}

// ============= Sidebar list =============
function rebuildSidebar() {
    const matching = templates.filter(passesFilter);
    techniqueList.innerHTML = '';

    resultCount.textContent = `${matching.length} of ${templates.length}`;

    if (matching.length === 0) {
        const li = document.createElement('li');
        li.className = 'sidebar-empty';
        li.textContent = 'No techniques match these filters.';
        techniqueList.appendChild(li);
        selectedId = null;
        return;
    }

    // Group by sidebar group (extras + language get their own sections)
    const groups = { windows: [], linux: [], language: [], cross: [], extras: [] };
    matching.forEach(t => groups[sidebarGroupOf(t)].push(t));

    [['windows', 'Windows'], ['linux', 'Linux'], ['language', 'Languages'], ['cross', 'Cross-platform'], ['extras', 'Extras']].forEach(([key, label]) => {
        if (!groups[key].length) return;
        const isCollapsed = collapsedGroups.has(key);

        const header = document.createElement('li');
        header.className = `sidebar-group ${key}${isCollapsed ? ' collapsed' : ''}`;
        header.innerHTML = `<span class="caret">▾</span><span class="dot"></span><span>${label}</span><span class="count">${groups[key].length}</span>`;
        header.addEventListener('click', () => {
            if (collapsedGroups.has(key)) collapsedGroups.delete(key);
            else collapsedGroups.add(key);
            rebuildSidebar();
        });
        techniqueList.appendChild(header);

        if (isCollapsed) return; // skip items when collapsed

        groups[key].forEach(t => {
            const item = document.createElement('li');
            item.className = 'sidebar-item';
            item.dataset.id = t.id;

            const name = document.createElement('span');
            name.className = 'sidebar-item-name';
            name.textContent = t.label;
            item.appendChild(name);

            const badges = document.createElement('span');
            badges.className = 'sidebar-item-badges';
            sidebarBadgesFor(t).forEach(tag => {
                const b = document.createElement('span');
                b.className = `mini-tag ${tag}`;
                b.textContent = tag;
                badges.appendChild(b);
            });
            item.appendChild(badges);

            item.addEventListener('click', () => {
                selectedId = t.id;
                updateActiveSidebarItem();
                renderSelected();
            });
            techniqueList.appendChild(item);
        });
    });

    // Preserve selection if still valid; otherwise pick first matching
    const stillValid = matching.find(t => t.id === selectedId);
    selectedId = stillValid ? stillValid.id : matching[0].id;
    updateActiveSidebarItem();
}

// One badge max per sidebar item — priority: server > encrypt > upload > fileless > lolbin > OS-locked language
function sidebarBadgesFor(tech) {
    const meta = tech.meta || [];
    if (meta.includes('server')) return ['server'];
    if (meta.includes('encrypt')) return ['encrypt'];
    if (meta.includes('upload')) return ['upload'];
    if (meta.includes('fileless')) return ['fileless'];
    if (meta.includes('lolbin')) return ['lolbin'];
    if (meta.includes('language')) {
        if (meta.includes('windows')) return ['windows'];
        if (meta.includes('linux')) return ['linux'];
    }
    return [];
}

function updateActiveSidebarItem() {
    techniqueList.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === selectedId);
    });
}

// ============= Render selected technique =============
function renderSelected() {
    commandPane.innerHTML = '';
    if (!selectedId) {
        const empty = document.createElement('div');
        empty.className = 'pane-empty';
        empty.textContent = 'Pick a technique from the list.';
        commandPane.appendChild(empty);
        return;
    }

    const tech = templates.find(t => t.id === selectedId);
    if (!tech) return;

    // Header: OS badge + label + tags
    const header = document.createElement('div');
    header.className = 'pane-header';

    const titleRow = document.createElement('div');
    titleRow.className = 'pane-title';

    const osBadge = document.createElement('span');
    osBadge.className = `os-badge ${osKeyOf(tech)}`;
    osBadge.textContent = osLabelOf(tech);
    titleRow.appendChild(osBadge);

    const label = document.createElement('span');
    label.className = 'pane-label';
    label.textContent = tech.label;
    titleRow.appendChild(label);

    header.appendChild(titleRow);

    const tags = document.createElement('div');
    tags.className = 'pane-tags';
    paneTagsFor(tech).forEach(tag => {
        const span = document.createElement('span');
        span.className = `tag ${tag}`;
        span.textContent = tag;
        tags.appendChild(span);
    });
    header.appendChild(tags);

    commandPane.appendChild(header);

    // Main command box — target side (or attacker for srv_*, either for encrypt)
    const { plain, html } = fillTemplate(tech.command);

    const wrap = document.createElement('div');
    wrap.className = 'command-wrap';

    const titleBar = document.createElement('div');
    titleBar.className = 'command-title';
    titleBar.innerHTML = `<span class="side-label">${sideLabelOf(tech)}</span><span class="shell-name">${shellLabelOf(tech)}</span>`;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = COPY_ICON;
    titleBar.appendChild(copyBtn);

    wrap.appendChild(titleBar);

    const codeBox = document.createElement('pre');
    codeBox.className = 'command-box';
    codeBox.innerHTML = html;
    codeBox.title = 'Click to copy';
    wrap.appendChild(codeBox);

    const doCopy = () => copyToClipboard(plain, copyBtn);
    codeBox.addEventListener('click', doCopy);
    copyBtn.addEventListener('click', e => { e.stopPropagation(); doCopy(); });

    commandPane.appendChild(wrap);

    // Set up — paired companion command (server / client / decrypt)
    // Visible by default; hides when the user picked a server filter that matches this template
    // (they already have it running, no need to repeat the command).
    const tplSrv = (tech.meta || []).find(m => m.startsWith('srv:'));
    const serverAlreadyUp = filters.server !== 'none' && tplSrv && compatibleServers(filters.server).includes(tplSrv);
    if (tech.usage && !serverAlreadyUp) {
        const usageBlock = document.createElement('div');
        usageBlock.className = 'usage';

        const head = document.createElement('div');
        head.className = 'usage-head';
        head.textContent = `Set up — ${usageLabelOf(tech)}`;
        usageBlock.appendChild(head);

        const usageWrap = document.createElement('div');
        usageWrap.className = 'usage-wrap';

        const { plain: usagePlain, html: usageHtml } = fillTemplate(tech.usage);

        const usageBox = document.createElement('pre');
        usageBox.className = 'usage-box';
        usageBox.innerHTML = usageHtml;
        usageBox.title = 'Click to copy';

        const usageCopy = document.createElement('button');
        usageCopy.className = 'copy-btn usage-copy';
        usageCopy.title = 'Copy';
        usageCopy.innerHTML = COPY_ICON;

        const doUsageCopy = () => copyToClipboard(usagePlain, usageCopy);
        usageBox.addEventListener('click', doUsageCopy);
        usageCopy.addEventListener('click', e => { e.stopPropagation(); doUsageCopy(); });

        usageWrap.appendChild(usageBox);
        usageWrap.appendChild(usageCopy);
        usageBlock.appendChild(usageWrap);

        commandPane.appendChild(usageBlock);
    }

    // "When to use" hint — sits right above the description/notes
    if (tech.when) {
        const when = document.createElement('div');
        when.className = 'when';
        when.innerHTML = `<span class="when-label">When</span><span class="when-text">${escapeHtml(tech.when)}</span>`;
        commandPane.appendChild(when);
    }

    if (tech.notes) {
        const notes = document.createElement('div');
        notes.className = 'notes';
        notes.textContent = tech.notes;
        commandPane.appendChild(notes);
    }

    // Inline detection details: small footer line — UA · Process · Stealth · Artifacts
    const stealth = stealthOf(tech);
    if (tech.ua || tech.process || tech.artifacts || stealth) {
        const meta = document.createElement('div');
        meta.className = 'meta-line';
        const parts = [];
        if (stealth) {
            parts.push(`<span class="meta-item"><span class="meta-key">Stealth</span><span class="stealth-pill ${stealth}"><span class="stealth-dot"></span>${stealthLabel(stealth)}</span></span>`);
        }
        if (tech.ua) {
            parts.push(`<span class="meta-item"><span class="meta-key">UA</span><code class="meta-val">${escapeHtml(tech.ua)}</code></span>`);
        }
        if (tech.process) {
            parts.push(`<span class="meta-item"><span class="meta-key">Process</span><code class="meta-val">${escapeHtml(tech.process)}</code></span>`);
        }
        if (tech.artifacts) {
            parts.push(`<span class="meta-item"><span class="meta-key">Artifacts</span><span class="meta-text">${escapeHtml(tech.artifacts)}</span></span>`);
        }
        meta.innerHTML = parts.join('');
        commandPane.appendChild(meta);
    }

    // References block (last)
    const refs = renderReferences(tech);
    if (refs) commandPane.appendChild(refs);
}

function detRow(label, valueHtml) {
    const row = document.createElement('div');
    row.className = 'detection-row';
    row.innerHTML = `<span class="detection-label">${label}</span>${valueHtml}`;
    return row;
}

function renderReferences(tech) {
    if (!tech.references || !tech.references.length) return null;
    const refs = document.createElement('div');
    refs.className = 'references';
    const head = document.createElement('div');
    head.className = 'references-head';
    head.textContent = 'Sources';
    refs.appendChild(head);
    const ul = document.createElement('ul');
    ul.className = 'references-list';
    tech.references.forEach(r => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = r.label;
        li.appendChild(a);
        ul.appendChild(li);
    });
    refs.appendChild(ul);
    return refs;
}

function stealthOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('loud')) return 'loud';
    if (meta.includes('medium')) return 'medium';
    if (meta.includes('stealth')) return 'stealth';
    return null;
}

function stealthLabel(s) {
    return { loud: 'Loud', medium: 'Medium', stealth: 'Stealth' }[s] || s;
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shellLabelOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('powershell')) return 'PowerShell';
    if (meta.includes('cmd')) return 'Cmd';
    if (meta.includes('bash')) return 'Bash';
    return 'Shell';
}


// Where the user runs this command. Server templates run on attacker; encrypt is bidirectional.
function sideLabelOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('server')) return 'On attacker';
    if (meta.includes('encrypt')) return 'Either side';
    return 'On target';
}

// Label for the paired (Set up) companion command — flips based on which side the main runs on.
function usageLabelOf(tech) {
    const meta = tech.meta || [];
    if (meta.includes('server')) return 'on target (client side)';
    if (meta.includes('encrypt')) return 'paired counterpart (decrypt ↔ encrypt)';
    return 'on attacker (server side)';
}

function paneTagsFor(tech) {
    const meta = tech.meta || [];
    const out = [];
    SHELL_TAGS.forEach(t => { if (meta.includes(t)) out.push(t); });
    if (meta.includes('upload')) out.push('upload');
    CATEGORY_TAGS.forEach(t => { if (meta.includes(t)) out.push(t); });
    if (meta.includes('fileless')) out.push('fileless');
    return out;
}

// ============= Clipboard =============
function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            btn.innerHTML = CHECK_ICON;
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = COPY_ICON;
                btn.classList.remove('copied');
            }, 1200);
        }
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
}

// ============= Event wiring =============
let renderTimer;
function debouncedRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderSelected, 80);
}

[ipInput, portInput, filenameInput, outdirInput].forEach(el => {
    el.addEventListener('input', debouncedRender);
});

// Output dir OS toggle — saves current input, swaps to the other OS's value
outdirToggle.addEventListener('click', e => {
    const chip = e.target.closest('.toggle-chip');
    if (!chip) return;
    const newOS = chip.dataset.os;
    if (newOS === outdirOS) return;
    // Save current input value for the OS we're leaving
    if (outdirOS === 'nix') outdirState.nix = outdirInput.value.trim();
    else outdirState.win = outdirInput.value.trim();
    // Switch
    outdirOS = newOS;
    outdirToggle.querySelectorAll('.toggle-chip').forEach(c => c.classList.toggle('active', c.dataset.os === newOS));
    outdirInput.value = outdirState[newOS] || '';
    outdirInput.placeholder = newOS === 'nix' ? '/tmp/' : 'C:\\temp\\';
    renderSelected();
});

searchInput.addEventListener('input', e => {
    filters.search = e.target.value.trim();
    rebuildSidebar();
    renderSelected();
});

document.querySelectorAll('.filter-bar select').forEach(sel => {
    sel.addEventListener('change', e => {
        filters[e.target.dataset.filter] = e.target.value;
        rebuildSidebar();
        renderSelected();
    });
});

document.getElementById('filter-fileless').addEventListener('change', e => {
    filters.flag = e.target.checked ? 'fileless' : 'all';
    rebuildSidebar();
    renderSelected();
});

// Server side filter — expandable chip row + summary toggle
const SERVER_LABELS = {
    'none': 'none',
    'srv:http': 'HTTP',
    'srv:http-upload': 'HTTP+upload',
    'srv:smb': 'SMB',
    'srv:ftp-write': 'FTP',
    'srv:webdav': 'WebDAV',
    'srv:nc-listen': 'netcat',
    'srv:tls': 'TLS',
    'srv:ssh': 'SSH',
};

const serverRow    = document.getElementById('server-row');
const serverToggle = document.getElementById('server-toggle');
const serverValEl  = document.getElementById('server-toggle-val');

serverToggle.addEventListener('click', () => {
    serverRow.classList.toggle('collapsed');
});

document.getElementById('server-chips').addEventListener('click', e => {
    const chip = e.target.closest('.server-chip');
    if (!chip) return;
    document.querySelectorAll('.server-chip').forEach(c => c.classList.toggle('active', c === chip));
    filters.server = chip.dataset.srv;
    serverValEl.textContent = SERVER_LABELS[filters.server] || filters.server;
    rebuildSidebar();
    renderSelected();
});


// ============= URL params =============
function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('ip')) ipInput.value = params.get('ip');
    if (params.has('port')) portInput.value = params.get('port');
    if (params.has('filename')) filenameInput.value = params.get('filename');
    if (params.has('technique')) selectedId = params.get('technique');
}

loadTemplates();
