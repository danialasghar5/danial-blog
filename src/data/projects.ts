// EDIT ME: swap `link` for real live/repo URLs and refine the `outcome` line.
export interface Project {
	title: string;
	description: string;
	outcome?: string;
	tech: string[];
	link?: string;
	repo?: string;
	featured?: boolean;
}

export const projects: Project[] = [
	{
		title: 'CovetPics',
		description: 'Shopify app surfacing user-generated & social photos on storefronts.',
		outcome: 'Serves shoppable galleries across storefronts with millions of monthly page views.',
		tech: ['Rails', 'Shopify API', 'Meta Graph'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
	{
		title: 'JumpStartPro',
		description: 'Production Rails SaaS starter — auth, billing, and teams out of the box.',
		outcome: 'Cut new-SaaS setup from weeks to hours with multi-tenant billing baked in.',
		tech: ['Rails', 'Stripe', 'Hotwire'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
	{
		title: 'Interstride',
		description: 'Platform helping international students navigate US careers.',
		outcome: 'Scaled background integrations connecting university career services to job data.',
		tech: ['Rails', 'PostgreSQL', 'AWS'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
];
