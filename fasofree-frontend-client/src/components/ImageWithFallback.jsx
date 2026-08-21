import { useState } from 'react';
import { getAbsoluteImageUrl, PLACEHOLDER_SVG } from '../utils/images';

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  fallbackSrc,
  ...props
}) {
  const [imgSrc, setImgSrc] = useState(() => getAbsoluteImageUrl(src));

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setImgSrc(PLACEHOLDER_SVG);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
}
