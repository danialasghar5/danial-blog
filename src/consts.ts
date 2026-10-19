// Global site metadata — single source of truth for brand + contact.

export const SITE_TITLE = 'Danial Asghar';
export const SITE_DESCRIPTION =
	'Senior backend engineer building reliable Rails systems, high-volume APIs, async workflows, and AI-powered products.';

// Personal brand + contact
export const NAME = 'Danial Asghar';
export const ROLE = 'Senior Backend Engineer';
export const EMAIL = 'hello@danialasghar.com';

export const SOCIALS = {
	github: 'https://github.com/danialasghar5',
	githubUser: 'danialasghar5',
	twitter: 'https://x.com/Danialasghar2',
	twitterHandle: '@Danialasghar2',
};

// Résumé download. Empty string = no résumé available yet → the About button is
// hidden (prevents a broken /resume.pdf link). Set to '/resume.pdf' once the file
// is added to public/, or to an external URL.
export const RESUME_URL = '';

// Consulting booking link: a scheduler URL (Cal.com etc.) or a mailto:. Empty
// string → the /services CTAs fall back to EMAIL instead of shipping a dead link.
export const BOOKING_URL = 'mailto:hello@danialasghar.com?subject=Consulting%20Inquiry%20-%20danialasghar.com';
