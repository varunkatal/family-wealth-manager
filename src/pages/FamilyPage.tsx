import { useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { FamilyMemberForm } from '../features/family/FamilyMemberForm';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import type { FamilyMember } from '../models/familyMember';
import { ageFromDateOfBirth, formatISODate } from '../utils/date';

type StatusFilter = 'all' | 'active' | 'inactive';

type Dialog = { kind: 'add' } | { kind: 'edit'; member: FamilyMember } | { kind: 'delete'; member: FamilyMember } | null;

export function FamilyPage() {
  const { members, loading, error, create, update, remove } = useFamilyMembers();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = {
    all: members.length,
    active: members.filter((m) => m.isActive).length,
    inactive: members.filter((m) => !m.isActive).length,
  };
  const visible = members.filter((m) => filter === 'all' || (filter === 'active') === m.isActive);
  const close = () => setDialog(null);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Family" description="The people whose wealth you track." />
        {members.length > 0 && (
          <Button className="shrink-0" onClick={() => setDialog({ kind: 'add' })}>
            Add member
          </Button>
        )}
      </div>

      {(error || actionError) && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : members.length === 0 ? (
        <Card className="py-10 text-center">
          <h2 className="font-medium">No family members yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
            Add the people in your family. You'll assign assets and liabilities to them later.
          </p>
          <Button className="mt-5" onClick={() => setDialog({ kind: 'add' })}>
            Add your first member
          </Button>
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label="Filter by status" className="mb-4 inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {f} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No {filter} members.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Family members">
              {visible.map((m) => (
                <li key={m.id}>
                  <MemberCard
                    member={m}
                    onEdit={() => setDialog({ kind: 'edit', member: m })}
                    onDelete={() => setDialog({ kind: 'delete', member: m })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {dialog?.kind === 'add' && (
        <Modal title="Add family member" onClose={close}>
          <FamilyMemberForm
            onCancel={close}
            onSubmit={async (input) => {
              await create(input);
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Edit family member" onClose={close}>
          <FamilyMemberForm
            member={dialog.member}
            onCancel={close}
            onSubmit={async (input) => {
              await update(dialog.member.id, input);
              close();
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete family member?"
          message={
            <p>
              <strong className="text-slate-900 dark:text-slate-100">{dialog.member.name}</strong> will be permanently
              removed. This can't be undone. To keep them on record instead, edit them and mark them inactive.
            </p>
          }
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={async () => {
            try {
              await remove(dialog.member.id);
              setActionError(null);
            } catch {
              setActionError('Could not delete the family member.');
            }
            close();
          }}
        />
      )}
    </>
  );
}

function MemberCard({ member, onEdit, onDelete }: { member: FamilyMember; onEdit: () => void; onDelete: () => void }) {
  const details = [
    member.relationship,
    member.dateOfBirth &&
      `Born ${formatISODate(member.dateOfBirth)} (age ${ageFromDateOfBirth(member.dateOfBirth)})`,
  ].filter(Boolean);

  return (
    <Card className={`flex h-full flex-col ${member.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold">{member.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            member.isActive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      {details.length > 0 && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{details.join(' · ')}</p>
      )}
      {member.notes && (
        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{member.notes}</p>
      )}
      <div className="mt-auto flex gap-2 pt-4">
        <Button variant="secondary" onClick={onEdit} aria-label={`Edit ${member.name}`}>
          Edit
        </Button>
        <Button variant="danger-ghost" onClick={onDelete} aria-label={`Delete ${member.name}`}>
          Delete
        </Button>
      </div>
    </Card>
  );
}
