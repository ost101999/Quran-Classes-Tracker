const { app, BrowserWindow, ipcMain, shell, clipboard, protocol, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const { createChromeTabBridge } = require('./chrome-tab-bridge');
const { focusChromeWindow } = require('./chrome-window-focus');
const { createSyncQueue } = require('./sync-queue');
const { sanitizeKeys } = require('./firebase-patch');
const { createFirebaseClient } = require('./firebase-client');
const { createSelectiveSync, cloudProjection, get } = require('./selective-sync');
const { readMatches } = require('./shortcut-links');
const { createCalendarSchedules } = require('./calendar-schedules');
const { registerAppUpdates } = require('./app-update');
const getCalendarSchedules = createCalendarSchedules();
ipcMain.handle('get-calendar-schedules', (_event, students, force, review, dayTransitionTime) => getCalendarSchedules(students, { force: force === true, review: review === true, dayTransitionTime }));
const chromeTabBridge = createChromeTabBridge({ onFocus: focusChromeWindow });

ipcMain.handle('get-shortcut-links', (_event, students) => {
    const requests = Array.isArray(students) ? students.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string') : [];
    return readMatches(requests);
});

// Helper for waiting
const waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let mainWindow;
let whatsappBrowser = null;
let whatsappPage = null;

async function closeWhatsAppBrowserSafe(reason = '') {
    if (!whatsappBrowser) {
        whatsappPage = null;
        return;
    }

    try {
        if (reason) console.log(reason);
        await whatsappBrowser.close();
    } catch (err) {
        console.error('Failed to close WhatsApp browser cleanly:', err);
    } finally {
        whatsappBrowser = null;
        whatsappPage = null;
    }
}

// Normalize URLs so shell.openExternal can reliably open them
function normalizeUrl(url) {
    const s = (url || '').toString().trim();
    if (!s) return '';
    // If no scheme is provided, assume https
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s)) return `https://${s}`;
    return s;
}

function toWesternDigits(value) {
    const input = String(value || '');
    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
    return input.replace(/[٠-٩۰-۹]/g, (digit) => {
        const idxArabic = arabicIndic.indexOf(digit);
        if (idxArabic > -1) return String(idxArabic);
        const idxEastern = easternArabicIndic.indexOf(digit);
        if (idxEastern > -1) return String(idxEastern);
        return digit;
    });
}

function extractWhatsAppPhone(target) {
    const normalizedTarget = toWesternDigits((target || '').toString().trim());
    if (!normalizedTarget) return '';

    const tryExtractDigits = (value) => {
        const digits = toWesternDigits(String(value || '')).replace(/\D/g, '');
        return digits.length >= 9 ? digits : '';
    };

    // Handle wa.me links and whatsapp.com/send links (phone in path or query string)
    const parseFromUrl = (raw) => {
        try {
            const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            const url = new URL(candidate);
            const host = (url.hostname || '').replace(/^www\./i, '').toLowerCase();

            if (host === 'wa.me') {
                const pathPart = (url.pathname || '').split('/').filter(Boolean).pop() || '';
                const fromPath = tryExtractDigits(pathPart);
                if (fromPath) return fromPath;
            }

            if (host.endsWith('whatsapp.com')) {
                const fromQuery = tryExtractDigits(url.searchParams.get('phone') || url.searchParams.get('to'));
                if (fromQuery) return fromQuery;

                const pathPart = (url.pathname || '').split('/').filter(Boolean).pop() || '';
                const fromPath = tryExtractDigits(pathPart);
                if (fromPath) return fromPath;
            }
        } catch {
            // Ignore URL parse failures and continue with generic digit extraction
        }

        return '';
    };

    const fromUrl = parseFromUrl(normalizedTarget);
    if (fromUrl) return fromUrl;

    // Generic number format: +, spaces, dashes, parentheses, etc.
    return tryExtractDigits(normalizedTarget);
}

function getChromePath() {
    if (process.platform === 'darwin') {
        const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(macPath)) return macPath;
        return null;
    }
    
    if (process.platform === 'win32') {
        const candidates = [
            'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\\\Chrome\\\\Application\\\\chrome.exe'),
        ];
        for (const p of candidates) {
            try {
                if (p && fs.existsSync(p)) return p;
            } catch {
                // ignore
            }
        }
    }
    return null;
}

