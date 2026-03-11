import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Admin Panel</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/questionnaire">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Questionnaire</CardTitle>
              <CardDescription>
                Manage cognitive boundary questionnaire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage versioned questionnaire structure with topics, dimensions, and questions.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/grades">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Grade Options</CardTitle>
              <CardDescription>
                Manage grade levels available to students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Add, edit, reorder, or disable grade options.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settings">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure platform-wide settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Toggle student ID requirement and other settings.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/activity-types">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Activity Types</CardTitle>
              <CardDescription>
                Manage progressive activity types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure activity types, prerequisites, ordering, and capacity.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/tags">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Manage activity tags
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create, edit, and delete tags used to categorize activities.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
