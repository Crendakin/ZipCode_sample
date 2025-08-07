// Modern replacement using native fetch (Node.js 18+) instead of deprecated 'request'
// Removed underscore dependency - using native JavaScript methods instead

const ISRAEL_POST_URL = 'http://www.israelpost.co.il/zip_data1.nsf/SearchZip?OpenAgent&';

// Simple cache to avoid repeated requests for the same address
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function objToParams(obj) {
    return Object.keys(obj)
        .filter(key => obj[key] && obj[key].toString().trim() !== '') // More efficient than underscore isEmpty
        .map(key => `${key}=${encodeURIComponent(obj[key])}`)
        .join('&');
}

// Create AbortController for timeout handling
function createTimeoutController(timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    // Clear timeout when request completes
    controller.signal.addEventListener('abort', () => clearTimeout(timeout));
    
    return { controller, timeout };
}

// Enhanced user agents for better success rate
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Detect if response is a captcha/protection page
function isCaptchaProtected(body) {
    const captchaIndicators = [
        'radware captcha',
        'captcha page',
        'shieldsquare',
        'perfdrive.com',
        'protection service',
        'access denied',
        'blocked'
    ];
    
    const lowerBody = body.toLowerCase();
    return captchaIndicators.some(indicator => lowerBody.includes(indicator));
}

// Fallback zipcode validation (basic Israeli postal code format)
function isValidIsraeliZipcode(zipcode) {
    // Israeli postal codes are 7 digits, typically starting with 1-9
    return /^[1-9]\d{6}$/.test(zipcode);
}

async function getZipCode(address, callback) {
    // Input validation
    if (!address || typeof address !== 'object') {
        return callback('Invalid address object provided');
    }

    // Create cache key
    const cacheKey = JSON.stringify({
        city: address.city,
        street: address.street,
        houseNumber: address.houseNumber,
        entrance: address.entrance
    });

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return callback(undefined, cached.zipcode);
    }

    const uri = ISRAEL_POST_URL + objToParams({
        Location: address.city,
        Street: address.street,
        House: address.houseNumber,
        Entrance: address.entrance
    });

    const { controller, timeout } = createTimeoutController(15000); // Increased timeout for protected requests

    try {
        const response = await fetch(uri, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'he-IL,he;q=0.8,en-US;q=0.5,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'DNT': '1'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return callback(`HTTP error: ${response.status} ${response.statusText}`);
        }

        const body = await response.text();
        
        // Check if we hit captcha protection
        if (isCaptchaProtected(body)) {
            return callback('Israeli Post service is currently protected by anti-bot measures. Please try again later or use manual lookup at israelpost.co.il');
        }
        
        // Parse response - Israeli Post returns RES followed by 8 digits
        // The format is RES8 + 7-digit zipcode (based on original code logic)
        const resMatch = body.match(/RES8(\d{7})/);
        
        if (resMatch && resMatch[1]) {
            const zipcode = resMatch[1];
            
            // Validate the zipcode format
            if (!isValidIsraeliZipcode(zipcode)) {
                return callback('Invalid zipcode format received from Israeli Post');
            }
            
            // Cache successful result
            cache.set(cacheKey, {
                zipcode,
                timestamp: Date.now()
            });
            
            // Clean old cache entries periodically
            if (cache.size > 100) {
                const now = Date.now();
                for (const [key, value] of cache.entries()) {
                    if (now - value.timestamp > CACHE_TTL) {
                        cache.delete(key);
                    }
                }
            }
            
            callback(undefined, zipcode);
        } else {
            // Check for other RES response codes that indicate errors
            const generalResMatch = body.match(/RES(\d+)/);
            if (generalResMatch) {
                const resCode = generalResMatch[1];
                if (resCode.startsWith('0') || resCode.startsWith('1') || resCode.startsWith('2')) {
                    callback('Address not found in Israeli Post database');
                } else if (!resCode.startsWith('8')) {
                    callback(`Israeli Post returned error code: ${resCode}`);
                } else {
                    callback('Unexpected zipcode format from Israeli Post service');
                }
            } else {
                // Provide helpful guidance when service is unavailable
                callback('Israeli Post service is currently unavailable. You can manually lookup zipcodes at israelpost.co.il or try again later.');
            }
        }
    } catch (error) {
        clearTimeout(timeout);
        
        if (error.name === 'AbortError') {
            callback('Request timeout - Israeli Post service might be slow or protected. Please try again later.');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            callback('Network error - unable to reach Israeli Post service. Please check your internet connection.');
        } else {
            callback(`Error calling Israeli Post: ${error.message}. The service might be temporarily unavailable.`);
        }
    }
}

module.exports = getZipCode;


