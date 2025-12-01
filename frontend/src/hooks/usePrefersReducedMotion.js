import { useEffect, useState } from 'react';

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getMotionPreference = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
    return false;
  }
  return window.matchMedia(MOTION_QUERY).matches;
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getMotionPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(MOTION_QUERY);
    const handleChange = (event) => setPrefersReducedMotion(event.matches);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
    } else {
      mediaQueryList.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQueryList.removeEventListener === 'function') {
        mediaQueryList.removeEventListener('change', handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, []);

  return prefersReducedMotion;
}

export default usePrefersReducedMotion;

