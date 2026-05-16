'use client';

import { useEffect } from 'react';
import { initAnalytics, identifyUser } from '@/lib/analytics';

// Initializes PostHog on mount and identifies the logged-in manager.
export function AnalyticsProvider({ userId }: { userId?: string | null }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (userId) identifyUser(userId);
  }, [userId]);

  return null;
}
