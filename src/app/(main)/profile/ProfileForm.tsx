'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateProfile, type UpdateProfileState } from '@/server/actions/user';

type ProfileFormProps = {
  user: {
    name: string | null;
    school: string | null;
    major: string | null;
    grade: string | null;
  };
  gradeOptions: {
    id: string;
    label: string;
  }[];
};

export function ProfileForm({ user, gradeOptions }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Profile updated successfully.
        </div>
      )}

      {state.errors?._form && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.errors._form.join(', ')}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" defaultValue={user.name ?? ''} />
        {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="school">School</Label>
        <Input id="school" name="school" type="text" defaultValue={user.school ?? ''} />
        {state.errors?.school && (
          <p className="text-sm text-destructive">{state.errors.school[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="major">Major</Label>
        <Input id="major" name="major" type="text" defaultValue={user.major ?? ''} />
        {state.errors?.major && <p className="text-sm text-destructive">{state.errors.major[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="grade">Grade</Label>
        <Select name="grade" defaultValue={user.grade ?? ''}>
          <SelectTrigger>
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent>
            {gradeOptions.map((option) => (
              <SelectItem key={option.id} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.grade && <p className="text-sm text-destructive">{state.errors.grade[0]}</p>}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
