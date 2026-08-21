'use client';

import { use, useState } from 'react';
import {
  FolderOpen,
  Folder,
  File as FileIcon,
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  ChevronRight,
  ExternalLink,
  Download,
  MoreVertical,
  Upload,
  Share2,
} from 'lucide-react';
import { Button, KpiCard, Section, StatusPill } from '@d2d/ui-web';
import { AccountShell } from '@/components/AccountShell';
import { FilesEmpty, FirstRunBanner } from '@/components/AccountEmptyStates';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { toast } from '@/components/Toaster';
import { getAccount } from '@/lib/accounts';
import { firstRunSnapshot } from '@/lib/first-run';

interface FolderDef {
  id: string;
  name: string;
  count: number;
  totalMb: number;
  color: string;
}

type FileType = 'image' | 'pdf' | 'doc' | 'video' | 'audio' | 'zip' | 'sheet';

interface FileItem {
  id: string;
  name: string;
  type: FileType;
  folder: string;
  sizeMb: number;
  modifiedBy: string;
  modifiedByInitials: string;
  modifiedAt: string;
  shared: boolean;
  gradient: string;
}

function buildFolders(slug: string): FolderDef[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  if (isCharity) {
    return [
      { id: 'f1', name: 'Brand assets', count: 84, totalMb: 412, color: 'text-violet-600' },
      { id: 'f2', name: 'Form templates', count: 22, totalMb: 18, color: 'text-blue-600' },
      {
        id: 'f3',
        name: 'Marketing creative',
        count: 312,
        totalMb: 1840,
        color: 'text-emerald-600',
      },
      { id: 'f4', name: 'Donor letters', count: 148, totalMb: 64, color: 'text-amber-600' },
      { id: 'f5', name: 'Compliance docs', count: 32, totalMb: 84, color: 'text-rose-600' },
      { id: 'f6', name: 'Knock photos', count: 1842, totalMb: 8120, color: 'text-cyan-600' },
      { id: 'f7', name: 'Receipts', count: 4218, totalMb: 218, color: 'text-slate-600' },
      { id: 'f8', name: 'Impact stories', count: 92, totalMb: 1218, color: 'text-pink-600' },
    ];
  }
  if (isHealth) {
    return [
      { id: 'f1', name: 'Brand assets', count: 48, totalMb: 312, color: 'text-violet-600' },
      { id: 'f2', name: 'Capital campaign', count: 84, totalMb: 1840, color: 'text-blue-600' },
      { id: 'f3', name: 'Donor letters', count: 124, totalMb: 48, color: 'text-amber-600' },
      { id: 'f4', name: 'Compliance docs', count: 64, totalMb: 184, color: 'text-rose-600' },
      {
        id: 'f5',
        name: 'Architectural renders',
        count: 28,
        totalMb: 4218,
        color: 'text-emerald-600',
      },
      { id: 'f6', name: 'Hospital photos', count: 412, totalMb: 2840, color: 'text-cyan-600' },
      { id: 'f7', name: 'Receipts', count: 1842, totalMb: 124, color: 'text-slate-600' },
    ];
  }
  return [
    { id: 'f1', name: 'Brand assets', count: 64, totalMb: 248, color: 'text-violet-600' },
    { id: 'f2', name: 'Service contracts', count: 412, totalMb: 184, color: 'text-blue-600' },
    { id: 'f3', name: 'Tech training', count: 32, totalMb: 1284, color: 'text-emerald-600' },
    { id: 'f4', name: 'Compliance & SDS', count: 184, totalMb: 248, color: 'text-rose-600' },
    { id: 'f5', name: 'Site photos', count: 4218, totalMb: 12420, color: 'text-cyan-600' },
    { id: 'f6', name: 'Receipts & invoices', count: 8214, totalMb: 412, color: 'text-slate-600' },
    { id: 'f7', name: 'Customer files', count: 1842, totalMb: 248, color: 'text-amber-600' },
  ];
}