async function openExternalMaximized(url) {
    const chromePath = getChromePath();
    if (chromePath) {
        // Force a new Chrome window that starts maximized
        try {
            const child = spawn(chromePath, ['--new-window', '--start-maximized', url], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            return true;
        } catch (e) {
            console.error('Failed to spawn Chrome directly:', e);
        }
    }

    if (process.platform === 'darwin') {
        try {
            const child = spawn('open', ['-a', 'Google Chrome', '-n', '--args', '--start-maximized', url], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            return true;
        } catch (e) {
            shell.openExternal(url).catch(() => {});
            return true;
        }
    }

    // Fallback: ask Windows to open URL (may reuse existing browser window size)
    try {
        const ps = spawn('powershell', [
            '-NoProfile',
            '-Command',
            `Start-Process -FilePath "${url}" -WindowStyle Maximized`
        ]);
        ps.on('error', (err) => {
            console.error('PowerShell spawn error:', err);
            shell.openExternal(url).catch(() => { });
        });
        return true;
    } catch (e) {
        console.error('Maximized open fallback failed:', e);
        return false;
    }
}

// WhatsApp Session Directory
const WHATSAPP_SESSION_DIR = path.join(app.getPath('userData'), 'whatsapp-session');

let isInitializing = false;

// Initialize WhatsApp Browser - stable launch for every send
async function initWhatsApp() {
    // Never reuse old browser instances; stale pages are a common source of grey/frozen WhatsApp screens.
    if (whatsappBrowser && !isInitializing) {
        await closeWhatsAppBrowserSafe('Closing previous WhatsApp browser instance before reinitialization...');
    }

    // 2. Concurrency Lock
    if (isInitializing) {
        console.log('Wait... Initialization already in progress.');
        while (isInitializing) {
            await waitForTimeout(200);
        }
        // Retry getting the instance
        return initWhatsApp();
    }

    isInitializing = true;

    try {
        // Create session directory if not exists
        if (!fs.existsSync(WHATSAPP_SESSION_DIR)) {
            fs.mkdirSync(WHATSAPP_SESSION_DIR, { recursive: true });
        }

        console.log('Launching WhatsApp browser (stable mode)...');

        // Launch visible and minimized with stable flags.
        // Off-screen windows can trigger rendering/focus glitches (grey screen, stuck UI) on some Windows setups.
        const launchOptions = {
            headless: false,
            userDataDir: WHATSAPP_SESSION_DIR,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1280,900',
                '--start-minimized'
            ]
        };

        const systemChromePath = getChromePath();
        if (systemChromePath) {
            launchOptions.executablePath = systemChromePath;
            console.log(`Using system Chrome for WhatsApp automation: ${systemChromePath}`);
        }

        whatsappBrowser = await puppeteer.launch(launchOptions);

        const pages = await whatsappBrowser.pages();
        console.log(`Browser opened with ${pages.length} pages.`);

        // Strategy: Use one controlled tab and close extras.
        const allPages = await whatsappBrowser.pages();
        const existingWahPage = allPages.find(p => p.url().includes('web.whatsapp.com'));

        if (existingWahPage) {
            console.log('Reusing existing WhatsApp tab.');
            whatsappPage = existingWahPage;
        } else {
            console.log('Navigating to WhatsApp Web...');
            // Reuse the first page (usually 'about:blank') if available, otherwise new page
            whatsappPage = allPages.length > 0 ? allPages[0] : await whatsappBrowser.newPage();
            await whatsappPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        }

        try {
            await whatsappPage.bringToFront();
            await whatsappPage.evaluate(() => window.focus());
        } catch {
            // Ignore focus-related failures; Puppeteer can still operate.
        }

        console.log('WhatsApp Web loaded!');

        // Cleanup: STRICTLY close ALL other tabs to ensure only ONE exists
        const cleanupPages = await whatsappBrowser.pages();
        if (cleanupPages.length > 1) {
            console.log('Cleaning up extra tabs (Enforcing Single Tab)...');
            for (const p of cleanupPages) {
                if (p !== whatsappPage) {
                    try { await p.close(); } catch (e) { }
                }
            }
        }

        return { browser: whatsappBrowser, page: whatsappPage };

    } catch (err) {
        console.error('Initialization Failed:', err);
        throw err;
    } finally {
        isInitializing = false;
    }
}

// Send WhatsApp Message - RADICAL V5 (Clipboard Strategy)
async function sendWhatsAppMessage(targetName, message) {
    try {
        console.log('=== Starting WhatsApp Automation (RADICAL V5 - CLIPBOARD REVERT) ===');
        console.log(`Target: "${targetName}"`);

        const parsedPhoneTarget = extractWhatsAppPhone(targetName);
        let searchTargetName = toWesternDigits(targetName);
        let shouldFallbackToSearch = false;

        const { page } = await initWhatsApp();

        const ensureWhatsAppSurfaceReady = async () => {
            let recoveryRefreshUsed = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const currentUrl = page.url() || '';
                    if (!/web\.whatsapp\.com/i.test(currentUrl)) {
                        console.log(`Unexpected page URL (${currentUrl || 'empty'}). Navigating back to WhatsApp Web...`);
                        await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
                    }

                    try {
                        await page.bringToFront();
                        await page.evaluate(() => window.focus());
                    } catch {
                        // Ignore focus issues and continue.
                    }

                    await page.waitForFunction(() => {
                        return Boolean(
                            document.querySelector('#pane-side') ||
                            document.querySelector('div[data-tab="3"]') ||
                            document.querySelector('div[data-tab="10"]') ||
                            document.querySelector('canvas')
                        );
                    }, { timeout: 30000 });

                    const looksBlankOrFrozen = await page.evaluate(() => {
                        const hasInterface = Boolean(
                            document.querySelector('#pane-side') ||
                            document.querySelector('div[data-tab="3"]') ||
                            document.querySelector('div[data-tab="10"]') ||
                            document.querySelector('canvas')
                        );

                        const body = document.body;
                        if (!body) return true;

                        const text = (body.innerText || '').trim();
                        const interactiveCount = document.querySelectorAll('button, [role="button"], [contenteditable="true"]').length;

                        return !hasInterface && text.length === 0 && interactiveCount === 0;
                    });

                    if (looksBlankOrFrozen) {
                        if (!recoveryRefreshUsed) {
                            recoveryRefreshUsed = true;
                            console.log('Grey/blank WhatsApp surface detected. Running one-time recovery refresh...');
                            try {
                                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                            } catch {
                                await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
                            }
                            await waitForTimeout(1500);
                            continue;
                        }

                        throw new Error('Grey/blank WhatsApp surface detected');
                    }

                    return;
                } catch (error) {
                    console.log(`WhatsApp surface ready-check failed (${attempt}/3):`, error?.message || error);

                    const failedUrl = page.url() || '';
                    if (!recoveryRefreshUsed && /web\.whatsapp\.com/i.test(failedUrl)) {
                        recoveryRefreshUsed = true;
                        console.log('Surface ready-check failed on WhatsApp URL. Running one-time recovery refresh...');
                        try {
                            await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                        } catch {
                            await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
                        }
                        await waitForTimeout(1500);
                        continue;
                    }

                    if (attempt === 3) {
                        throw new Error('WhatsApp screen is not ready (grey/blank/frozen).');
                    }

                    // Do NOT force refresh when already on WhatsApp; this can cause grey-screen loops.
                    if (!/web\.whatsapp\.com/i.test(failedUrl)) {
                        try {
                            await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
                        } catch {
                            // Continue retry loop
                        }
                    } else {
                        console.log('Retrying surface check without forced refresh.');
                    }

                    await waitForTimeout(1200 * attempt);
                }
            }
        };

        console.log('Waiting for WhatsApp main interface...');
        await ensureWhatsAppSurfaceReady();

        // 2. Check for QR Code
        const isQR = await page.evaluate(() => !!document.querySelector('canvas'));
        if (isQR) {
            console.log('!!! QR CODE DETECTED !!! Please scan it.');
            await page.waitForFunction(() => !document.querySelector('canvas'), { timeout: 0 });
            console.log('QR Scanned! Waiting for reload...');
            await waitForTimeout(5000);
            await ensureWhatsAppSurfaceReady();
        }




        // 3.5. PHONE NUMBER CHECK (Direct Navigation)
        // Supports raw numbers, Arabic digits, and WhatsApp URL formats (wa.me / whatsapp.com/send)
        const isPhoneNumber = Boolean(parsedPhoneTarget);

        if (isPhoneNumber) {
            const cleanNumber = parsedPhoneTarget;
            console.log(`Target detected as Phone Number: ${cleanNumber}. Using Direct URL...`);

            try {
                await page.goto(`https://web.whatsapp.com/send?phone=${cleanNumber}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

                const directMessageBoxSelector = 'footer div[contenteditable="true"]';
                console.log('Waiting for direct chat load...');

                let directState = 'timeout';
                try {
                    const stateHandle = await page.waitForFunction(() => {
                        const msgBox = document.querySelector('footer div[contenteditable="true"]');
                        if (msgBox) return 'ready';

                        const bodyText = (document.body?.innerText || '').toLowerCase();
                        const invalidSignals = [
                            'phone number shared via url is invalid',
                            'shared via url is invalid',
                            'this number is not on whatsapp',
                            'رقم الهاتف',
                            'غير صالح'
                        ];
                        if (invalidSignals.some((signal) => bodyText.includes(signal))) return 'invalid';

                        const continueBtn = Array.from(document.querySelectorAll('button, [role="button"], a')).find((el) => {
                            const txt = String(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().trim();
                            if (!txt) return false;
                            return txt.includes('continue') || txt.includes('chat') || txt.includes('متابعة') || txt.includes('الدردشة');
                        });
                        if (continueBtn) return 'continue';

                        const hasMainUi = Boolean(
                            document.querySelector('#pane-side') ||
                            document.querySelector('div[data-tab="3"]') ||
                            document.querySelector('div[data-tab="10"]')
                        );
                        if (hasMainUi) return 'search-fallback';

                        return false;
                    }, { timeout: 22000 });

                    directState = await stateHandle.jsonValue();
                } catch {
                    directState = 'timeout';
                }

                if (directState === 'continue') {
                    await page.evaluate(() => {
                        const candidate = Array.from(document.querySelectorAll('button, [role="button"], a')).find((el) => {
                            const txt = String(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase().trim();
                            return txt.includes('continue') || txt.includes('chat') || txt.includes('متابعة') || txt.includes('الدردشة');
                        });
                        if (candidate) {
                            candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            candidate.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                            candidate.click();
                        }
                    });

                    await page.waitForSelector(directMessageBoxSelector, { timeout: 15000 });
                    directState = 'ready';
                }

                if (directState === 'invalid' || directState === 'timeout' || directState === 'search-fallback') {
                    shouldFallbackToSearch = true;
                    searchTargetName = cleanNumber;
                    console.log(`Direct URL state (${directState}) - switching to search fallback.`);
                }
            } catch (e) {
                shouldFallbackToSearch = true;
                searchTargetName = cleanNumber;
                console.log('Direct URL open failed. Switching to search fallback...');
            }

        }

        if (!isPhoneNumber || shouldFallbackToSearch) {
            await ensureWhatsAppSurfaceReady();

            // 4. Search for Target (Name)
            console.log(`Step 3: Searching for "${searchTargetName}"`);
            const isUsableSearchBox = async (element) => {
                if (!element) return false;
                return page.evaluate((el) => {
                    if (!(el instanceof HTMLElement)) return false;
                    if (el.closest('footer')) return false;
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
                }, element);
            };

            const findSearchBoxBySelectors = async (selectors) => {
                for (const selector of selectors) {
                    const candidates = await page.$$(selector);
                    for (const candidate of candidates) {
                        if (await isUsableSearchBox(candidate)) {
                            return candidate;
                        }
                    }
                }
                return null;
            };

            const getActiveEditableSearchBox = async () => {
                try {
                    const activeHandle = await page.evaluateHandle(() => {
                        const active = document.activeElement;
                        if (!active) return null;

                        const isEditable =
                            active instanceof HTMLInputElement ||
                            active instanceof HTMLTextAreaElement ||
                            (active instanceof HTMLElement && active.isContentEditable);

                        if (!isEditable) return null;
                        if (active instanceof HTMLElement && active.closest('footer')) return null;

                        return active;
                    });

                    const activeElement = activeHandle.asElement();
                    if (!activeElement) return null;

                    const usable = await isUsableSearchBox(activeElement);
                    return usable ? activeElement : null;
                } catch {
                    return null;
                }
            };

            const focusAndClearSearchBox = async (searchBox) => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        await searchBox.click({ clickCount: 1 });
                        await waitForTimeout(120);
                        const isFocused = await page.evaluate((el) => {
                            const active = document.activeElement;
                            return active === el || (el instanceof HTMLElement && el.contains(active));
                        }, searchBox);

                        if (!isFocused) continue;

                        await page.keyboard.down('Control');
                        await page.keyboard.press('A');
                        await page.keyboard.up('Control');
                        await page.keyboard.press('Backspace');
                        return true;
                    } catch {
                        // Retry with next attempt
                    }
                }

                return false;
            };

            const readEditableText = async (editableHandle) => {
                if (!editableHandle) return '';
                try {
                    return await page.evaluate((el) => {
                        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                            return (el.value || '').trim();
                        }
                        if (!(el instanceof HTMLElement)) return '';
                        return (el.innerText || el.textContent || '').trim();
                    }, editableHandle);
                } catch {
                    return '';
                }
            };

            const injectSearchTextViaDom = async (text) => {
                return page.evaluate((value) => {
                    const isVisible = (el) => {
                        if (!(el instanceof HTMLElement)) return false;
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
                    };

                    const candidates = Array.from(document.querySelectorAll('div[contenteditable="true"], p[contenteditable="true"], [contenteditable="true"][role="textbox"], input[type="text"], input[role="textbox"], textarea'))
                        .filter((el) => !el.closest('footer') && isVisible(el));

                    const active = document.activeElement;
                    const activeEditable =
                        ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)) &&
                            !(active instanceof HTMLElement && active.closest('footer')))
                            ? active
                            : null;
                    const target = activeEditable || candidates[0] || null;

                    if (!target) {
                        return { success: false, reason: 'no-target', text: '' };
                    }

                    target.focus();

                    const dispatchInput = (inputType, data) => {
                        try {
                            target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType, data }));
                        } catch {
                            target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        }
                    };

                    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                        target.value = '';
                        dispatchInput('deleteContentBackward', null);
                        target.value = value;
                        dispatchInput('insertText', value);
                        target.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                        const finalValue = (target.value || '').trim();
                        return { success: finalValue.length > 0, reason: 'input-value', text: finalValue };
                    }

                    target.textContent = '';
                    dispatchInput('deleteContentBackward', null);

                    let inserted = false;
                    try {
                        if (typeof document.execCommand === 'function') {
                            inserted = document.execCommand('insertText', false, value);
                        }
                    } catch {
                        inserted = false;
                    }

                    if (!inserted) {
                        target.textContent = value;
                    }

                    dispatchInput('insertText', value);

                    const finalText = (target.innerText || target.textContent || '').trim();
                    return { success: finalText.length > 0, reason: inserted ? 'execCommand' : 'textContent', text: finalText };
                }, text);
            };

            const typeDirectlyInSearchBox = async (editableHandle, text) => {
                if (!editableHandle) return false;
                try {
                    await editableHandle.click({ clickCount: 1 });
                    await waitForTimeout(120);
                    await editableHandle.type(text, { delay: 95 });
                    await waitForTimeout(300);
                    return true;
                } catch {
                    return false;
                }
            };

            const enterSearchTargetText = async (editableHandle, text) => {
                let content = '';

                const byHandle = await typeDirectlyInSearchBox(editableHandle, text);
                if (byHandle) {
                    content = await readEditableText(editableHandle);
                    if (content) return { content, strategy: 'element-handle-type' };
                }

                try {
                    await page.keyboard.type(text, { delay: 100 });
                    await waitForTimeout(300);
                } catch {
                    // Fallback continues
                }

                content = await readEditableText(editableHandle);
                if (content) return { content, strategy: 'keyboard-type' };

                const domInjectionResult = await injectSearchTextViaDom(text);
                content = await readEditableText(editableHandle);
                if (!content && domInjectionResult && domInjectionResult.text) {
                    content = String(domInjectionResult.text).trim();
                }
                if (content) return { content, strategy: 'dom-injection' };

                clipboard.writeText(text);
                try {
                    await editableHandle.click({ clickCount: 1 });
                    await waitForTimeout(120);
                    await page.keyboard.down('Control');
                    await page.keyboard.press('V');
                    await page.keyboard.up('Control');
                    await waitForTimeout(400);
                } catch {
                    // Final read below
                }

                content = await readEditableText(editableHandle);
                if (content) return { content, strategy: 'clipboard-paste' };

                return { content: '', strategy: 'none' };
            };

            const primarySearchSelectors = [
                'div[aria-label="Search input textbox"][contenteditable="true"]',
                'div[aria-label*="Search"][contenteditable="true"]',
                'div[title="Search input textbox"][contenteditable="true"]',
                'div[title*="Search input textbox"][contenteditable="true"]',
                'div[aria-label*="بحث"][contenteditable="true"]',
                'div[title*="بحث"][contenteditable="true"]',
                '#side input[aria-label*="Search"]',
                '#side input[title*="Search"]',
                '#side input[placeholder*="Search"]',
                '#side input[aria-label*="بحث"]',
                '#side input[title*="بحث"]',
                '#side input[placeholder*="بحث"]',
                '#side input[type="text"]',
                '#side div[contenteditable="true"][data-tab="3"]',
                '#side div[contenteditable="true"][data-tab="10"]',
                '#side div[contenteditable="true"][role="textbox"]'
            ];

            const newChatTriggerSelectors = [
                'button[aria-label*="New chat"]',
                'button[title*="New chat"]',
                'button[aria-label*="دردشة جديدة"]',
                'button[title*="دردشة جديدة"]',
                'span[data-icon="new-chat-outline"]',
                'span[data-icon="new-chat"]'
            ];

            const newChatSearchSelectors = [
                'div[aria-label*="Search name or number"][contenteditable="true"]',
                'div[title*="Search name or number"][contenteditable="true"]',
                'div[aria-label*="البحث عن اسم أو رقم"][contenteditable="true"]',
                'div[title*="البحث عن اسم أو رقم"][contenteditable="true"]',
                '[data-animate-modal-popup="true"] input[aria-label*="Search"]',
                '[data-animate-modal-popup="true"] input[placeholder*="Search"]',
                '[data-animate-modal-popup="true"] input[aria-label*="بحث"]',
                '[data-animate-modal-popup="true"] input[placeholder*="بحث"]',
                '[data-animate-modal-popup="true"] input[type="text"]',
                '[data-animate-modal-popup="true"] div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"][role="textbox"]'
            ];

            let searchBox = null;
            for (let surfaceAttempt = 1; surfaceAttempt <= 3 && !searchBox; surfaceAttempt++) {
                // Close any open overlays before searching.
                try { await page.keyboard.press('Escape'); } catch { }
                await waitForTimeout(200);

                for (let attempt = 1; attempt <= 3 && !searchBox; attempt++) {
                    searchBox = await findSearchBoxBySelectors(primarySearchSelectors);
                    if (!searchBox) {
                        searchBox = await getActiveEditableSearchBox();
                        if (searchBox) {
                            console.log('Using active editable element as primary search fallback.');
                            break;
                        }
                    }
                    if (!searchBox) await waitForTimeout(250);
                }

                if (!searchBox) {
                    console.log('Primary search box not found. Trying New Chat flow...');
                    for (const selector of newChatTriggerSelectors) {
                        const trigger = await page.$(selector);
                        if (trigger) {
                            try {
                                await trigger.click();
                                await waitForTimeout(600);
                                break;
                            } catch {
                                // Try next trigger
                            }
                        }
                    }

                    for (let attempt = 1; attempt <= 3 && !searchBox; attempt++) {
                        searchBox = await findSearchBoxBySelectors(newChatSearchSelectors);
                        if (!searchBox) {
                            searchBox = await getActiveEditableSearchBox();
                            if (searchBox) {
                                console.log('Using active editable element as New Chat search fallback.');
                                break;
                            }
                        }
                        if (!searchBox) await waitForTimeout(250);
                    }
                }

                if (!searchBox && surfaceAttempt < 3) {
                    console.log(`Search box not available yet. Re-checking WhatsApp surface (${surfaceAttempt}/3)...`);
                    await ensureWhatsAppSurfaceReady();
                    await waitForTimeout(700 * surfaceAttempt);
                }
            }

            if (!searchBox) throw new Error('Search box not found');

            const focusedAndCleared = await focusAndClearSearchBox(searchBox);
            if (!focusedAndCleared) throw new Error('Could not focus search box');

            // Reacquire handle in case WhatsApp re-rendered search UI after focus/clear.
            const refreshedSearchBox = await findSearchBoxBySelectors([...primarySearchSelectors, ...newChatSearchSelectors]);
            if (refreshedSearchBox) {
                searchBox = refreshedSearchBox;
            }

            const searchEnterResult = await enterSearchTargetText(searchBox, searchTargetName);
            const searchBoxContent = (searchEnterResult.content || '').trim();

            if (!searchBoxContent) {
                throw new Error('Failed to enter search target');
            }

            console.log(`Search target entered using strategy: ${searchEnterResult.strategy}`);

            await waitForTimeout(2000); // Wait for results

            // 5. Select the Chat (Robust Keyboard Navigation)
            console.log('Step 4: Selecting chat...');

            const clickSearchResultByName = async (needle) => {
                return page.evaluate((rawNeedle) => {
                    const normalize = (value) =>
                        String(value || '')
                            .toLowerCase()
                            .replace(/\s+/g, ' ')
                            .trim();

                    const target = normalize(rawNeedle);
                    const rowSelectors = [
                        '#pane-side div[role="listitem"]',
                        '#pane-side div[role="row"]',
                        '[data-testid="cell-frame-container"]',
                        '#pane-side [tabindex="0"]',
                        '[data-animate-modal-popup="true"] div[role="listitem"]'
                    ];

                    const rows = rowSelectors
                        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
                        .filter((el) => {
                            if (!(el instanceof HTMLElement)) return false;
                            const rect = el.getBoundingClientRect();
                            return rect.width > 2 && rect.height > 2;
                        });

                    if (!rows.length) return false;

                    let best = null;
                    let partial = null;

                    for (const row of rows) {
                        const text = normalize(row.innerText || row.textContent || '');
                        if (!text) continue;
                        if (text === target || text.startsWith(target)) {
                            best = row;
                            break;
                        }
                        if (!partial && text.includes(target)) {
                            partial = row;
                        }
                    }

                    const choice = best || partial || rows[0];
                    if (!choice) return false;

                    choice.scrollIntoView({ block: 'center', inline: 'nearest' });
                    const clickable = choice.querySelector('[role="gridcell"], [role="button"], div[tabindex], span[dir], a') || choice;

                    try {
                        clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        clickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    } catch {
                        // Ignore and continue to click
                    }

                    clickable.click();
                    return true;
                }, needle);
            };

            const isChatOpen = async () => {
                return page.evaluate(() => {
                    const selectors = [
                        'footer div[contenteditable="true"]',
                        'footer [contenteditable="true"][role="textbox"]',
                        'footer div[role="textbox"]',
                        'div[aria-label="Type a message"][contenteditable="true"]',
                        'div[aria-label*="message"][contenteditable="true"]',
                        'div[aria-label*="رسالة"][contenteditable="true"]'
                    ];

                    return selectors.some((selector) => {
                        const el = document.querySelector(selector);
                        if (!(el instanceof HTMLElement)) return false;
                        const rect = el.getBoundingClientRect();
                        return rect.width > 2 && rect.height > 2;
                    });
                });
            };

            const waitForChatOpen = async (timeoutMs = 12000) => {
                try {
                    await page.waitForFunction(() => {
                        const selectors = [
                            'footer div[contenteditable="true"]',
                            'footer [contenteditable="true"][role="textbox"]',
                            'footer div[role="textbox"]',
                            'div[aria-label="Type a message"][contenteditable="true"]',
                            'div[aria-label*="message"][contenteditable="true"]',
                            'div[aria-label*="رسالة"][contenteditable="true"]'
                        ];

                        return selectors.some((selector) => {
                            const el = document.querySelector(selector);
                            if (!(el instanceof HTMLElement)) return false;
                            const rect = el.getBoundingClientRect();
                            return rect.width > 2 && rect.height > 2;
                        });
                    }, { timeout: timeoutMs });
                    return true;
                } catch {
                    return false;
                }
            };

            const messageBoxSelector = 'footer div[contenteditable="true"], footer [contenteditable="true"][role="textbox"], footer div[role="textbox"], div[aria-label="Type a message"][contenteditable="true"], div[aria-label*="message"][contenteditable="true"], div[aria-label*="رسالة"][contenteditable="true"]';
            let openedByDomResult = false;

            try {
                openedByDomResult = await clickSearchResultByName(searchTargetName);
                if (openedByDomResult) {
                    const opened = await waitForChatOpen(5000);
                    if (!opened) {
                        // Some WA builds require Enter after selecting result.
                        await page.keyboard.press('Enter');
                        await waitForTimeout(700);
                    }
                }
            } catch {
                openedByDomResult = false;
            }

            // Fallback: WhatsApp sometimes requires keyboard navigation.
            if (!openedByDomResult) {
                console.log('DOM selection did not open chat. Trying keyboard fallback...');
                await page.keyboard.press('Enter');
                await waitForTimeout(500);
                if (!(await isChatOpen())) {
                    await page.keyboard.press('ArrowDown');
                    await waitForTimeout(300);
                    await page.keyboard.press('Enter');
                    await waitForTimeout(1500);
                }
            }

            let isInChat = (await isChatOpen()) ? true : null;

            if (!isInChat) {
                console.log('Primary selection failed. Trying exact list-click fallback...');
                // Strategy B: Click First valid search result
                try {
                    const rowSelector = '#pane-side div[role="listitem"], #pane-side div[role="row"], [data-testid="cell-frame-container"], [data-animate-modal-popup="true"] div[role="listitem"]';
                    await page.waitForSelector(rowSelector, { timeout: 3000 });
                    const results = await page.$$(rowSelector);
                    if (results.length > 0) {
                        // Click the first valid row
                        await results[0].click();
                        await waitForTimeout(1500);
                        isInChat = (await isChatOpen()) ? true : null;
                    } else {
                        throw new Error('Contact not found in list');
                    }
                } catch (e) {
                    console.log('No search results found to click.');
                }

                if (!isInChat) {
                    // Clear search to be safe
                    await searchBox.click();
                    await page.keyboard.down('Control');
                    await page.keyboard.press('A');
                    await page.keyboard.up('Control');
                    await page.keyboard.press('Backspace');
                    throw new Error('Contact not found or could not open chat');
                }
            }

            // 6. WAIT for Chat to Load (Double Check)
            console.log('Step 5: Waiting for chat to open...');
            const chatOpened = await waitForChatOpen(12000);
            if (!chatOpened) {
                console.error('Chat did not load in time. Aborting.');
                throw new Error('Chat load timeout');
            }
        }

        // 7. Focus Message Box (STRICT GUARD + RETRY)
        const exactSelector = 'footer div[contenteditable="true"], footer [contenteditable="true"][role="textbox"], footer div[role="textbox"], div[aria-label="Type a message"][contenteditable="true"], div[aria-label*="message"][contenteditable="true"], div[aria-label*="رسالة"][contenteditable="true"]';
        let isFocusSafe = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Explicitly focus
                await page.click(exactSelector);
                await waitForTimeout(500);

                // STRICT CHECK: Is the active element actually the message box?
                isFocusSafe = await page.evaluate((sel) => {
                    const active = document.activeElement;
                    const msgBox = document.querySelector(sel);
                    return active && msgBox && (active === msgBox || msgBox.contains(active));
                }, exactSelector);

                if (isFocusSafe) break;
                console.log(`Focus attempt ${attempt} failed. Retrying...`);
                await waitForTimeout(500);
            } catch (e) {
                console.log(`Focus attempt ${attempt} error:`, e.message);
            }
        }

        if (!isFocusSafe) {
            console.error('CRITICAL: Focus is NOT in message box! Aborting paste.');
            // Try to rescue: Blur everything
            await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
            throw new Error('Unsafe Focus State - Aborted to prevent wrong paste');
        }

        // 8. Type Message (The V5 "Clipboard" Strategy)
        console.log('Step 6: Injecting message via Clipboard');

        // A. Copy to Clipboard (The "Silver Bullet")
        clipboard.writeText(message);

        // B. Paste into Box
        // Verify we are actually focusing the message box
        const isMessageBoxFocused = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el === document.activeElement || el.contains(document.activeElement);
        }, exactSelector);

        if (!isMessageBoxFocused) {
            console.log('Message box lost focus. Re-clicking...');
            await page.click(exactSelector);
            await waitForTimeout(200);
        }

        // Simulate Paste (Ctrl+V)
        await page.keyboard.down('Control');
        await page.keyboard.press('V');
        await page.keyboard.up('Control');

        await waitForTimeout(500);

        // C. Verify Content
        let currentContent = await page.evaluate((s) => document.querySelector(s)?.innerText, exactSelector);
        console.log('Box content after paste:', currentContent);

        // D. Fallback: Raw Keyboard Typing (if paste failed)
        // Only attempt this if we are SURE we are in the message box
        const safeToType = await page.evaluate((sel) => !!document.querySelector(sel), exactSelector);

        if (safeToType && (!currentContent || currentContent.trim().length === 0)) {
            console.log('Paste failed. Switching to RAW KEYBOARD TYPING with formatting...');
            // Ensure focus once more
            await page.click(exactSelector);

            // Type character by character to handle newlines
            for (const char of message) {
                if (char === '\n') {
                    await page.keyboard.down('Shift');
                    await page.keyboard.press('Enter');
                    await page.keyboard.up('Shift');
                } else {
                    await page.keyboard.type(char);
                }
            }
        } else if (!safeToType) {
            throw new Error('Cannot type: Message box not found');
        }

        // 9. Send (The "Button Masher")
        console.log('Step 7: Identifying Send Button...');
        await waitForTimeout(500);

        // Check content again
        currentContent = await page.evaluate((s) => document.querySelector(s)?.innerText, exactSelector);
        if (!currentContent || currentContent.trim().length === 0) {
            throw new Error('Message box is STILL empty! Aborting send to prevent blank message.');
        }

        // Find the Send Button (Paper Plane)
        const sendBtnSelector = 'span[data-icon="send"], button[aria-label="Send"], button[aria-label="إرسال"]';

        try {
            await page.waitForSelector(sendBtnSelector, { timeout: 2000 });
            const sendBtn = await page.$(sendBtnSelector);
            console.log('Send button found! Clicking...');
            // Try closest button first, then the element itself
            const clickSuccess = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                const btn = el.closest('button') || el;
                if (btn) { btn.click(); return true; }
                return false;
            }, sendBtnSelector);

            if (!clickSuccess) throw new Error('Click failed inside evaluate');

        } catch (e) {
            console.log('Send button NOT found/clickable. Pressing ENTER...');
            await page.keyboard.press('Enter');
        }

        // Wait 10 seconds to ensure WhatsApp finishes sending the message
        console.log('Waiting 10 seconds to ensure message is sent...');
        await waitForTimeout(10000);
        console.log('=== SUCCESS - Closing Browser ===');

        await closeWhatsAppBrowserSafe('Closing browser after successful send...');

        return { success: true };

    } catch (error) {
        console.error('FATAL ERROR:', error);
        await closeWhatsAppBrowserSafe('Closing browser after failed send attempt...');
        return { success: false, error: error.message };
    }
}

// --- WhatsApp IPC Handler ---
ipcMain.handle('send-whatsapp-auto', async (event, data) => {
    console.log('===========================================');
    console.log('WhatsApp IPC Handler Called!');
    console.log('Data received:', JSON.stringify(data));
    console.log('===========================================');

    try {
        const { targetName, message } = data || {};
        if (!targetName) {
            console.error('No targetName provided!');
            return { success: false, error: 'No target name' };
        }
        console.log('Calling sendWhatsAppMessage...');
        const result = await sendWhatsAppMessage(targetName, message);
        console.log('sendWhatsAppMessage result:', result);
        return result;
    } catch (error) {
        console.error('IPC Handler Error:', error);
        return { success: false, error: error.message };
    }
});

// --- Open External Links ---
ipcMain.handle('open-external', async (event, url, options) => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return { success: false, error: 'Empty URL' };

    if (options?.reuseExisting && await chromeTabBridge.focusExisting(normalizedUrl)) {
        return { success: true, reused: true };
    }

    if (options && options.background && process.platform === 'win32') {
        try {
            // Radical Strategy: "The Iron Dome"
            // 1. "Shield Up": Force window to stay on top of everything
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }

            // 2. "Lock Focus": Aggressively reclaim focus every 5ms
            // This fights the OS trying to give focus to the new browser window
            const focusInterval = setInterval(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                    mainWindow.moveTop();
                }
            }, 5);

            // 3. Launch via PowerShell as Minimized
            // Start-Process allows us to specify WindowStyle Minimized directly
            const ps = spawn('powershell', [
                '-NoProfile',
                '-Command',
                `Start-Process -FilePath "${normalizedUrl}" -WindowStyle Minimized`
            ]);

            ps.on('error', (err) => {
                console.error('PowerShell spawn error:', err);
                shell.openExternal(normalizedUrl); // Fallback
            });

            // 4. Cleanup after 3 seconds (sufficient time for browser to launch and settle)
            setTimeout(() => {
                clearInterval(focusInterval);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setAlwaysOnTop(false); // Release the shield
                    mainWindow.focus(); // Final ensure focus
                }
            }, 3000);

        } catch (error) {
            console.error('Background open error:', error);
            shell.openExternal(normalizedUrl);
        }
    } else if (options && options.background && mainWindow) {
        // ... (Non-Windows logic remains same or similar fallback) ...
        try {
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            const focusInterval = setInterval(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.focus();
                    mainWindow.moveTop();
                }
            }, 50);

            shell.openExternal(normalizedUrl).catch(err => console.error('Failed to open external URL:', err));

            setTimeout(() => {
                clearInterval(focusInterval);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.setAlwaysOnTop(false);
                    mainWindow.focus();
                }
            }, 2000);
        } catch (error) {
            console.error('Background open error:', error);
        }
    } else {
        // Default behavior: open externally (non-background / no options)
        try {
            if (process.platform === 'win32') {
                // On Windows, prefer forcing a maximized Chrome window when available
                await openExternalMaximized(normalizedUrl);
                return { success: true };
            }

            await shell.openExternal(normalizedUrl);
            return { success: true };
        } catch (error) {
            console.error('Failed to open external URL:', error);
            return { success: false, error: error.message };
        }
    }

    return { success: true };
});


function createWindow() {
    if (process.platform === 'darwin') {
        const dockIconPath = path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).png');
        if (fs.existsSync(dockIconPath)) {
            app.dock.setIcon(dockIconPath);
        }
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: process.platform === 'win32'
            ? path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).ico')
            : path.join(__dirname, 'public/ChatGPT Image 21 يناير 2026، 04_27_04 ص.png  ( 2 ).png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const template = [
        ...(process.platform === 'darwin' ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (process.platform !== 'darwin') {
        mainWindow.setAutoHideMenuBar(true);
        mainWindow.setMenuBarVisibility(false);
    }

    const isDev = !app.isPackaged;
    
    // Determine dynamic port
    let port = process.env.PORT || 3000;
    const portArgIndex = process.argv.indexOf('--port');
    if (portArgIndex !== -1 && process.argv.length > portArgIndex + 1) {
        port = parseInt(process.argv[portArgIndex + 1], 10);
    }

    const startUrl = isDev
        ? `http://localhost:${port}`
        : `file://${path.join(__dirname, 'dist/index.html')}`;

    mainWindow.maximize();
    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => (mainWindow = null));

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            const hasCmdOrCtrl = input.control || input.meta;
            const isR = input.code === 'KeyR';
            const isF5 = input.code === 'F5';

            // Refresh shortcuts: F5 (without shift), Ctrl+R, Cmd+R
            if (isF5 || (hasCmdOrCtrl && isR)) {
                if (input.shift) {
                    if (isR) {
                        mainWindow.webContents.reloadIgnoringCache();
                        event.preventDefault();
                    }
                    // For Shift+F5, let it pass through to React
                } else {
                    mainWindow.webContents.reload();
                    event.preventDefault();
                }
            }

            // DevTools: Ctrl+Shift+I / Cmd+Option+I
            const isDevTools = (process.platform === 'darwin' && input.alt && input.meta && input.code === 'KeyI') ||
                               (process.platform !== 'darwin' && input.control && input.shift && input.code === 'KeyI');
            if (isDevTools) {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }

            if (input.key === 'Escape') {
                mainWindow.webContents.send('escape-pressed');
            }
        }
    });

    // Intercept internal links and redirect to WebModal
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.includes('quranreport.vercel.app')) {
            mainWindow.webContents.send('navigate-internal', url);
            return { action: 'deny' };
        }
        // For actual external links, open in system browser but deny the new electron window
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function resolveLocalFilePathFromUrl(requestUrl) {
    const raw = String(requestUrl || '').replace(/^local-file:\/\//i, '');
    const decoded = decodeURIComponent(raw);
    // Handle Windows URLs like /C:/Users/... produced by URL parsing
    return decoded.replace(/^\/([a-zA-Z]:[\\/])/, '$1');
}

function registerLocalFileProtocol() {
    try {
        protocol.registerFileProtocol('local-file', (request, callback) => {
            try {
                const filePath = resolveLocalFilePathFromUrl(request.url);
                if (!filePath || !fs.existsSync(filePath)) {
                    callback({ error: -6 }); // FILE_NOT_FOUND
                    return;
                }
                callback({ path: filePath });
            } catch (error) {
                console.error('Failed to resolve local-file request:', request.url, error);
                callback({ error: -2 }); // FAILED
            }
        });
    } catch (error) {
        console.error('Failed to register local-file protocol:', error);
    }
}

app.whenReady().then(() => {
    registerAppUpdates({ app, ipcMain, shell, dialog, getMainWindow: () => mainWindow });
    chromeTabBridge.start();
    registerLocalFileProtocol();
    createWindow();
    initializeLastSyncedState();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- Data Persistence IPC ---
const DATA_PATH = path.join(app.getPath('userData'), 'data.json');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const TAJWEED_BANK_PATH = path.join(app.getPath('userData'), 'tajweed-bank.json');
const TAJWEED_SUBMISSIONS_PATH = path.join(app.getPath('userData'), 'tajweed-submissions.json');
const TAJWEED_AUDIO_DIR = process.platform === 'win32'
    ? 'Z:\\تسجيلات الطلبة الصوتية'
    : path.join(app.getPath('userData'), 'tajweed-audio');
const CLOUD_APPSTATE_URL = 'https://quran-classes-tracker-default-rtdb.firebaseio.com/appState.json';

// Durable baseline, conditional record uploads, and hash-verified incremental reads.
const LAST_SYNCED_PATH = path.join(app.getPath('userData'), 'last-synced-state.json');
const PENDING_SYNC_PATH = path.join(app.getPath('userData'), 'pending-sync.json');
const SYNC_METADATA_PATH = path.join(app.getPath('userData'), 'sync-metadata.json');
function writeJsonAtomic(file, value) {
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
    fs.renameSync(`${file}.tmp`, file);
}
function readJson(file, fallback = {}) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
let syncEngine;
let localRevision = 0;
let stagedPull = null;
let pullSequence = 0;
let operation = Promise.resolve();
function withSyncLock(work) {
    const result = operation.then(work);
    operation = result.catch(() => {});
    return result;
}
const initializeLastSyncedState = () => {
    // Fail closed on corrupt metadata; never turn an unreadable baseline into an
    // empty baseline and overwrite cloud records. Existing backups stay intact.
    syncEngine = createSelectiveSync({
        client: createFirebaseClient(CLOUD_APPSTATE_URL.replace(/\.json$/, '')),
        baseline: readJson(LAST_SYNCED_PATH),
        metadata: readJson(SYNC_METADATA_PATH),
        saveBaseline: data => writeJsonAtomic(LAST_SYNCED_PATH, data),
        saveMetadata: data => writeJsonAtomic(SYNC_METADATA_PATH, data),
        archiveConflict: data => {
            const folder = path.join(app.getPath('userData'), 'sync-conflicts');
            fs.mkdirSync(folder, { recursive: true });
            writeJsonAtomic(path.join(folder, `${Date.now()}-${require('node:crypto').randomUUID()}.json`), data);
        },
    });
    const local = readJson(DATA_PATH, readJson(PENDING_SYNC_PATH, null));
    if (local && (fs.existsSync(PENDING_SYNC_PATH) || Object.keys(syncEngine.patchFor(local)).length || syncEngine.hasNotification())) queueFirebaseSync(local);
};
const performFirebaseSync = data => withSyncLock(async () => {
    stagedPull = null;
    const timestamp = await syncEngine.push(data);
    if (timestamp && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cloud-sync-success', timestamp);
    return timestamp;
});

const syncQueue = createSyncQueue({
    send: performFirebaseSync,
    savePending: (data) => {
        const tempPath = `${PENDING_SYNC_PATH}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(data));
        fs.renameSync(tempPath, PENDING_SYNC_PATH);
    },
    clearPending: () => { if (fs.existsSync(PENDING_SYNC_PATH)) fs.unlinkSync(PENDING_SYNC_PATH); },
    onChange: (status) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync-status', status);
    },
});
const queueFirebaseSync = (data) => syncQueue.enqueue(data);

ipcMain.handle('get-sync-status', () => ({ ...syncQueue.status(), conflict: !!syncEngine?.conflicts().length }));
ipcMain.handle('retry-sync', () => syncQueue.flush());

let cloudPullPromise = null;
ipcMain.handle('get-cloud-changes', () => {
    if (cloudPullPromise) return cloudPullPromise;
    cloudPullPromise = withSyncLock(async () => {
        if (!syncEngine) return { busy: true };
        if (syncQueue.status().hasPending) return { busy: true };
        const revision = localRevision;
        const result = await syncEngine.pull();
        if (revision !== localRevision || syncQueue.status().hasPending) return { busy: true };
        const token = ++pullSequence;
        stagedPull = { token, revision, baseline: result.baseline };
        return { changes: result.changes, token };
    }).finally(() => { cloudPullPromise = null; });
    return cloudPullPromise;
});
ipcMain.handle('get-sync-conflicts', () => {
    if (!syncEngine) return [];
    const conflicts = syncEngine.conflicts();
    if (!conflicts.length) return [];
    const local = cloudProjection(readJson(DATA_PATH), syncEngine.baseline());
    return conflicts.map(item => ({ ...item, localValue: get(local, item.path) }));
});
ipcMain.handle('resolve-sync-conflict', (_event, conflictPath, choice, etag) => withSyncLock(async () => {
    const { localizeAudioPaths } = await import('./localize-audio.mjs');
    const revision = localRevision;
    const data = readJson(DATA_PATH);
    const result = await syncEngine.resolve(conflictPath, choice, etag, data);
    if (result.changed || revision !== localRevision) return { success: false, changed: true };
    // Locate the original local key (report keys may contain Firebase-forbidden dots).
    const keys = result.path.split('/');
    let node = data;
    for (const key of keys.slice(0, -1)) {
        const localKey = Object.keys(node).find(candidate => Object.keys(sanitizeKeys({ [candidate]: true }))[0] === key) || key;
        if (!Object.hasOwn(node, localKey)) Object.defineProperty(node, localKey, { value: {}, writable: true, enumerable: true, configurable: true });
        node = node[localKey];
    }
    const key = Object.keys(node).find(candidate => Object.keys(sanitizeKeys({ [candidate]: true }))[0] === keys.at(-1)) || keys.at(-1);
    if (result.value === null) delete node[key];
    else Object.defineProperty(node, key, { value: localizeAudioPaths(result.value, node[key]), writable: true, enumerable: true, configurable: true });
    writeLocalData(data);
    localRevision++;
    stagedPull = null;
    syncQueue.enqueue(data);
    syncEngine.finishResolution(conflictPath);
    if (!syncEngine.conflicts().length) setImmediate(() => { void syncQueue.flush(); });
    return { success: true };
}));

ipcMain.handle('save-zoom', async (event, zoomFactor) => {
    try {
        let settings = {};
        if (fs.existsSync(SETTINGS_PATH)) {
            try {
                settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            } catch (e) {
                console.error('Failed to parse settings.json:', e);
            }
        }
        settings.appZoomLevel = zoomFactor;
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (error) {
        console.error('Failed to save zoom:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-zoom', async () => {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const settings = JSON.parse(data);
            if (settings && typeof settings.appZoomLevel === 'number') {
                return settings.appZoomLevel;
            }
        }
    } catch (error) {
        console.error('Failed to load zoom:', error);
    }
    return null;
});

function writeLocalData(data) {
    writeJsonAtomic(DATA_PATH, data);
    if (Object.hasOwn(data, 'tajweedBank')) writeJsonAtomic(TAJWEED_BANK_PATH, data.tajweedBank || {});
    if (Object.hasOwn(data, 'tajweedSubmissions')) writeJsonAtomic(TAJWEED_SUBMISSIONS_PATH, data.tajweedSubmissions || {});
}
ipcMain.handle('save-data', async (_event, data, skipSync, token) => {
    try {
        if (skipSync) {
            if (!stagedPull || stagedPull.token !== token || stagedPull.revision !== localRevision || syncQueue.status().hasPending) {
                return { success: false, busy: true, error: 'Local data changed while receiving cloud data' };
            }
            // Commit local data before the baseline; a crash can at worst cause a
            // redundant conditional upload, never acknowledge data not saved locally.
            writeLocalData(data);
            syncEngine.commit(stagedPull.baseline);
            stagedPull = null;
        } else {
            writeLocalData(data);
            localRevision++;
            stagedPull = null;
            if (syncQueue.status().hasPending || Object.keys(syncEngine.patchFor(data)).length || syncEngine.hasNotification()) queueFirebaseSync(data);
        }
        return { success: true };
    } catch (error) {
        console.error('Failed to save data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        let parsedData = null;

        if (fs.existsSync(DATA_PATH)) {
            const data = fs.readFileSync(DATA_PATH, 'utf8');
            parsedData = JSON.parse(data);
        }

        if (fs.existsSync(TAJWEED_BANK_PATH)) {
            try {
                const bankRaw = fs.readFileSync(TAJWEED_BANK_PATH, 'utf8');
                const parsedBank = JSON.parse(bankRaw);

                if (parsedBank && typeof parsedBank === 'object' && !Array.isArray(parsedBank)) {
                    parsedData = parsedData && typeof parsedData === 'object' ? parsedData : {};
                    parsedData.tajweedBank = parsedBank;
                }
            } catch (bankError) {
                console.error('Failed to load Tajweed bank backup file:', bankError);
            }
        }

        if (fs.existsSync(TAJWEED_SUBMISSIONS_PATH)) {
            try {
                const submissionsRaw = fs.readFileSync(TAJWEED_SUBMISSIONS_PATH, 'utf8');
                const parsedSubmissions = JSON.parse(submissionsRaw);

                if (parsedSubmissions && typeof parsedSubmissions === 'object' && !Array.isArray(parsedSubmissions)) {
                    parsedData = parsedData && typeof parsedData === 'object' ? parsedData : {};
                    parsedData.tajweedSubmissions = parsedSubmissions;
                }
            } catch (submissionError) {
                console.error('Failed to load Tajweed submissions backup file:', submissionError);
            }
        }

        return parsedData; // Can be null if no files exist
    } catch (error) {
        console.error('Failed to load data:', error);
        return null;
    }
});

ipcMain.handle('save-tajweed-audio', async (event, base64Data, fileName) => {
    try {
        if (typeof base64Data !== 'string' || !base64Data.trim()) {
            return { success: false, error: 'Invalid audio payload' };
        }

        const raw = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
        const safeBaseName = (typeof fileName === 'string' && fileName.trim() ? fileName.trim() : `tajweed_${Date.now()}.webm`)
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

        const hasExt = path.extname(safeBaseName).length > 0;
        const finalFileName = hasExt ? safeBaseName : `${safeBaseName}.webm`;

        if (!fs.existsSync(TAJWEED_AUDIO_DIR)) {
            fs.mkdirSync(TAJWEED_AUDIO_DIR, { recursive: true });
        }

        const localPath = path.join(TAJWEED_AUDIO_DIR, finalFileName);
        fs.writeFileSync(localPath, Buffer.from(raw, 'base64'));

        return { success: true, localPath };
    } catch (error) {
        console.error('Failed to save Tajweed audio:', error);
        return { success: false, error: error.message };
    }
});

// --- Export Monthly Report to PDF ---
ipcMain.handle('export-monthly-pdf', async (event, { htmlContent, defaultFileName }) => {
    let pdfWindow = null;
    try {
        const safeName = (defaultFileName || 'Monthly_Report.pdf').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
        const saveResult = await dialog.showSaveDialog(mainWindow, {
            title: 'حفظ التقرير الشهري PDF',
            defaultPath: path.join(app.getPath('downloads'), safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`),
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return { success: false, canceled: true };
        }

        pdfWindow = new BrowserWindow({
            width: 850,
            height: 1150,
            show: false,
            webPreferences: {
                offscreen: true,
                contextIsolation: true
            }
        });

        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
        // Give fonts and layout a brief moment to settle
        await waitForTimeout(450);

        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
                marginType: 'custom',
                top: 0.35,
                bottom: 0.35,
                left: 0.35,
                right: 0.35
            }
        });

        fs.writeFileSync(saveResult.filePath, pdfBuffer);
        shell.openPath(saveResult.filePath).catch(() => {});

        return { success: true, filePath: saveResult.filePath };
    } catch (error) {
        console.error('Failed to export PDF:', error);
        return { success: false, error: error.message };
    } finally {
        if (pdfWindow && !pdfWindow.isDestroyed()) {
            pdfWindow.close();
        }
    }
});

