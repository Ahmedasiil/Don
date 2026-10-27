import { Fragment } from "react";

// Small, safe Markdown renderer for AI replies and course lessons: headings, lists,
// bold, italics, inline code and https links. No raw HTML is ever rendered.
function inline(text: string, key: string) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith("**")) out.push(<strong key={`${key}-${i++}`}>{s.slice(2, -2)}</strong>);
    else if (s.startsWith("`")) out.push(<code key={`${key}-${i++}`}>{s.slice(1, -1)}</code>);
    else if (s.startsWith("[")) {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(s)!;
      // Only web, email and in-app links: AI replies can quote outside text, so never javascript: or data:.
      if (!/^(https?:\/\/|mailto:|\/(?!\/))/i.test(href.trim())) { out.push(label); last = m.index + s.length; continue; }
      out.push(<a key={`${key}-${i++}`} href={href.trim()} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue underline underline-offset-2">{label}</a>);
    } else out.push(<em key={`${key}-${i++}`}>{s.slice(1, -1)}</em>);
    last = m.index + s.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = "prose-op" }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(<L key={blocks.length}>{list.items.map((it, i) => <li key={i}>{inline(it, `l${blocks.length}-${i}`)}</li>)}</L>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); const H = h[1].length === 1 ? "h2" : h[1].length === 2 ? "h2" : "h3"; blocks.push(<H key={blocks.length}>{inline(h[2], `h${blocks.length}`)}</H>); }
    else if (ul || ol) { flushPara(); const ordered = !!ol; if (list && list.ordered !== ordered) flushList(); list ??= { ordered, items: [] }; list.items.push((ul ?? ol)![1]); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return <div className={className}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
