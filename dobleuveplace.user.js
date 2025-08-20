// ==UserScript==
// @name         dobreuveplace
// @namespace    https://github.com/snoozedDev
// @version      2025-08-20
// @description  helper panel & button
// @author       snoozedDev
// @license      MPL-2.0
// @supportURL   https://discord.gg/tpeBPy46hf
// @homepageURL  https://github.com/snoozedDev/dobreuveplace
// @match        https://wplace.live/*
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
    if (msUntilFull <= 0) {
        return true;
    }
    return false;
}

const UI_REFRESH_INTERVAL = 1000;
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
    
    if (upgradesAvailable > 0) {
        infoTexts.push(`Can buy +${upgradesAvailable * UPGRADE_AMOUNT} max charge upgrades, (${upgradesAvailable * UPGRADE_COST} droplets)`);
        
        // Show and update the button
        if (upgradeButton) {
            upgradeButton.style.display = 'block';
            upgradeButton.textContent = `Buy max charges`;
        }
    } else {
        // Hide the button if no upgrades available
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
        shortcutButton.style.backgroundColor = 'black';
        shortcutButton.style.color = 'white';
        shortcutButton.style.transform = 'translateY(-1px)';
        shortcutButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    shortcutButton.addEventListener('mouseleave', () => {
        shortcutButton.style.backgroundColor = 'white';
        shortcutButton.style.color = 'black';
        shortcutButton.style.transform = 'translateY(0)';
        shortcutButton.style.boxShadow = 'none';
    });
    
    shortcutButton.addEventListener('mousedown', () => {
        shortcutButton.style.transform = 'translateY(1px)';
    });
    
    shortcutButton.addEventListener('mouseup', () => {
        shortcutButton.style.transform = 'translateY(-1px)';
    });
    
    shortcutButton.addEventListener('click', () => {
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
        if (shouldRefresh()) {
            try {
                await refreshMe();
            } catch (error) {
                console.error('Failed to refresh data:', error);
            }
        }
        if (shouldRefreshUI()) refreshUI();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
)();
