import React from "react";
 /* @component Image
 *
 * Centers an image, constrains it to a max width,
 * and (optionally) adds a subtle border + drop shadow.
 * Supports an optional aspect ratio box.
 *
 * @prop {string}   src            – required, image URL (e.g. "/docs/img/foo.png" or external link)
 * @prop {string}   [alt='']       – optional, alt text for accessibility
 * @prop {string}   [caption]      – optional caption shown under the image
 * @prop {boolean}  [bordered=true]– whether to draw a 1px gray border + soft shadow
 * @prop {number|string} [maxWidth=700] – max width for container (px or CSS unit)
 * @prop {React.CSSProperties} [wrapperStyle]   – extra styles for the outer wrapper
 * @prop {React.CSSProperties} [containerStyle] – extra styles for the inner container
 * @prop {React.CSSProperties} [imgStyle]       – extra styles for the <img> itself
 * @prop {string}   [aspectRatio] – optional aspect ratio string like "16:9" or "4:3"
 * @prop {string}   [className]   – extra CSS class(es) for the outer wrapper
 *
 * Supports lazy loading via `loading="lazy"`.
 */
interface ImageProps {

  src: string;
  alt?: string;
  caption?: string;
  bordered?: boolean;
  maxWidth?: number | string;
  wrapperStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  aspectRatio?: string;
  className?: string;
}

export default function Image({
  src,
  alt = "",
  caption,
  bordered = true,
  maxWidth = 700,
  wrapperStyle = {},
  containerStyle = {},
  imgStyle = {},
  aspectRatio,
  className = "",
}: ImageProps): React.ReactElement {

  const outer: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    ...wrapperStyle,
  };

  let aspectPadding: string | null = null;
  if (aspectRatio && aspectRatio.includes(":")) {
    const [w, h] = aspectRatio.split(":").map(Number);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      aspectPadding = `${(h / w) * 100}%`;
    }
  }

  const inner: React.CSSProperties = {
    maxWidth,
    width: "100%",
    position: aspectPadding ? "relative" : "static",
    ...(aspectPadding ? { paddingTop: aspectPadding } : {}),
    ...containerStyle,
  };

  const imgStyles: React.CSSProperties = {
    display: "block",
    margin: "auto",
    maxWidth: "100%",
    width: aspectPadding ? "100%" : "auto",
    height: aspectPadding ? "100%" : "auto",
    objectFit: aspectPadding ? "cover" : "initial",
    position: aspectPadding ? "absolute" : "static",
    top: 0,
    left: 0,
    border: bordered ? "1px solid #ccc" : "none",
    borderRadius: bordered ? 8 : 0,
    boxShadow: bordered
      ? "0 2px 8px rgba(0, 0, 0, 0.1)"
      : "none",
    ...imgStyle,
  };

  return (
    <div className={className} style={outer}>
      <div style={inner}>
        <img
          src={src}
          alt={alt}
          style={imgStyles}
          loading="lazy"
        />
        {caption && (
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              marginTop: 10,
              width: "100%",
            }}
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
