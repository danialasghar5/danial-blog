// Topic hubs — the editorial taxonomy for the blog. Single source of truth for
// the /topics/ system: hub pages, the topics index, homepage chips, footer
// links, and the per-post "Filed under" label.
//
// Rollout gate: a hub is only surfaced publicly (its page is generated, and it
// appears in nav/chips/footer/index) once `live: true`. Keep a hub defined but
// `live: false` until it has ~3 real posts, so we never ship thin/empty hubs.
//
// `slug` doubles as the frontmatter `category` value (see content.config.ts) and
// the URL segment: /topics/<slug>/. A post belongs to exactly one primary hub.

export interface Topic {
	/** URL segment and frontmatter `category` value. */
	slug: string;
	/** Display name — the "Filed under" anchor and hub H1. */
	title: string;
	/** One-line description for the topics index, footer, and chips. */
	blurb: string;
	/** Head term(s) the hub targets, for the hub's meta/keywords. */
	keywords: string[];
	/** Original editorial framing shown on the hub page, one string per paragraph.
	 *  May contain inline HTML (e.g. <em>) — rendered with set:html. */
	intro: string[];
	/** Cornerstone post id (blog slug) a newcomer should read first. */
	startHere?: string;
	/** Sibling hubs to cross-link (only the live ones render). */
	related: string[];
	/** When false the hub is defined but not surfaced anywhere (rollout gate). */
	live: boolean;
}

export const TOPICS: Topic[] = [
	{
		slug: 'background-jobs',
		title: 'Background Jobs & Async',
		blurb: 'Sidekiq, Solid Queue, and the reliability contract of at-least-once delivery.',
		keywords: [
			'rails background jobs',
			'sidekiq reliability',
			'at-least-once delivery',
			'idempotent sidekiq workers',
			'background job concurrency',
		],
		intro: [
			'Moving slow or unreliable work off the request path is one of the highest-leverage decisions in a backend — and the moment that work runs in a queue, the reliability contract quietly changes. A background job does not run exactly once. It runs <em>at least</em> once: a deploy, a timeout, a retry, or a lost acknowledgement can re-run a job you thought had finished. That is not a flaw to configure away; it is the guarantee you are building on.',
			'So the hard part was never enqueuing the work — it is what happens on the second run. Retries repeat side effects that already happened; two duplicate deliveries race the same record in parallel; a worker crashes mid-flight and strands the job. None of that is fixable at the queue layer, because the queue only knows about delivery, not about the charge, the email, or the row you actually care about. Correctness has to move down to the one component that can adjudicate a race under concurrency: the database.',
			'This hub collects the deep dives on that idea — at-least-once delivery and why jobs run twice, idempotent workers keyed on stable identifiers, atomic claims and unique constraints that make duplicates impossible to persist, fencing tokens, reapers, and the failure modes that only ever show up in production. The thread running through all of it: the queue provides delivery; the database enforces correctness.',
		],
		startHere: 'sidekiq-job-runs-twice-at-least-once-delivery',
		related: ['database-reliability', 'ai-backend'],
		live: true,
	},
	{
		slug: 'database-reliability',
		title: 'Database Reliability',
		blurb: 'Postgres locking, transactions, isolation, and races — where correctness is enforced.',
		keywords: [
			'rails database reliability',
			'postgres concurrency rails',
			'row locking',
			'transaction isolation',
			'atomic claim',
		],
		intro: [
			'The database is the one place in a Rails system that can settle a race correctly, which is exactly why so much reliability work ends up here. This hub covers Postgres locking, transactions and isolation levels, unique constraints, and the atomic state transitions that let exactly one worker win.',
		],
		startHere: undefined,
		related: ['background-jobs', 'ai-backend'],
		live: false,
	},
	{
		slug: 'ai-backend',
		title: 'AI Backend Engineering',
		blurb: 'LLMs in production Rails: structured outputs, cost, non-determinism, and reliability.',
		keywords: [
			'llm rails production',
			'openai structured outputs',
			'ai backend reliability',
			'llm cost control',
		],
		intro: [
			'Putting a large language model behind a production backend is mostly an exercise in treating an unreliable, metered, non-deterministic dependency with the same rigor as any other. This hub covers structured outputs, cost and backpressure, handling non-determinism, and the reliability patterns that keep an AI feature from leaking into your data.',
		],
		startHere: undefined,
		related: ['background-jobs', 'database-reliability'],
		live: false,
	},
];

const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

/** All valid category slugs — feeds the frontmatter enum in content.config.ts. */
export const TOPIC_SLUGS = TOPICS.map((t) => t.slug) as [string, ...string[]];

/** Look up a topic by slug (e.g. a post's `category`), or undefined. */
export const getTopic = (slug?: string): Topic | undefined =>
	slug ? BY_SLUG.get(slug) : undefined;

/** Only the hubs that have passed the rollout gate. */
export const liveTopics = (): Topic[] => TOPICS.filter((t) => t.live);

/** Canonical hub URL (trailing slash, matching site convention). */
export const topicUrl = (slug: string): string => `/topics/${slug}/`;
