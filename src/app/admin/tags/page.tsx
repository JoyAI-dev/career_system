import { redirect } from 'next/navigation';

export default function TagsPage() {
  redirect('/admin/activities?tab=tags');
}
