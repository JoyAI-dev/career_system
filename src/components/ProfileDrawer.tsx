'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ProfileForm } from '@/app/(main)/profile/ProfileForm';
import { StudentIdUpload } from '@/app/(main)/profile/StudentIdUpload';

type ProfileData = {
  user: {
    id: string;
    username: string;
    name: string | null;
    school: string | null;
    major: string | null;
    grade: string | null;
    studentIdUrl: string | null;
  };
  gradeOptions: { id: string; label: string }[];
  hasCompleted: boolean;
};

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  role: string;
}

export function ProfileDrawer({ open, onOpenChange, username, role }: ProfileDrawerProps) {
  const t = useTranslations('profile');
  const th = useTranslations('header');
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when drawer opens
  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open, fetchProfile]);

  const handleLogout = () => {
    // Clear announcement dismissal so popup shows again on next login
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('announcement_dismissed')) sessionStorage.removeItem(key);
    });
    signOut({ callbackUrl: '/login' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>
            {username} &middot; {role === 'ADMIN' ? th('administrator') : th('student')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-4 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Account Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('accountInfo')}</CardTitle>
                  <CardDescription>Username: {data.user.username}</CardDescription>
                </CardHeader>
              </Card>

              {/* Personal Info Form */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('personalInfo')}</CardTitle>
                  <CardDescription>{t('updateDetails')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProfileForm
                    user={data.user}
                    gradeOptions={data.gradeOptions}
                    onSuccess={fetchProfile}
                  />
                </CardContent>
              </Card>

              {/* Student ID Upload */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('studentId')}</CardTitle>
                  <CardDescription>{t('uploadStudentId')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <StudentIdUpload hasUpload={!!data.user.studentIdUrl} />
                </CardContent>
              </Card>

              {/* Cognitive Report Link */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('cognitiveReport')}</CardTitle>
                  <CardDescription>{t('cognitiveReportDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.hasCompleted ? (
                    <Button
                      nativeButton={false}
                      render={<Link href="/cognitive-report" />}
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      {t('viewReport')}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('completeQuestionnaire')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <SheetFooter>
          <Separator />
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {th('logOut')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