// --- Select Folder Dialog ---
ipcMain.handle('select-backup-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'اختر مجلد الحفظ التلقائي'
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

// --- Save Backup to Path (Silent, Rotating) ---
ipcMain.handle('save-backup-to-path', async (event, { folderPath, data, maxFiles }) => {
    try {
        if (!folderPath || !data) return { success: false, error: 'Missing folderPath or data' };

        const max = maxFiles || 10;

        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        // Generate filename with timestamp
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const filename = `quran_tracker_backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
        const filePath = path.join(folderPath, filename);

        // Write the backup file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        // Rotate: get all backup files, sort by modification time, delete oldest if exceeding max
        const allFiles = fs.readdirSync(folderPath)
            .filter(f => f.startsWith('quran_tracker_backup_') && f.endsWith('.json'))
            .map(f => ({
                name: f,
                path: path.join(folderPath, f),
                mtime: fs.statSync(path.join(folderPath, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime); // Newest first

        if (allFiles.length > max) {
            const toDelete = allFiles.slice(max);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
            }
        }

        return { success: true, filePath, totalFiles: Math.min(allFiles.length, max) };
    } catch (error) {
        console.error('Failed to save backup:', error);
        return { success: false, error: error.message };
    }
});

let allowQuit = false;
let quitInProgress = false;
// Try the pending upload before a normal application quit. A forced OS shutdown
// can bypass this event; the pending snapshot will still be retried next launch.
app.on('before-quit', async (event) => {
    if (!allowQuit && syncQueue.status().hasPending) {
        event.preventDefault();
        if (quitInProgress) return;
        quitInProgress = true;
        const status = await syncQueue.flush();
        if (status.hasPending) {
            const result = await dialog.showMessageBox({
                type: 'warning',
                buttons: ['العودة للتطبيق', 'إغلاق رغم عدم المزامنة'],
                defaultId: 0,
                cancelId: 0,
                title: 'المزامنة لم تكتمل',
                message: 'توجد تعديلات لم تُرفع بعد.',
                detail: 'ستظل محفوظة على هذا الجهاز وستُحاول المزامنة مرة أخرى عند فتح التطبيق. لن تظهر على الجهاز الآخر حتى تنجح المزامنة.',
            });
            if (result.response === 0) {
                quitInProgress = false;
                if (!mainWindow || mainWindow.isDestroyed()) createWindow();
                return;
            }
        }
        allowQuit = true;
        app.quit();
        return;
    }
    if (whatsappBrowser) {
        try { // Cleanup
            await whatsappBrowser.close();
        } catch (e) {
            console.error('Error closing WhatsApp browser:', e);
        }
    }
});
