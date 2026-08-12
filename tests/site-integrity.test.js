const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function walk(directory, extension) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === '.git' || entry.name === 'node_modules') {
            return [];
        }

        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return walk(entryPath, extension);
        }

        return entry.name.endsWith(extension) ? [entryPath] : [];
    });
}

test('all local HTML resources exist', () => {
    const missing = [];

    walk(rootDir, '.html').forEach(htmlPath => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
        let match;

        while ((match = attributePattern.exec(html)) !== null) {
            const reference = match[1].trim();
            if (!reference || /^(?:https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(reference)) {
                continue;
            }

            const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
            const resolved = pathname.startsWith('/')
                ? path.join(rootDir, pathname.slice(1))
                : path.resolve(path.dirname(htmlPath), pathname);

            if (!fs.existsSync(resolved)) {
                missing.push(`${path.relative(rootDir, htmlPath)} -> ${reference}`);
            }
        }
    });

    assert.deepEqual(missing, []);
});

test('every HTML entry declares a local favicon', () => {
    const missing = walk(rootDir, '.html').flatMap(htmlPath => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const iconTag = html.match(/<link\b[^>]*\brel=["'](?:shortcut\s+)?icon["'][^>]*>/i);
        if (!iconTag) {
            return [path.relative(rootDir, htmlPath)];
        }

        const href = iconTag[0].match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
        return /^(?:https?:|data:|\/\/)/i.test(href)
            ? [`${path.relative(rootDir, htmlPath)}: favicon must be local`]
            : [];
    });

    assert.deepEqual(missing, []);
});

test('jsDelivr dependencies are pinned and protected by SRI', () => {
    const expectedIntegrity = new Map([
        [
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js',
            'sha384-b0GXujLkk9eYYSmcSfoyZbfyElGAQnDyY0skCHSG6w3JgTMFnz11ggrTAr7seu9f'
        ],
        [
            'https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.2/dist/index.js',
            'sha384-oOzlBbyTRPCSLZF7MUBwr2iOMUkVopRZkQgV/eyy5AusOQg4UmNgp73E59pYMrN3'
        ],
        [
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
            'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
        ],
        [
            'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js',
            'sha384-BQKzmHvQLMCAnL3UtDBA1Al5tFjsCz1wrMlIUA1wkzo14DYkRWjywW+p9pCj0cwd'
        ],
        [
            'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
            'sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM'
        ],
        [
            'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
            'sha384-QuGBSgV5Im3DzL2z+8Ko9/hqNy/N0O7zwvXAtfd1MvPKWa/UbeLV65cfm4BV5Wgq'
        ],
        [
            'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
            'sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz'
        ]
    ]);
    const problems = [];

    walk(rootDir, '.html').forEach(htmlPath => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const tagPattern = /<(?:script|link)\b[^>]*\b(?:src|href)=["']https:\/\/cdn\.jsdelivr\.net\/[^"']+["'][^>]*>/gi;

        for (const tag of html.match(tagPattern) || []) {
            const url = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
            const integrity = tag.match(/\bintegrity=["']([^"']+)["']/i)?.[1];
            const crossorigin = tag.match(/\bcrossorigin=["']([^"']+)["']/i)?.[1];
            const relativePath = path.relative(rootDir, htmlPath);

            if (!expectedIntegrity.has(url)) {
                problems.push(`${relativePath}: unapproved or unpinned dependency ${url}`);
                continue;
            }
            if (integrity !== expectedIntegrity.get(url)) {
                problems.push(`${relativePath}: missing or incorrect SRI for ${url}`);
            }
            if (crossorigin !== 'anonymous') {
                problems.push(`${relativePath}: crossorigin must be anonymous for ${url}`);
            }
        }
    });

    assert.deepEqual(problems, []);
});

test('uni-app manifest requests no native permissions for the static site', () => {
    const manifest = fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8');
    assert.doesNotMatch(manifest, /<uses-(?:permission|feature)\b/i);
});

test('form preset pages load dialog and storage assets before the preset script', () => {
    const problems = [];

    walk(rootDir, '.html').forEach(htmlPath => {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const transferIndex = html.indexOf('utils/form-import-export.js');
        if (transferIndex === -1) return;

        const relativePath = path.relative(rootDir, htmlPath);
        const dialogIndex = html.indexOf('utils/dialog.js');
        const storageIndex = html.indexOf('utils/storage-service.js');
        if (dialogIndex === -1 || dialogIndex > transferIndex) {
            problems.push(`${relativePath}: dialog.js must load before form-import-export.js`);
        }
        if (storageIndex === -1 || storageIndex > transferIndex) {
            problems.push(`${relativePath}: storage-service.js must load before form-import-export.js`);
        }
        if (!html.includes('css/components.css')) {
            problems.push(`${relativePath}: components.css is required for preset dialogs`);
        }
        if (!/FormImportExport\.init\(\{[\s\S]*storageKey\s*:/.test(html)) {
            problems.push(`${relativePath}: FormImportExport.init must provide storageKey`);
        }
        if (/data-action="import"|data-action="export"|filenamePrefix\s*:/.test(html)) {
            problems.push(`${relativePath}: calculator pages must not keep file import/export config`);
        }
        // 有「返回主页」的方案页，工具条应挂在返回链接旁，避免插到内容区或被顶栏重叠盖住
        if (html.includes('back-to-home') && !/inlineAfterSelector\s*:\s*['"]\.back-to-home['"]/.test(html)) {
            problems.push(`${relativePath}: FormImportExport.init must use inlineAfterSelector: '.back-to-home'`);
        }
    });

    assert.deepEqual(problems, []);
});
