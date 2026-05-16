'use client';

import { useEffect, useState } from 'react';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function compute(target: number): Countdown {
  const ms = target - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms / 3600000) % 24),
    minutes: Math.floor((ms / 60000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
    isExpired: false,
  };
}

/** Ticks every second toward a target datetime. */
export function useCountdown(target: string | Date | null): Countdown {
  const targetMs = target ? new Date(target).getTime() : 0;
  const [cd, setCd] = useState<Countdown>(() => compute(targetMs));

  useEffect(() => {
    if (!targetMs) return;
    setCd(compute(targetMs));
    const t = setInterval(() => setCd(compute(targetMs)), 1000);
    return () => clearInterval(t);
  }, [targetMs]);

  return cd;
}

/** Formats a countdown into a human-readable string. */
export function formatCountdown(cd: Countdown): string {
  if (cd.isExpired) return 'Deadline passed';
  if (cd.days >= 1) return `${cd.days} day${cd.days === 1 ? '' : 's'} ${cd.hours} hr`;
  if (cd.hours >= 1) return `${cd.hours} hr ${cd.minutes} min`;
  return `${cd.minutes} min ${cd.seconds} sec`;
}
