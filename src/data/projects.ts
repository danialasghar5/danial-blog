// Project content. `description` = one-line problem statement; `outcome` = the
// engineering angle. Featured projects appear on the homepage; supporting
// projects appear only on the /projects listing.
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
		title: 'AI Support Ticket Triage Engine',
		description:
			'An AI-powered Rails backend that automates customer support ticket classification, prioritization, and response drafting using asynchronous processing and structured LLM outputs.',
		outcome:
			'Designing a reliable AI pipeline where LLM failures, retries, and non-deterministic responses are handled safely.',
		tech: ['Ruby on Rails', 'PostgreSQL', 'Sidekiq', 'Redis', 'OpenAI API', 'Structured Outputs'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
	{
		title: 'Interstride',
		description:
			'A platform connecting international students to US careers, syncing university career services with live job and visa data.',
		outcome:
			'Scaled background integrations that keep high-volume job and career data in sync across services.',
		tech: ['Ruby on Rails', 'PostgreSQL', 'Sidekiq', 'AWS'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
	{
		title: 'AI Lead Engine',
		description:
			'Real-time AI lead qualification platform built with Rails 8, background processing, and streaming updates using Hotwire.',
		outcome:
			'Building a real-time AI workflow where leads are processed asynchronously and results are streamed instantly to users.',
		tech: ['Ruby on Rails', 'Rails 8', 'Solid Queue', 'Hotwire', 'Turbo Streams', 'ActionCable', 'OpenRouter'],
		link: 'https://github.com/danialasghar5',
		featured: true,
	},
	{
		title: 'CovetPics — Shopify UGC Platform',
		description:
			'Production Shopify application that helps merchants collect, manage, and showcase user-generated content with product integrations.',
		outcome:
			'Building Shopify integrations that operate reliably around external APIs, merchant workflows, and platform constraints.',
		tech: ['Ruby on Rails', 'Shopify', 'Graph API', 'Webhooks', 'SaaS', 'E-commerce'],
		link: 'https://github.com/danialasghar5',
		featured: false,
	},
];
