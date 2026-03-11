import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserProfile, getActiveGradeOptions } from '@/server/queries/user';
import { ProfileForm } from './ProfileForm';
import { StudentIdUpload } from './StudentIdUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const [user, gradeOptions] = await Promise.all([
    getUserProfile(session.user.id),
    getActiveGradeOptions(),
  ]);

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Profile</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Username: {user.username}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} gradeOptions={gradeOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student ID Verification</CardTitle>
            <CardDescription>Upload your student ID for verification</CardDescription>
          </CardHeader>
          <CardContent>
            <StudentIdUpload hasUpload={!!user.studentIdUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cognitive Boundary Report</CardTitle>
            <CardDescription>
              View your cognitive exploration progress and growth over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Complete the cognitive boundary questionnaire to unlock your report.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
