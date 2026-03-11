import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Admin Panel</h1>
      <div className="grid gap-4 md:grid-cols-2">
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
      </div>
    </div>
  );
}
