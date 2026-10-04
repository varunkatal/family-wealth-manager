import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormField, inputClass } from '../../components/FormField';
import { familyMemberInputSchema, RELATIONSHIPS, type FamilyMember, type FamilyMemberInput } from '../../models/familyMember';
import { todayISODate } from '../../utils/date';

type FormValues = {
  name: string;
  relationship: string;
  dateOfBirth: string;
  notes: string;
  isActive: boolean;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

function toFormValues(member?: FamilyMember): FormValues {
  return {
    name: member?.name ?? '',
    relationship: member?.relationship ?? '',
    dateOfBirth: member?.dateOfBirth ?? '',
    notes: member?.notes ?? '',
    isActive: member?.isActive ?? true,
  };
}

type FamilyMemberFormProps = {
  member?: FamilyMember;
  onSubmit: (input: FamilyMemberInput) => Promise<void>;
  onCancel: () => void;
};

export function FamilyMemberForm({ member, onSubmit, onCancel }: FamilyMemberFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(member));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Keep a stored relationship that isn't in the list (e.g. from a later import) selectable.
  const relationshipOptions: string[] = [...RELATIONSHIPS];
  if (values.relationship && !relationshipOptions.includes(values.relationship)) {
    relationshipOptions.push(values.relationship);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsed = familyMemberInputSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(values);
    } catch {
      setSaveError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
      <FormField id="member-name" label="Name" required error={errors.name}>
        <input
          id="member-name"
          className={inputClass}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'member-name-error' : undefined}
          autoFocus
          autoComplete="off"
          maxLength={100}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="member-relationship" label="Relationship" error={errors.relationship}>
          <select
            id="member-relationship"
            className={inputClass}
            value={values.relationship}
            onChange={(e) => set('relationship', e.target.value)}
          >
            <option value="">Not specified</option>
            {relationshipOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="member-dob" label="Date of birth" hint="Optional" error={errors.dateOfBirth}>
          <input
            id="member-dob"
            type="date"
            className={inputClass}
            value={values.dateOfBirth}
            max={todayISODate()}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            aria-invalid={!!errors.dateOfBirth}
            aria-describedby={errors.dateOfBirth ? 'member-dob-error' : undefined}
          />
        </FormField>
      </div>

      <FormField id="member-notes" label="Notes" hint="Optional" error={errors.notes}>
        <textarea
          id="member-notes"
          rows={3}
          className={inputClass}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          aria-invalid={!!errors.notes}
          maxLength={1000}
        />
      </FormField>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        <span>
          <span className="font-medium">Active</span>
          <span className="block text-slate-500 dark:text-slate-400">
            Untick for someone no longer part of the family's finances. Their record is kept.
          </span>
        </span>
      </label>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {member ? 'Save changes' : 'Add member'}
        </Button>
      </div>
    </form>
  );
}
