import { useState, useRef, useEffect } from 'react';
import { getAbsoluteImageUrl, PLACEHOLDER_SVG } from '../utils/images';

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackSrc,
  ...props
}) {
  const resolvedSrc = getAbsoluteImageUrl(src);
  const [imgSrc, setImgSrc] = useState(resolvedSrc);
  const prevSrcRef = useRef(resolvedSrc);
  const loadedRef = useRef(false);

  useEffect(() => {
    const next = getAbsoluteImageUrl(src);
    if (next !== prevSrcRef.current) {
      prevSrcRef.current = next;
      if (!loadedRef.current || next !== PLACEHOLDER_SVG) {
        setImgSrc(next);
      }
    }
  }, [src]);

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setImgSrc(PLACEHOLDER_SVG);
    }
  };

  const handleLoad = () => {
    loadedRef.current = true;
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
}