function buildFiles(slug: string, folder: string): FileItem[] {
  const isCharity = slug === 'hope-forward' || slug === 'world-vision';
  const isHealth = slug === 'gold-coast-hospital';

  const reps = [
    ['SH', 'Sarah Hopkins'],
    ['JD', 'Jordan Diaz'],
    ['AM', 'Asha Mehta'],
    ['TM', 'Tomás Mendez'],
    ['BR', 'Brodie R.'],
  ];

  const gradients = [
    'from-blue-400 to-indigo-500',
    'from-emerald-400 to-teal-500',
    'from-amber-400 to-orange-500',
    'from-violet-400 to-fuchsia-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-blue-500',
    'from-slate-400 to-gray-500',
    'from-lime-400 to-green-500',
  ];

  let baseFiles: { name: string; type: FileType }[];

  if (folder === 'Brand assets') {
    baseFiles = [
      { name: 'logo-primary.svg', type: 'image' },
      { name: 'logo-monogram.svg', type: 'image' },
      { name: 'brand-guidelines-v3.pdf', type: 'pdf' },
      { name: 'color-palette.png', type: 'image' },
      { name: 'typography-spec.pdf', type: 'pdf' },
      { name: 'hero-photo-01.jpg', type: 'image' },
      { name: 'hero-photo-02.jpg', type: 'image' },
      { name: 'hero-photo-03.jpg', type: 'image' },
      { name: 'social-templates.zip', type: 'zip' },
      { name: 'brand-video-30s.mp4', type: 'video' },
    ];
  } else if (folder.includes('Marketing') || folder.includes('Capital')) {
    baseFiles = isCharity
      ? [
          { name: 'monthly-giving-landing-v3.jpg', type: 'image' },
          { name: 'donor-story-walker.mp4', type: 'video' },
          { name: 'gala-2026-invite-final.pdf', type: 'pdf' },
          { name: 'sponsor-deck-tier-A.pdf', type: 'pdf' },
          { name: 'social-carousel-may.zip', type: 'zip' },
          { name: 'newsletter-may-edition.pdf', type: 'pdf' },
          { name: 'thank-you-postcard.png', type: 'image' },
          { name: 'impact-report-2025.pdf', type: 'pdf' },
          { name: 'donor-acquisition-creative.zip', type: 'zip' },
          { name: 'email-template-monthly.html', type: 'doc' },
        ]
      : [
          { name: 'campaign-brochure-v2.pdf', type: 'pdf' },
          { name: 'rendering-new-wing-hero.jpg', type: 'image' },
          { name: 'rendering-paediatric.jpg', type: 'image' },
          { name: 'naming-rights-package.pdf', type: 'pdf' },
          { name: 'campaign-launch-video.mp4', type: 'video' },
          { name: 'donor-wall-mockup.png', type: 'image' },
          { name: 'pledge-form-print.pdf', type: 'pdf' },
        ];
  } else if (folder.includes('photos') || folder.includes('renders')) {
    baseFiles = Array.from({ length: 12 }, (_, i) => ({
      name: isCharity
        ? `knock-${(421 + i).toString().padStart(4, '0')}.jpg`
        : isHealth
          ? `tour-${(48 + i).toString().padStart(3, '0')}.jpg`
          : `site-${(1842 + i).toString().padStart(4, '0')}.jpg`,
      type: 'image' as FileType,
    }));
  } else if (folder.includes('Compliance')) {
    baseFiles = [
      { name: 'pci-dss-cert-2026.pdf', type: 'pdf' },
      { name: 'data-processing-agreement.pdf', type: 'pdf' },
      { name: 'security-policy-v2.docx', type: 'doc' },
      { name: 'audit-trail-export-Q1.xlsx', type: 'sheet' },
      { name: 'incident-runbook.pdf', type: 'pdf' },
      { name: 'staff-handbook-v4.pdf', type: 'pdf' },
      { name: 'iso-27001-evidence.zip', type: 'zip' },
      { name: 'soc-2-report-2026.pdf', type: 'pdf' },
    ];
  } else if (folder.includes('Form') || folder.includes('contract') || folder.includes('letters')) {
    baseFiles = [
      { name: 'donation-form-template.html', type: 'doc' },
      { name: 'volunteer-form.html', type: 'doc' },
      { name: 'pledge-card-print.pdf', type: 'pdf' },
      { name: 'tax-receipt-template.docx', type: 'doc' },
      { name: 'thank-you-letter-A.docx', type: 'doc' },
      { name: 'lapsed-donor-letter.docx', type: 'doc' },
      { name: 'birthday-acknowledgment.docx', type: 'doc' },
    ];
  } else if (folder.includes('Receipt') || folder.includes('invoice')) {
    baseFiles = Array.from({ length: 8 }, (_, i) => ({
      name: `receipt-${(4128 + i).toString()}.pdf`,
      type: 'pdf' as FileType,
    }));
  } else if (folder.includes('Tech') || folder.includes('training')) {
    baseFiles = [
      { name: 'chemical-safety-cert.mp4', type: 'video' },
      { name: 'route-app-walkthrough.mp4', type: 'video' },
      { name: 'door-script-v3.2.docx', type: 'doc' },
      { name: 'objection-handling.pdf', type: 'pdf' },
      { name: 'tech-onboarding-week1.zip', type: 'zip' },
      { name: 'product-knowledge-quiz.pdf', type: 'pdf' },
    ];
  } else {
    baseFiles = [
      { name: 'story-walker-family.mp4', type: 'video' },
      { name: 'story-patel.docx', type: 'doc' },
      { name: 'testimonial-aisha.mp3', type: 'audio' },
      { name: 'field-visit-2026.pdf', type: 'pdf' },
      { name: 'q1-impact-data.xlsx', type: 'sheet' },
      { name: 'video-thumbnail-pack.zip', type: 'zip' },
    ];
  }

  return baseFiles.map((f, i) => {
    const rep = reps[i % reps.length]!;
    return {
      id: `file_${folder}_${i}`,
      name: f.name,
      type: f.type,
      folder,
      sizeMb: 0.2 + ((i * 71) % 240) / 10,
      modifiedBy: rep[1]!,
      modifiedByInitials: rep[0]!,
      modifiedAt: `${i * 3 + 1}d ago`,
      shared: i % 4 === 0,
      gradient: gradients[i % gradients.length]!,
    };
  });
}

