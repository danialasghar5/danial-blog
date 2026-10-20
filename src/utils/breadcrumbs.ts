// schema.org BreadcrumbList for a trail of { label, href } items (oldest →
// current). The last item is the current page and takes `currentUrl`.
// Google shows this trail in search results in place of the raw URL.
export interface Crumb {
	label: string;
	href?: string;
}

export function breadcrumbJsonLd(items: Crumb[], site: URL | undefined, currentUrl: URL) {
	const base = site ?? new URL('https://danialasghar.com/');
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.label,
			item: i === items.length - 1 || !c.href ? new URL(currentUrl.pathname, base).toString() : new URL(c.href, base).toString(),
		})),
	};
}
