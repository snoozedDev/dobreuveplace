// ==UserScript==
// @name         dobreuveplace
// @namespace    https://github.com/snoozedDev
// @version      0.0.2
// @description  helper panel & button
// @author       snoozedDev
// @license      MPL-2.0
// @supportURL   https://discord.gg/tpeBPy46hf
// @homepageURL  https://github.com/snoozedDev/dobreuveplace
// @run-at       document-start
// @match        *://*.wplace.live/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @updateURL    https://raw.githubusercontent.com/snoozedDev/dobreuveplace/main/dobleuveplace.user.js
// @downloadURL  https://raw.githubusercontent.com/snoozedDev/dobreuveplace/main/dobleuveplace.user.js
// ==/UserScript==

let lastMe = {
    data: {
        charges: {
            cooldownMs: 0,
            count: 0,
            max: 0
        },
        droplets: 0,
    },
    refreshTime: 0
}

const UPGRADE_COST = 500;
const UPGRADE_AMOUNT = 5;

// Request interceptor - monitor network requests for URLs containing "thing"
(function() {
    'use strict';
    
    const MONITOR_KEYWORD = 'thing';
    
    // Helper functions
    const shouldMonitorUrl = (url) => {
        const urlString = typeof url === 'string' ? url : url.url || url.toString();
        return urlString.toLowerCase().includes(MONITOR_KEYWORD);
    };
    
    const tryParseJSON = (text) => {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    };
    
    const logRequest = (type, urlString, options = null) => {
        console.log(`🔍 [REQUEST INTERCEPTED] ${type} request with "${MONITOR_KEYWORD}" detected:`);
        console.log('   URL:', urlString);
        if (options) {
            if (options.method) {
                console.log('   Method:', options.method);
            } else {
                console.log('   Options:', options);
            }
        }
        console.log('   Timestamp:', new Date().toISOString());
    };
    
    const logResponse = (type, status, statusText, contentType, jsonData) => {
        console.log(`📥 [RESPONSE INTERCEPTED] ${type} JSON response for "${MONITOR_KEYWORD}" request:`);
        console.log('   Status:', status, statusText);
        console.log('   Content-Type:', contentType);
        console.log('   Response Data:', jsonData);
        console.log('   Timestamp:', new Date().toISOString());
    };
    
    const logError = (type, error) => {
        console.log(`⚠️ [${type} ERROR] Failed to parse response for "${MONITOR_KEYWORD}" request:`, error);
    };
    
    const handleJsonResponse = (type, status, statusText, contentType, responseText) => {
        try {
            if (contentType && contentType.includes('application/json')) {
                const jsonData = tryParseJSON(responseText);
                if (jsonData !== null) {
                    logResponse(type, status, statusText, contentType, jsonData);
                }
            }
        } catch (error) {
            logError('RESPONSE', error);
        }
    };
    
    // Intercept fetch API
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        const urlString = typeof url === 'string' ? url : url.url || url.toString();
        const shouldLog = shouldMonitorUrl(url);
        
        if (shouldLog) {
            logRequest('fetch', urlString, args[1] || 'none');
        }
        
        const fetchPromise = originalFetch.apply(this, args);
        
        if (shouldLog) {
            return fetchPromise.then(async (response) => {
                const responseClone = response.clone();
                
                try {
                    const contentType = response.headers.get('content-type');
                    const responseText = await responseClone.text();
                    handleJsonResponse('fetch', response.status, response.statusText, contentType, responseText);
                } catch (error) {
                    logError('RESPONSE', error);
                }
                
                return response;
            }).catch((error) => {
                console.log(`❌ [FETCH ERROR] Request with "${MONITOR_KEYWORD}" failed:`, error);
                throw error;
            });
        }
        
        return fetchPromise;
    };
    
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        const urlString = url.toString();
        const shouldLog = shouldMonitorUrl(url);
        
        if (shouldLog) {
            logRequest('XMLHttpRequest', urlString, { method });
            
            this.addEventListener('load', () => {
                const contentType = this.getResponseHeader('content-type');
                handleJsonResponse('XMLHttpRequest', this.status, this.statusText, contentType, this.responseText);
            });
        }
        
        return originalXHROpen.call(this, method, url, ...args);
    };
    
    console.log(`🚀 Request interceptor initialized - monitoring for URLs containing "${MONITOR_KEYWORD}" (requests + JSON responses)`);
})();

