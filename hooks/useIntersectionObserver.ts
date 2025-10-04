import { useEffect, useRef, useCallback } from 'react';

interface ObserverOptions {
  onIntersect: () => void;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export const useIntersectionObserver = <T extends HTMLElement>({
  onIntersect,
  root = null,
  rootMargin = '0px',
  threshold = 0.1,
}: ObserverOptions) => {
  const ref = useRef<T>(null);

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        onIntersect();
      }
    });
  }, [onIntersect]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersect, {
      root,
      rootMargin,
      threshold,
    });
    
    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [ref, root, rootMargin, threshold, handleIntersect]);

  return { ref };
};