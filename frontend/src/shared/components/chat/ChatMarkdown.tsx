import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './chat-markdown.css';

const components: Components = {
  a: ({ href, title, children }) => {
    const external = /^(?:https?:)?\/\//i.test(href ?? '');
    return (
      <a
        href={href}
        title={title}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {children}
      </a>
    );
  },
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
  table: ({ children }) => (
    <div
      className="chat-markdown-table"
      role="region"
      aria-label="표"
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
};

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {content}
      </Markdown>
    </div>
  );
}
