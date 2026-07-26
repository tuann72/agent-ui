"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];

const COMPONENTS: Components = {
  a: ({ node: _node, href, children: linkChildren, ...props }) => {
    const external =
      href?.startsWith("https://") || href?.startsWith("http://");
    return (
      <a
        {...props}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      >
        {linkChildren}
      </a>
    );
  },
};

/**
 * Render model and user-authored Markdown without allowing raw HTML.
 * Memoized: message text is immutable once streamed, and re-parsing every
 * message on each stream chunk is the message list's dominant render cost.
 */
export const MarkdownContent = memo(function MarkdownContent({
  children,
}: {
  children: string;
}) {
  return (
    <div className="agent-markdown">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        skipHtml
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
