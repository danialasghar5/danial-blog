// Estimate reading time from raw markdown body (~200 wpm).
export function readingTime(body: string | undefined): string {
	if (!body) return '1 min read';
	const words = body
		.replace(/```[\s\S]*?```/g, ' ') // drop code blocks from the count
		.replace(/<[^>]+>/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length;
	const minutes = Math.max(1, Math.round(words / 200));
	return `${minutes} min read`;
}
