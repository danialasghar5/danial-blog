export interface Metric {
	value: string;
	label: string;
}

// Real, verifiable figures ONLY. Left empty until you provide numbers — the
// <Metrics /> component renders nothing while this array is empty, so the
// homepage never shows fabricated credibility stats.
//
// Example shape (replace with your real data):
//   { value: '5M+/mo', label: 'requests served' },
//   { value: '99.9%',  label: 'uptime' },
export const metrics: Metric[] = [];
