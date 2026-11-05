/**
 * Ad Detection, Form Injection & Lead Tracking
 * 
 * Rules:
 * 1. Checks if visitor arrived via paid ad (click IDs, paid utm_medium, or src=ad). Case-insensitive.
 * 2. Persists 'isAdVisitor="true"' and tracking parameters in sessionStorage (wrapped in try/catch).
 * 3. Shows the form by cloning <template id="lead-form-template"> into <div id="form-container"></div>.
 *    For non-ad visitors, completely removes the template and [data-ad-only] elements from DOM.
 * 4. Fills hidden tracking inputs (utm_source, utm_medium, utm_campaign, click_id, ad_visitor).
 * 5. Runs seamlessly on DOMContentLoaded or immediately if DOM is already loaded.
 */

(function () {
    'use strict';

    // List of recognized click ID parameters (checked case-insensitively)
    var CLICK_ID_PARAMS = [
        'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
        'ttclid', 'li_fat_id', 'twclid', 'epik', 'sclid'
    ];

    // List of recognized paid utm_medium values (checked case-insensitively)
    var PAID_MEDIUMS = [
        'cpc', 'ppc', 'paid', 'paidsocial', 'paid_social',
        'display', 'cpm', 'cpv', 'ads', 'ad'
    ];

    // Storage keys for persistence in sessionStorage
    var STORAGE_KEYS = {
        IS_AD_VISITOR: 'isAdVisitor',
        UTM_SOURCE: 'utm_source',
        UTM_MEDIUM: 'utm_medium',
        UTM_CAMPAIGN: 'utm_campaign',
        CLICK_ID: 'click_id'
    };

    /**
     * Safely read a value from sessionStorage.
     * Wrapped in try/catch to handle privacy modes or in-app browsers (FB/IG) that block storage.
     */
    function safeSessionGet(key) {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                return window.sessionStorage.getItem(key);
            }
        } catch (e) {
            console.warn('Unable to access sessionStorage (get):', e);
        }
        return null;
    }

    /**
     * Safely write a key-value pair to sessionStorage.
     * Wrapped in try/catch to prevent errors in restricted browser environments.
     */
    function safeSessionSet(key, value) {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn('Unable to access sessionStorage (set):', e);
        }
    }

    /**
     * Parse URL query parameters into a lowercase key-value map for case-insensitive lookup.
     */
    function getUrlParams() {
        var params = {};
        try {
            var search = window.location.search;
            if (search) {
                var searchParams = new URLSearchParams(search);
                searchParams.forEach(function (value, key) {
                    var lowerKey = key.trim().toLowerCase();
                    if (!(lowerKey in params)) {
                        params[lowerKey] = value.trim();
                    }
                });
            }
        } catch (e) {
            console.warn('Unable to parse URL parameters:', e);
        }
        return params;
    }

    /**
     * Detects if the current URL parameters indicate a paid ad visit.
     * Checks click IDs, paid utm_medium, and src=ad (case-insensitive).
     * @param {Object} [params] - Optional parsed URL params
     * @returns {boolean}
     */
    function detectAdVisit(params) {
        params = params || getUrlParams();

        // 1. Check if any recognized click ID parameter exists in URL
        for (var i = 0; i < CLICK_ID_PARAMS.length; i++) {
            var cid = CLICK_ID_PARAMS[i];
            if (cid in params) {
                return true;
            }
        }

        // 2. Check if utm_medium matches any recognized paid medium
        var medium = (params['utm_medium'] || '').toLowerCase();
        if (medium && PAID_MEDIUMS.indexOf(medium) !== -1) {
            return true;
        }

        // 3. Check custom parameter src=ad
        var src = (params['src'] || '').toLowerCase();
        if (src === 'ad') {
            return true;
        }

        return false;
    }

    /**
     * Determines whether the current visitor is an ad visitor.
     * Checks existing session flag first; if not present, runs detectAdVisit on current URL.
     * @returns {boolean}
     */
    function isAdVisitor() {
        // Check if already persisted as an ad visitor in this session
        if (safeSessionGet(STORAGE_KEYS.IS_AD_VISITOR) === 'true') {
            return true;
        }

        // Check if current URL parameters indicate an ad visit
        var params = getUrlParams();
        if (detectAdVisit(params)) {
            safeSessionSet(STORAGE_KEYS.IS_AD_VISITOR, 'true');
            return true;
        }

        return false;
    }

    /**
     * Extracts tracking parameters from URL and saves them in sessionStorage.
     */
    function persistTrackingData() {
        var params = getUrlParams();

        // Only persist if current visit is detected as an ad
        if (detectAdVisit(params)) {
            safeSessionSet(STORAGE_KEYS.IS_AD_VISITOR, 'true');

            if (params['utm_source']) {
                safeSessionSet(STORAGE_KEYS.UTM_SOURCE, params['utm_source']);
            }
            if (params['utm_medium']) {
                safeSessionSet(STORAGE_KEYS.UTM_MEDIUM, params['utm_medium']);
            }
            if (params['utm_campaign']) {
                safeSessionSet(STORAGE_KEYS.UTM_CAMPAIGN, params['utm_campaign']);
            }

            // Detect and persist the specific click ID value passed
            for (var i = 0; i < CLICK_ID_PARAMS.length; i++) {
                var cid = CLICK_ID_PARAMS[i];
                if (cid in params && params[cid]) {
                    safeSessionSet(STORAGE_KEYS.CLICK_ID, params[cid]);
                    break;
                }
            }
        }
    }

    /**
     * Automatically sets or creates hidden tracking fields inside the form element.
     * Hidden fields: utm_source, utm_medium, utm_campaign, click_id, ad_visitor
     * @param {HTMLFormElement} form
     */
    function populateHiddenTrackingFields(form) {
        if (!form) return;

        var params = getUrlParams();

        // Read from sessionStorage with fallback to current URL parameters
        var clickIdVal = safeSessionGet(STORAGE_KEYS.CLICK_ID) || '';
        if (!clickIdVal) {
            for (var i = 0; i < CLICK_ID_PARAMS.length; i++) {
                var cid = CLICK_ID_PARAMS[i];
                if (cid in params && params[cid]) {
                    clickIdVal = params[cid];
                    break;
                }
            }
        }

        var trackingValues = {
            utm_source: safeSessionGet(STORAGE_KEYS.UTM_SOURCE) || params['utm_source'] || '',
            utm_medium: safeSessionGet(STORAGE_KEYS.UTM_MEDIUM) || params['utm_medium'] || '',
            utm_campaign: safeSessionGet(STORAGE_KEYS.UTM_CAMPAIGN) || params['utm_campaign'] || '',
            click_id: clickIdVal,
            ad_visitor: 'true'
        };

        // Populate existing inputs or create if not yet present
        Object.keys(trackingValues).forEach(function (name) {
            var input = form.querySelector('input[name="' + name + '"]');
            if (!input) {
                input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.id = 'order_' + name;
                form.appendChild(input);
            }
            input.value = trackingValues[name];
        });
    }

    /**
     * Renders or strips the form and ad-only buttons based on visitor status.
     */
    function renderAdContent() {
        var adVisitor = isAdVisitor();
        var template = document.getElementById('lead-form-template');
        var container = document.getElementById('form-container');
        var adOnlyElements = document.querySelectorAll('[data-ad-only]');

        if (adVisitor) {
            // Ad visitor: Reveal ad-only elements (buttons/links)
            adOnlyElements.forEach(function (el) {
                el.removeAttribute('data-ad-only');
            });

            // Ad visitor: Clone the form template into container if not already inserted
            if (template && container && !container.querySelector('form')) {
                var clone = template.content.cloneNode(true);
                container.appendChild(clone);

                var clonedForm = container.querySelector('form');
                if (clonedForm) {
                    populateHiddenTrackingFields(clonedForm);
                }

                // Dispatch event so other scripts (like app.js) can initialize form handlers
                document.dispatchEvent(new CustomEvent('leadFormRendered', {
                    detail: { form: clonedForm }
                }));
            } else if (container) {
                var existingForm = container.querySelector('form');
                if (existingForm) {
                    populateHiddenTrackingFields(existingForm);
                }
            }
        } else {
            // Non-ad visitor: Completely remove template and ad-only elements from DOM
            if (template) {
                template.remove();
            }
            adOnlyElements.forEach(function (el) {
                el.remove();
            });
            if (container) {
                container.innerHTML = '';
            }
        }
    }

    /**
     * Main initialization function
     */
    function init() {
        persistTrackingData();
        renderAdContent();
    }

    // Run when DOM is ready or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose functions globally for testability and debugging
    window.detectAdVisit = detectAdVisit;
    window.isAdVisitor = isAdVisitor;
    window.populateHiddenTrackingFields = populateHiddenTrackingFields;
    window.renderAdContent = renderAdContent;
})();
