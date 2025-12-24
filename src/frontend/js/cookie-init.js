silktideCookieBannerManager.updateCookieBannerConfig({
    background: {
        showBackground: true
    },
    cookieIcon: {
        position: "bottomLeft"
    },
    cookieTypes: [
        {
            id: "necessary",
            name: "Necessary",
            description: "<p>These cookies are necessary for the website to function properly and cannot be switched off. They help with things like logging in and setting your privacy preferences.</p>",
            required: true,
            onAccept: function () {
                console.log('Necessary cookies accepted');
            }
        },
        {
            id: "analytics",
            name: "Analytics",
            description: "<p>These cookies help us improve the site by tracking which pages are most popular and how visitors move around the site.</p>",
            required: true,
            onAccept: function () {
                console.log('Analytics accepted');
                // Initialize GA if available, using global function to handle basic event
            }
        },
        {
            id: "advertising",
            name: "Advertising",
            description: "<p>These cookies provide extra features and personalization to improve your experience. They may be set by us or by partners whose services we use.</p>",
            required: false,
            onAccept: function () {
                if (typeof gtag !== 'undefined') {
                    gtag('consent', 'update', {
                        ad_storage: 'granted',
                        ad_user_data: 'granted',
                        ad_personalization: 'granted',
                    });
                    dataLayer.push({
                        'event': 'consent_accepted_advertising',
                    });
                }
            },
            onReject: function () {
                if (typeof gtag !== 'undefined') {
                    gtag('consent', 'update', {
                        ad_storage: 'denied',
                        ad_user_data: 'denied',
                        ad_personalization: 'denied',
                    });
                }
            }
        }
    ],
    text: {
        banner: {
            description: "<p>We use cookies on our site to enhance your user experience, provide personalized content, and analyze our traffic. <a href=\"/datenschutz.html\" target=\"_blank\">Cookie Policy.</a></p>",
            acceptAllButtonText: "Accept all",
            acceptAllButtonAccessibleLabel: "Accept all cookies",
            rejectNonEssentialButtonText: "Reject non-essential",
            rejectNonEssentialButtonAccessibleLabel: "Reject non-essential",
            preferencesButtonText: "Preferences",
            preferencesButtonAccessibleLabel: "Toggle preferences"
        },
        preferences: {
            title: "Customize your cookie preferences",
            description: "<p>We respect your right to privacy. You can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>",
            creditLinkText: "Get this banner for free",
            creditLinkAccessibleLabel: "Get this banner for free"
        }
    },
    position: {
        banner: "bottomLeft"
    }
});
