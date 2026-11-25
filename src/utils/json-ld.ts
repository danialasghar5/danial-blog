// Serialize structured data for <script type="application/ld+json" set:html={…}>.
// JSON.stringify alone does not escape "<", so a "</script>" inside any string
// (a title, an FAQ answer) would end the script element early — an XSS vector.
// Escaping <, >, & and the JS line/paragraph separators (U+2028/U+2029) keeps
// the JSON identical to parsers while making it inert as HTML
// (TOOLS_ROADMAP.md §11.6, rule 22).

// U+2028/U+2029 built from code points so no raw separator sits in source.
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, "g");
const hex4 = (c: string) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;

export function jsonLd(data: unknown): string {
	return JSON.stringify(data).replace(UNSAFE, hex4);
}