const getAmountOfChargesToBuy = () => {
    const { data: { droplets } } = lastMe;
    const amount = Math.floor(droplets / UPGRADE_COST);
    return amount;
}

const refreshMe = async () => {
    const response = await fetch('https://backend.wplace.live/me', { credentials: 'include' });
    const data = await response.json();
    console.log('API Response:', data); // Debug log
    lastMe.data = data;
    lastMe.refreshTime = Date.now();
}

const buyUpgrade = async (amount) => {
    const response = await fetch("https://backend.wplace.live/purchase", {
        method: "POST",
        body: JSON.stringify({ product: { id: 70, amount } }),
        credentials: "include"
    });

    if (response.ok) {
        await refreshMe();
        return true;
    }

    return false;
}


const formatTime = (s) => {
    // Handle negative numbers or invalid input
    if (s <= 0 || !isFinite(s)) {
        return null; // Return null to indicate "full"
    }
    
    const hours = Math.floor(s / 3600);
    s = s % 3600;
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    
    // Format without leading zeros for hours, but keep them for minutes/seconds
    let timeStr = '';
    if (hours > 0) {
        timeStr += hours + ':';
        timeStr += ("0" + minutes).slice(-2) + ':';
    } else {
        timeStr += minutes + ':';
    }
    timeStr += ("0" + seconds).slice(-2);
    
    return timeStr;
}


const getMSUntilFull = () => {
    const { data: { charges: { cooldownMs, count, max } } } = lastMe;
    const msSinceRefresh = Date.now() - lastMe.refreshTime;
    const msUntilFull = ((max - count) * cooldownMs) - msSinceRefresh;
    
    return Math.round(msUntilFull);
}


const shouldRefresh = () => {
    // Refresh every 30 seconds, or when we think we should be full
    const timeSinceLastRefresh = Date.now() - lastMe.refreshTime;
    const REFRESH_INTERVAL = 30000; // 30 seconds
    
    if (timeSinceLastRefresh > REFRESH_INTERVAL) {
        return true;
    }
    
    const msUntilFull = getMSUntilFull();
    const lastMeFull = lastMe.data.charges.count >= lastMe.data.charges.max;
    if (msUntilFull <= 0 && !lastMeFull) {
        return true;
    }
    return false;
}

const UI_REFRESH_INTERVAL = 500;
let lastUIRefresh = 0;

const shouldRefreshUI = () => {
    const now = Date.now();
    if (now - lastUIRefresh > UI_REFRESH_INTERVAL) {
        lastUIRefresh = now;
        return true;
    }
    return false;
}

const refreshUI = () => {
    const infoPanel = document.getElementById('infoPanel');
    const infoElement = document.getElementById('infoPanelText');
    const upgradeButton = document.getElementById('shortcutButton');
    if (!infoPanel) return;

    infoPanel.style.display = 'block';
    
    const infoTexts = []

    const secondsUntilFull = getMSUntilFull() / 1000;
    const formattedTime = formatTime(secondsUntilFull);
    
    if (formattedTime === null) {
        infoTexts.push('Currently full!');
    } else {
        infoTexts.push(`${formattedTime} until full`);
    }

    // Calculate how many +5 max charge upgrades can be bought
    const upgradesAvailable = getAmountOfChargesToBuy();
    const { data: { charges: { count, max } } } = lastMe;
    const isAtMaxCharges = count >= max;
    
    // Always show upgrade info and button when at max charges, or when upgrades are available
    if (upgradesAvailable > 0) {
        infoTexts.push(`Can buy +${upgradesAvailable * UPGRADE_AMOUNT} max charge upgrades (${upgradesAvailable * UPGRADE_COST} droplets)`);
        
        // Show and update the button
        if (upgradeButton) {
            upgradeButton.style.display = 'block';
            upgradeButton.textContent = `Buy max charges`;
            upgradeButton.disabled = false;
            upgradeButton.style.opacity = '1';
            upgradeButton.style.cursor = 'pointer';
        }
    } else if (isAtMaxCharges) {
        // Show upgrade info even when can't afford it, but user is at max charges
        const dropletsNeeded = UPGRADE_COST - (lastMe.data.droplets % UPGRADE_COST);
        if (lastMe.data.droplets < UPGRADE_COST) {
            infoTexts.push(`+${UPGRADE_AMOUNT} max charge upgrade costs ${UPGRADE_COST} droplets (need ${dropletsNeeded} more)`);
        } else {
            infoTexts.push(`+${UPGRADE_AMOUNT} max charge upgrade costs ${UPGRADE_COST} droplets`);
        }
        
        // Show disabled button when at max but can't afford upgrades
        if (upgradeButton) {
            upgradeButton.style.display = 'block';
            upgradeButton.textContent = `Buy max charges`;
            upgradeButton.disabled = true;
            upgradeButton.style.opacity = '0.6';
            upgradeButton.style.cursor = 'not-allowed';
        }
    } else {
        // Hide the button if not at max and no upgrades available
        if (upgradeButton) {
            upgradeButton.style.display = 'none';
        }
    }

    infoElement.innerHTML = infoTexts.join('<br>');
}



