import { useEffect } from 'react';
import { installSmoothScrolling } from '@/shared/ui/scrolling/installSmoothScrolling';

export function SmoothScrolling() {
  useEffect(installSmoothScrolling, []);
  return null;
}
