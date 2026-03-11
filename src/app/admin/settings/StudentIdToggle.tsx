'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { updateSystemSetting } from '@/server/actions/admin';

export function StudentIdToggle({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const t = useTranslations('admin.settings');

  async function handleToggle(checked: boolean) {
    setEnabled(checked);
    setSaving(true);
    try {
      await updateSystemSetting('require_student_id', checked ? 'true' : 'false');
    } catch {
      setEnabled(!checked); // revert on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="student-id-toggle" className="text-base font-medium">
          {t('requireStudentId')}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t('requireStudentIdDesc')}
        </p>
      </div>
      <Switch
        id="student-id-toggle"
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={saving}
      />
    </div>
  );
}
