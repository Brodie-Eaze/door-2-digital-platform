import Link from 'next/link';
import { ArrowLeft, FileText, Download } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { type SecurityDocSlug, getSecurityDocMeta, readSecurityDoc } from '@/lib/securityDocs';

interface SecurityDocViewerProps {
  slug: SecurityDocSlug;
}

/**
 * Server component — renders one of the bounded security docs as raw
 * markdown inside the PublicShell. No MDX, no syntax highlighting, no
 * remark plugins (NO new dependencies rule for this sprint). We use a
 * <pre> with whitespace-pre-wrap so the markdown reads as the literal
 * source. That's deliberate: pen-testers + auditors want the raw text,
 * not a rendered version that might omit something.
 *
 * Phase 1.4: replace with a proper MDX renderer using @next/mdx (already
 * a transitive dep) so headings get anchors and code blocks get syntax
 * highlighting. For Sprint E the priority is "the link goes somewhere
 * honest", not presentation polish.
 */
export async function SecurityDocViewer({ slug }: SecurityDocViewerProps): Promise<JSX.Element> {
  const meta = getSecurityDocMeta(slug);
  const content = await readSecurityDoc(slug);

  return (
    <PublicShell activeNav="security">
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
        <Link
          href={meta.backHref}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {meta.backLabel}
        </Link>

        <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[10.5px] uppercase tracking-[0.12em] font-medium mb-4">
              <FileText className="h-3 w-3" /> Security doc
            </div>
            <h1 className="text-3xl font-semibold text-ink tracking-tight">{meta.title}</h1>
            <p className="text-[14px] text-muted mt-2">{meta.description}</p>
          </div>
          <a
            href={`https://github.com/d2d-os/d2d-platform/blob/main/${meta.path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-ink px-4 py-2 rounded-md border border-line bg-surface hover:bg-paper transition"
          >
            <Download className="h-3.5 w-3.5" /> View on GitHub
          </a>
        </div>

        {content ? (
          <article className="card card-pad p-8 lg:p-10">
            <pre className="whitespace-pre-wrap break-words text-[13px] leading-[1.65] font-mono text-ink2 overflow-x-auto">
              {content}
            </pre>
          </article>
        ) : (
          <article className="card card-pad p-10 text-center">
            <p className="text-[14px] text-ink font-medium">Doc not bundled in this deploy.</p>
            <p className="text-[13px] text-muted mt-2 max-w-md mx-auto leading-relaxed">
              The full text lives in the repo at <code className="text-accent">{meta.path}</code>.
              Phase 1.4 ships an MDX renderer that bundles security docs into the deploy artifact
              directly.
            </p>
            <a
              href={`https://github.com/d2d-os/d2d-platform/blob/main/${meta.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-5 py-3 rounded-md hover:bg-ink2 transition"
            >
              <Download className="h-4 w-4" /> View on GitHub
            </a>
          </article>
        )}
      </section>
    </PublicShell>
  );
}
