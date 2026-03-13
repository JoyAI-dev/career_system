'use client';

import { useEffect } from 'react';
import { trackActivity } from '@/server/actions/community';

export function ActivityTracker() {
  useEffect(() => {
    // Track on mount
    trackActivity();

    // Track every 2 minutes
    const interval = setInterval(() => {
      trackActivity();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
