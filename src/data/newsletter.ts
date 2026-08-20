// Newsletter configuration — the single place the provider is wired.
//
// The <Newsletter /> component is provider-agnostic: it renders a styled form
// that POSTs to `action` using `emailField` (+ any `hiddenFields`). Swapping
// providers later means editing only this file — no markup or styling changes.
//
// ── Current provider: MailerLite ────────────────────────────────────────────
// MailerLite exposes an embedded-form subscribe endpoint you can POST to
// directly (no external script, no API key in the browser):
//
//   https://assets.mailerlite.com/jsonp/<ACCOUNT_ID>/forms/<FORM_ID>/subscribe
//
// To go live, set `enabled: true` and paste that URL into `action`. See the
// notes returned to you for the exact steps (create an embedded form, verify
// the sending domain for hello@danialasghar.com, confirm the field name).
//
// Until `enabled` is true AND `action` is non-empty, the component shows a
// tasteful RSS fallback instead of a broken form, so nothing half-wired ships.

export type NewsletterProvider = 'mailerlite' | 'none';

export interface NewsletterConfig {
	/** Master switch. Keep false until `action` is a real endpoint. */
	enabled: boolean;
	provider: NewsletterProvider;
	/** Provider subscribe endpoint the form POSTs to. Empty = not configured. */
	action: string;
	/** Field name the provider expects for the email address. */
	emailField: string;
	/** Optional provider-specific hidden fields (name → value). */
	hiddenFields: Record<string, string>;
	/** The From/sender address (configured in the provider dashboard, not here). */
	sender: string;
}

export const newsletter: NewsletterConfig = {
	enabled: true,
	provider: 'mailerlite',
	action: 'https://assets.mailerlite.com/jsonp/2583089/forms/196156564053165930/subscribe',
	emailField: 'fields[email]',
	// MailerLite's embedded-form payload. The endpoint sends
	// `access-control-allow-origin: *`, so the browser can POST and read the
	// JSON response ({ "success": true }) directly — no API key, no server.
	hiddenFields: { 'ml-submit': '1', anticsrf: 'true' },
	sender: 'hello@danialasghar.com',
};

/** True only when the form can actually submit somewhere real. */
export const newsletterLive = newsletter.enabled && newsletter.action.length > 0;
