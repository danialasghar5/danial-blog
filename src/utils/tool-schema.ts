// JSON-LD for tool pages (TOOLS_ROADMAP.md §14.2): WebApplication, plus
// FAQPage when the page shows FAQs. BreadcrumbList comes from <Breadcrumbs>.
// No aggregateRating, no HowTo.

export interface ToolSchemaInput {
	title: string;
	description: string;
	url: string;
	site: string;
	pubDate: Date;
	updatedDate?: Date;
	faq: { q: string; a: string }[];
}

export function toolJsonLd(t: ToolSchemaInput): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: t.title,
			description: t.description,
			url: t.url,
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Web',
			browserRequirements: 'Requires JavaScript',
			isAccessibleForFree: true,
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			author: { '@id': `${t.site}#person` },
			datePublished: t.pubDate.toISOString().slice(0, 10),
			dateModified: (t.updatedDate ?? t.pubDate).toISOString().slice(0, 10),
		},
	];
	if (t.faq.length > 0) {
		out.push({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
		});
	}
	return out;
}
