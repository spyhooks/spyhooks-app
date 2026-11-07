/** Static Abstract Wave Depth with a subtle center-lit, dark-edge gradient. */
export function AbstractWaveDepth() {
  return (
    <div
      aria-hidden="true"
      className="abstract-wave-depth pointer-events-none fixed inset-0 z-0 overflow-hidden hidden dark:block"
    >
      {/* A restrained charcoal glow in the middle, fading to black at the sides. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 63% 69% at 50% 47%, rgba(112, 115, 123, 0.34) 0%, rgba(78, 81, 89, 0.23) 27%, rgba(33, 35, 40, 0.12) 55%, transparent 83%)',
        }}
      />
      {/* Keep the previously installed SVG wave image unchanged. */}
      <img
        src="/abstract-wave-depth.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center select-none"
        draggable={false}
      />
    </div>
  )
}
