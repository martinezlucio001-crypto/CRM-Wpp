'use client';

import { useCan } from '@/hooks/use-can';


import { DocumentFieldsSettings } from './document-fields-settings';
import { SettingsPanelHead } from './settings-panel-head';
import { TagManager } from './tag-manager';

/**
 * "Fields & tags" section. Tags are visible to everyone.
 * Document settings are admin-gated.
 */
export function FieldsAndTagsPanel() {
  const canEditSettings = useCan('edit-settings');

  return (
    <section className="max-w-3xl animate-in fade-in-50 space-y-4 duration-200">
      <SettingsPanelHead
        title="Pastas e tags"
        description="Organize seus contatos com tags coloridas para agrupamento rápido."
      />
      <TagManager />
      {canEditSettings ? (
        <>

          <DocumentFieldsSettings />
        </>
      ) : null}
    </section>
  );
}
