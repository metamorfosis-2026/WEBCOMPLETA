'use client';

import Script from 'next/script';

export function SplineBackground({
  scene,
  className,
}: {
  scene: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      <Script
        type="module"
        src="https://unpkg.com/@splinetool/viewer@1.12.51/build/spline-viewer.js"
        strategy="afterInteractive"
      />
      <spline-viewer url={scene} />
    </div>
  );
}
