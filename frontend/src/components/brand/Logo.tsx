/**
 * JB Decor brand lockup — renders the official gold logo PNG (ornate "JB" monogram,
 * DECOR wordmark and the "Crafted for Quality. Styled for You." tagline). Used across
 * the sidebar, header, mobile drawer, employee shell and login so the brand reads
 * identically everywhere.
 *
 * The gold artwork sits on a transparent background, so it looks premium on the deep
 * forest surfaces and remains legible on ivory/white ones. `size` controls the height;
 * width scales automatically to preserve the aspect ratio.
 */
const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-7",   // compact headers / drawers
  md: "h-10",  // desktop sidebar
  lg: "h-16",  // login screen
};

export default function Logo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}jb-decor-logo.png`}
      alt="JB Decor"
      className={`${SIZE[size]} w-auto select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
