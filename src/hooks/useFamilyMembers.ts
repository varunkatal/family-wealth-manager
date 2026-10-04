import { useCallback, useEffect, useState } from 'react';
import type { FamilyMember, FamilyMemberInput } from '../models/familyMember';
import {
  createFamilyMember,
  deleteFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
} from '../services/storage/familyMemberRepository';

export function useFamilyMembers() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMembers(await listFamilyMembers());
      setError(null);
    } catch {
      setError('Could not load family members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: FamilyMemberInput) => {
      await createFamilyMember(input);
      await reload();
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, input: FamilyMemberInput) => {
      await updateFamilyMember(id, input);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteFamilyMember(id);
      await reload();
    },
    [reload],
  );

  return { members, loading, error, create, update, remove };
}
