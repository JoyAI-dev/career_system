import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardStats } from '@/server/queries/admin';
import { requireAdmin } from '@/lib/auth';

type RecentUser = { id: string; username: string; name: string | null; school: string | null; createdAt: string };
type NearCapacityActivity = { id: string; title: string; members: number; capacity: number };

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const ADMIN_LINKS = [
  { href: '/admin/users', label: 'Users', desc: 'User management and roles' },
  { href: '/admin/questionnaire', label: 'Questionnaire', desc: 'Manage cognitive questionnaire' },
  { href: '/admin/activities', label: 'Activities', desc: 'Create and manage activities' },
  { href: '/admin/activity-types', label: 'Activity Types', desc: 'Progressive activity types' },
  { href: '/admin/tags', label: 'Tags', desc: 'Activity categorization tags' },
  { href: '/admin/recruitment', label: 'Recruitment', desc: 'Recruitment event publishing' },
  { href: '/admin/grades', label: 'Grade Options', desc: 'Student grade levels' },
  { href: '/admin/settings', label: 'Settings', desc: 'Platform-wide configuration' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminPage() {
  await requireAdmin();
  const stats = await getDashboardStats();

  const totalActivities = Object.values(stats.statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.totalUsers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{totalActivities}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                >
                  {STATUS_LABELS[status] || status}: {count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Questionnaire Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.completionRate}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.totalSnapshots} total submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Near Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.nearCapacity.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              activities at 80%+ capacity
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registrations yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentUsers.map((user: RecentUser) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {user.name || user.username}
                      </p>
                      {user.school && (
                        <p className="text-xs text-muted-foreground">{user.school}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities Nearing Capacity */}
        <Card>
          <CardHeader>
            <CardTitle>Activities Nearing Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.nearCapacity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activities nearing capacity
              </p>
            ) : (
              <div className="space-y-3">
                {stats.nearCapacity.map((activity: NearCapacityActivity) => {
                  const pct = Math.round((activity.members / activity.capacity) * 100);
                  return (
                    <div
                      key={activity.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {activity.members}/{activity.capacity} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-amber-100 dark:bg-amber-900">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{link.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
