'use client';

import { useState } from 'react';
import {
  Database,
  FileCode2,
  FileText,
  Files,
} from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FSDocument,
} from '@/lib/api-client';
import { TransformEditor } from './transform/TransformEditor';
import { TemplateEditorTab } from './template/TemplateEditorTab';
import { DataSourcesTab } from './data-context/DataSourcesTab';
import { ReportBuilderButton } from './ReportBuilderButton';

type TabValue = 'data-sources' | 'transform' | 'template';

const TABS: Array<{ id: TabValue; label: string; icon: typeof FileCode2 }> = [
  { id: 'data-sources', label: 'Data Sources', icon: Database },
  { id: 'transform', label: 'Transform', icon: FileCode2 },
  { id: 'template', label: 'Template', icon: FileText },
];

export interface DocumentTemplateDetailClientProps {
  setting: DocumentTemplateSetting;
  docxDocuments: FSDocument[];
  companyCategories?: FilesystemCategory[];
  folderSetting?: DocumentTemplatesFolderSetting | null;
}

export function DocumentTemplateDetailClient({
  setting: initialSetting,
  docxDocuments = [],
  companyCategories = [],
  folderSetting: initialFolder,
}: DocumentTemplateDetailClientProps) {
  const [setting, setSetting] = useState(initialSetting);
  const [activeTab, setActiveTab] = useState<TabValue>('data-sources');

  const isDefault = setting.documentType === 'default';

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      {isDefault ? null : (
        <SetHeaderActions>
          <ReportBuilderButton
            documentType={setting.documentType}
            label={setting.label}
          />
        </SetHeaderActions>
      )}
      <SetPageHeader>
        <PageHeaderLayout
          leading={
            <BackButton
              href="/admin/document-templates"
              label="Back to document templates"
            />
          }
          icon={
            <PageHeaderIcon
              icon={Files}
              className="bg-muted"
              iconClassName="text-muted-foreground"
            />
          }
          title={setting.label}
          bottomRow={
            <>
              <PageHeaderField label="Type">{setting.documentType}</PageHeaderField>
              <PageHeaderField label="Template">
                {setting.filesystemDocument ? 'Assigned' : 'Not set'}
              </PageHeaderField>
            </>
          }
        />
      </SetPageHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200">
          <div className="flex min-w-0 flex-1 flex-wrap gap-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                    active
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                      : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {activeTab === 'data-sources' && (
            isDefault ? (
              <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
                <h2 className="text-sm font-semibold text-slate-900">Data sources</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  The default/fallback scenario does not support data context configuration.
                  Configure data sources on individual document type pages instead.
                </p>
              </div>
            ) : (
              <DataSourcesTab
                documentType={setting.documentType}
                label={setting.label}
              />
            )
          )}

          {activeTab === 'transform' && (
            isDefault ? (
              <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
                <h2 className="text-sm font-semibold text-slate-900">Data transform</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  The default/fallback scenario does not support custom transforms. Configure
                  transforms on individual document type pages instead.
                </p>
              </div>
            ) : (
              <TransformEditor
                documentType={setting.documentType}
                label={setting.label}
              />
            )
          )}

          {activeTab === 'template' && (
            <TemplateEditorTab
              setting={setting}
              docxDocuments={docxDocuments}
              companyCategories={companyCategories}
              folderSetting={initialFolder}
              onSettingChange={setSetting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
