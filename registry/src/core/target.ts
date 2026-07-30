/**
 * The single way Agent locates a page element.
 *
 * Only `data-agent-target` attributes are ever matched — never a model-supplied
 * CSS selector — and the id is escaped, so a crafted id cannot break out of the
 * attribute value into selector syntax. Every page action resolves its element
 * through here, which is why widening what Agent can touch is a change to the
 * manifest, not to a query string.
 */
export function findTargetElement(targetId: string): Element | null {
  return document.querySelector(
    `[data-agent-target="${CSS.escape(targetId)}"]`,
  );
}
