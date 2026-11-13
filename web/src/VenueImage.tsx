import type { ImgHTMLAttributes } from "react";
export function VenueImage({
  src,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const fallback = "/images/tennis.jpg";
  return (
    <img
      {...props}
      alt={alt || ""}
      src={src || fallback}
      onError={(e) => {
        if (e.currentTarget.getAttribute("src") !== fallback)
          e.currentTarget.src = fallback;
      }}
    />
  );
}
