import sanitizeHtml from "sanitize-html";

export function sanitizeArticleHtml(value: string | null | undefined) {
  return sanitizeHtml(value ?? "", {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "blockquote", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noreferrer" } }),
    },
  });
}