const FILE_ICONS: Record<FileType, { icon: typeof FileIcon; color: string }> = {
  image: { icon: ImageIcon, color: 'text-violet-600' },
  pdf: { icon: FileText, color: 'text-rose-600' },
  doc: { icon: FileText, color: 'text-blue-600' },
  sheet: { icon: FileText, color: 'text-emerald-600' },
  video: { icon: Film, color: 'text-amber-600' },
  audio: { icon: Music, color: 'text-pink-600' },
  zip: { icon: Archive, color: 'text-slate-600' },
};

export default function FilesPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}): JSX.Element {
  const params = use(paramsPromise);
  const account = getAccount(params.slug);
  const folders = buildFolders(params.slug);
  const [activeFolder, setActiveFolder] = useState(folders[0]?.name ?? 'Brand assets');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const firstRun = firstRunSnapshot(params.slug);
  if (!account || firstRun.isFirstRun) {
    return (
      <AccountShell accountSlug={params.slug} pageTitle="Files">
        <div className="space-y-5 max-w-[1400px]">
          {firstRun.isFirstRun && (
            <FirstRunBanner slug={params.slug} accountName={firstRun.accountName} />
          )}
          <FilesEmpty slug={params.slug} accountName={firstRun.accountName} />
        </div>
      </AccountShell>
    );
  }

  const files = buildFiles(params.slug, activeFolder).filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );

  const totalFiles = folders.reduce((s, f) => s + f.count, 0);
  const storageMb = folders.reduce((s, f) => s + f.totalMb, 0);
  const storageGb = (storageMb / 1024).toFixed(1);
  const filesThisMonth = Math.round(totalFiles * 0.08);
  const sharedExternally = Math.round(totalFiles * 0.04);

  return (
    <AccountShell accountSlug={params.slug} pageTitle="Files">
      <div className="space-y-5 max-w-[1500px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total files"
            value={totalFiles.toLocaleString()}
            hint={`${folders.length} folders`}
          />
          <KpiCard label="Storage used" value={`${storageGb} GB`} hint="of 250 GB quota" />
          <KpiCard
            label="Files · this month"
            value={filesThisMonth.toLocaleString()}
            delta="+22%"
            deltaTone="positive"
          />
          <KpiCard
            label="Shared externally"
            value={sharedExternally.toLocaleString()}
            hint="public links · last 30d"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
          {/* Folder sidebar */}
          <div className="card !p-0">
            <div className="px-4 py-3 border-b border-line2 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                Folders
              </div>
              <button
                onClick={() => toast.info('New folder — wiring lands in Phase 1.2')}
                aria-label="New folder"
                className="text-soft hover:text-ink"
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="py-1">
              {folders.map((f) => {
                const active = f.name === activeFolder;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFolder(f.name)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition ${
                      active ? 'bg-paper border-l-2 border-accent' : 'hover:bg-paper/60'
                    }`}
                  >
                    {active ? (
                      <FolderOpen size={14} className={f.color} />
                    ) : (
                      <Folder size={14} className={f.color} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[12.5px] truncate ${active ? 'text-ink font-semibold' : 'text-ink'}`}
                      >
                        {f.name}
                      </div>
                      <div className="text-[10px] text-muted numeric">
                        {f.count.toLocaleString()} files ·{' '}
                        {f.totalMb > 1024
                          ? `${(f.totalMb / 1024).toFixed(1)} GB`
                          : `${f.totalMb} MB`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line2 p-3">
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                leftIcon={<Upload size={12} />}
                onClick={() => toast.info('Upload — file uploads land in Phase 1.2')}
              >
                Upload
              </Button>
            </div>
          </div>

          {/* Files area */}
          <div className="space-y-3">
            <div className="card !p-0">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 flex-wrap">
                <div className="flex items-center gap-1 text-[12px] text-muted">
                  <Folder size={12} className="text-soft" />
                  <span>{activeFolder}</span>
                  <ChevronRight size={11} className="text-soft" />
                  <span className="text-ink font-medium">{files.length} files</span>
                </div>
                <div className="h-6 w-px bg-line2" />
                <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-xs">
                  <Search size={12} className="text-soft" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search this folder..."
                    className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-soft outline-none"
                  />
                </div>
                <div className="flex-1" />
                <div className="flex items-center bg-paper rounded-lg p-0.5 border border-line2">
                  <button
                    onClick={() => setView('grid')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      view === 'grid'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      view === 'list'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    List
                  </button>
                </div>
                <DataSourceBadge source="fixture" />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Filter size={12} />}
                  onClick={() => toast.info('Filter — file filters land in Phase 1.2')}
                >
                  Filter
                </Button>
              </div>

              {view === 'grid' && (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {files.map((f) => {
                    const Icon = FILE_ICONS[f.type];
                    return (
                      <div
                        key={f.id}
                        className="border border-line2 rounded-lg overflow-hidden hover:border-line hover:shadow-md transition group"
                      >
                        <div
                          className={`h-24 bg-gradient-to-br ${f.gradient} relative flex items-center justify-center`}
                        >
                          <Icon.icon size={28} className="text-surface/80" />
                          {f.shared && (
                            <div className="absolute top-1.5 right-1.5">
                              <span className="text-[9px] bg-surface/90 text-ink px-1.5 py-0.5 rounded font-medium">
                                <Share2 size={8} className="inline" /> shared
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 space-y-1">
                          <div
                            className="text-[11.5px] font-medium text-ink truncate"
                            title={f.name}
                          >
                            {f.name}
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[9px] text-muted">
                            <span className="numeric">{f.sizeMb.toFixed(1)} MB</span>
                            <span className="mono !w-4 !h-4 !text-[8px]">
                              {f.modifiedByInitials}
                            </span>
                          </div>
                          <div className="text-[9px] text-soft">{f.modifiedAt}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === 'list' && (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Modified by</th>
                      <th>Modified at</th>
                      <th>Sharing</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => {
                      const Icon = FILE_ICONS[f.type];
                      return (
                        <tr key={f.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Icon.icon size={13} className={Icon.color} />
                              <span className="text-[13px] font-medium text-ink">{f.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="tag uppercase !text-[9px]">{f.type}</span>
                          </td>
                          <td className="numeric text-[12px]">{f.sizeMb.toFixed(1)} MB</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className="mono">{f.modifiedByInitials}</span>
                              <span className="text-[12px] text-muted">{f.modifiedBy}</span>
                            </div>
                          </td>
                          <td className="text-[12px] text-muted">{f.modifiedAt}</td>
                          <td>
                            {f.shared ? (
                              <StatusPill tone="info">public</StatusPill>
                            ) : (
                              <span className="text-[11px] text-soft">private</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  toast.info(`Download ${f.name} — wiring lands in Phase 1.2`)
                                }
                                aria-label={`Download ${f.name}`}
                                className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink"
                              >
                                <Download size={11} />
                              </button>
                              <button
                                onClick={() =>
                                  toast.info(
                                    `Share ${f.name} — public-link wiring lands in Phase 1.2`,
                                  )
                                }
                                aria-label={`Share ${f.name}`}
                                className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink"
                              >
                                <ExternalLink size={11} />
                              </button>
                              <button
                                onClick={() =>
                                  toast.info(
                                    `More actions for ${f.name} — wiring lands in Phase 1.2`,
                                  )
                                }
                                aria-label={`More actions for ${f.name}`}
                                className="w-6 h-6 rounded hover:bg-paper flex items-center justify-center text-soft hover:text-ink"
                              >
                                <MoreVertical size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Section title="Storage by type" subtitle="MB used" paddedBody={false}>
                <div className="divide-y divide-line2">
                  {[
                    { label: 'Images', mb: 4218, color: 'bg-violet-500' },
                    { label: 'Videos', mb: 8214, color: 'bg-amber-500' },
                    { label: 'Documents', mb: 124, color: 'bg-blue-500' },
                    { label: 'Archives', mb: 412, color: 'bg-slate-500' },
                  ].map((s) => {
                    const max = 8214;
                    const pct = (s.mb / max) * 100;
                    return (
                      <div key={s.label} className="px-5 py-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12px] text-ink">{s.label}</span>
                          <span className="text-[11px] font-semibold text-ink numeric">
                            {s.mb > 1024 ? `${(s.mb / 1024).toFixed(1)} GB` : `${s.mb} MB`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                          <div className={`h-full ${s.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Recent uploads" subtitle="Last 4 files" paddedBody={false}>
                <div className="divide-y divide-line2">
                  {files.slice(0, 4).map((f) => {
                    const Icon = FILE_ICONS[f.type];
                    return (
                      <div key={f.id} className="px-5 py-2.5 flex items-center gap-2.5">
                        <Icon.icon size={13} className={Icon.color} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-ink truncate">{f.name}</div>
                          <div className="text-[10px] text-muted numeric">
                            {f.sizeMb.toFixed(1)} MB · {f.modifiedAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="External shares" subtitle="Public links" paddedBody={false}>
                <div className="divide-y divide-line2">
                  {files
                    .filter((f) => f.shared)
                    .slice(0, 4)
                    .map((f) => (
                      <div key={f.id} className="px-5 py-2.5 flex items-center gap-2.5">
                        <Share2 size={11} className="text-accent" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-ink truncate">{f.name}</div>
                          <div className="text-[10px] text-muted">Public link · expires never</div>
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
