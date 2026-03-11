import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getUserDetail } from '@/server/queries/admin';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleToggle } from './RoleToggle';
import { StudentIdButton } from './StudentIdButton';

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function UserDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const user = await getUserDetail(id);
  if (!user) notFound();

  const fields = [
    { label: 'Username', value: user.username },
    { label: 'Name', value: user.name || '—' },
    { label: 'School', value: user.school || '—' },
    { label: 'Major', value: user.major || '—' },
    { label: 'Grade', value: user.grade || '—' },
    { label: 'Registered', value: formatDate(user.createdAt) },
    { label: 'Questionnaire', value: user.snapshotCount > 0 ? `Completed (${user.snapshotCount} submissions)` : 'Not completed' },
    { label: 'Activities Joined', value: String(user.activityCount) },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">User Detail</h1>
        <Link
          href="/admin/users"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Users
        </Link>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>{user.name || user.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            {fields.map((field) => (
              <div key={field.label} className="flex items-center justify-between border-b pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Role Management */}
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleToggle userId={user.id} currentRole={user.role} username={user.username} />
        </CardContent>
      </Card>

      {/* Student ID */}
      {user.hasStudentId && (
        <Card>
          <CardHeader>
            <CardTitle>Student ID</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentIdButton userId={user.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