const insertInfoPanel = () => {
    const existingInfoPanel = document.getElementById('infoPanel');
    if (existingInfoPanel !== null) {
        existingInfoPanel.remove();
    }

    const infoPanel = document.createElement('div');
    infoPanel.id = 'infoPanel';
    infoPanel.style.display = 'none';
    infoPanel.style.position = 'fixed';
    infoPanel.style.top = '8px';
    infoPanel.style.left = '48px';
    infoPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    infoPanel.style.zIndex = '1000';
    infoPanel.style.color = 'white';
    infoPanel.style.padding = '10px';
    infoPanel.style.border = '2px solid white';
    infoPanel.style.fontSize = '12px';
    infoPanel.style.fontWeight = 'bold';


    const infoPanelText = document.createElement('p');
    infoPanelText.id = 'infoPanelText';
    infoPanelText.textContent = '[Info Panel]';
    infoPanel.appendChild(infoPanelText);

    const shortcutButton = document.createElement('button');
    shortcutButton.id = 'shortcutButton';
    shortcutButton.textContent = 'Buy Charges';
    shortcutButton.style.display = 'none';
    
    // Style the button
    shortcutButton.style.backgroundColor = 'white';
    shortcutButton.style.color = 'black';
    shortcutButton.style.border = '2px solid black';
    shortcutButton.style.borderRadius = '6px';
    shortcutButton.style.padding = '8px 16px';
    shortcutButton.style.fontSize = '12px';
    shortcutButton.style.fontWeight = 'bold';
    shortcutButton.style.cursor = 'pointer';
    shortcutButton.style.marginTop = '8px';
    shortcutButton.style.boxSizing = 'border-box';
    shortcutButton.style.transition = 'all 0.2s ease';
    
    // Add hover and active effects
    shortcutButton.addEventListener('mouseenter', () => {
        if (shortcutButton.disabled) return;
        shortcutButton.style.backgroundColor = 'black';
        shortcutButton.style.color = 'white';
        shortcutButton.style.transform = 'translateY(-1px)';
        shortcutButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    shortcutButton.addEventListener('mouseleave', () => {
        if (shortcutButton.disabled) return;
        shortcutButton.style.backgroundColor = 'white';
        shortcutButton.style.color = 'black';
        shortcutButton.style.transform = 'translateY(0)';
        shortcutButton.style.boxShadow = 'none';
    });
    
    shortcutButton.addEventListener('mousedown', () => {
        if (shortcutButton.disabled) return;
        shortcutButton.style.transform = 'translateY(1px)';
    });
    
    shortcutButton.addEventListener('mouseup', () => {
        if (shortcutButton.disabled) return;
        shortcutButton.style.transform = 'translateY(-1px)';
    });
    
    shortcutButton.addEventListener('click', () => {
        // Don't process clicks if button is disabled
        if (shortcutButton.disabled) return;
        
        const amount = getAmountOfChargesToBuy();
        if (amount > 0) buyUpgrade(amount);
    });
    infoPanel.appendChild(shortcutButton);


    document.body.appendChild(infoPanel);
}



(async () => {
    insertInfoPanel();
    
    // Get initial data immediately
    try {
        await refreshMe();
    } catch (error) {
        console.error('Failed to get initial data:', error);
    }
    
    while (true) {
        if (shouldRefresh()) await refreshMe()
        if (shouldRefreshUI()) refreshUI();
        await new Promise(resolve => setTimeout(resolve, UI_REFRESH_INTERVAL));
    }
}
)();
