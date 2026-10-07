import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

// Sanitized: raw HTML in posts is dropped, so a compromised admin account can't inject script.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 leading-relaxed text-ink-soft [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ a: ({ href, children }) => <a href={href} rel="noopener noreferrer nofollow">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
