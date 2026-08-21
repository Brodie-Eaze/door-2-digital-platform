'use client';

import { useState } from 'react';
import { PartnerShell } from '@/components/PartnerShell';
import { Section } from '@d2d/ui-web';
import { Upload, Check } from 'lucide-react';

interface BrandState {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  privacyPolicyUrl: string;
  customDomain: string;
}

function FileUploadSlot({ label, hint }: { label: string; hint: string }) {
  const [uploaded, setUploaded] = useState(false);
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors ${uploaded ? 'border-success bg-success/5' : 'border-line'}`}
      onClick={() => setUploaded(true)}
    >
      {uploaded ? (
        <div className="flex flex-col items-center gap-2">
          <Check size={20} className="text-success" />
          <div className="text-sm font-medium text-success">Uploaded</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted">
          <Upload size={20} />
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs">{hint}</div>
        </div>
      )}
    </div>
  );
}

export default function BrandKitPage() {
  const [brand, setBrand] = useState<BrandState>({
    displayName: 'Pilot-Charlie Foundation',
    primaryColor: '#0F172A',
    accentColor: '#3B82F6',
    supportEmail: 'support@pilotcharlie.org',
    supportPhone: '+1 (800) 555-0142',
    privacyPolicyUrl: 'https://pilotcharlie.org/privacy',
    customDomain: 'app.pilotcharlie.org',
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <PartnerShell pageTitle="Brand kit">
      <div className="space-y-6 max-w-2xl">
        <Section title="Logos + icons">
          <div className="grid grid-cols-3 gap-4">
            <FileUploadSlot label="Logo — light" hint="PNG / SVG, ≥ 200px wide" />
            <FileUploadSlot label="Logo — dark" hint="PNG / SVG, ≥ 200px wide" />
            <FileUploadSlot label="App icon" hint="PNG, 1024×1024px" />
          </div>
          <p className="text-xs text-muted mt-3">
            Logos appear in the knocker iOS app, partner portal header, and on invoice PDFs. D2D
            prepares white-label build variants using the icons on file.
          </p>
        </Section>

        <Section title="Identity">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Display name</label>
              <input
                className="input w-full"
                value={brand.displayName}
                onChange={(e) => setBrand({ ...brand, displayName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Primary colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-9 rounded border border-line cursor-pointer"
                    value={brand.primaryColor}
                    onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  />
                  <span className="mono text-sm">{brand.primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Accent colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-9 rounded border border-line cursor-pointer"
                    value={brand.accentColor}
                    onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                  />
                  <span className="mono text-sm">{brand.accentColor}</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Contact + legal">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">Support email</label>
              <input
                className="input w-full"
                value={brand.supportEmail}
                onChange={(e) => setBrand({ ...brand, supportEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Support phone</label>
              <input
                className="input w-full"
                value={brand.supportPhone}
                onChange={(e) => setBrand({ ...brand, supportPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Privacy policy URL</label>
              <input
                className="input w-full"
                value={brand.privacyPolicyUrl}
                onChange={(e) => setBrand({ ...brand, privacyPolicyUrl: e.target.value })}
              />
            </div>
          </div>
        </Section>

        <Section title="Custom domain">
          <div>
            <label className="block text-xs text-muted mb-1">
              Custom domain (shown in the partner portal header + iOS app)
            </label>
            <input
              className="input w-full"
              value={brand.customDomain}
              onChange={(e) => setBrand({ ...brand, customDomain: e.target.value })}
            />
            <p className="text-xs text-muted mt-2">
              Point a CNAME at <span className="mono">partner.door2digital.io</span> — D2D will
              provision TLS automatically. Propagation takes up to 48 h.
            </p>
          </div>
        </Section>

        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-success text-white' : 'bg-accent text-white hover:bg-accent/90'}`}
        >
          {saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            'Save brand kit'
          )}
        </button>
      </div>
    </PartnerShell>
  );
}
