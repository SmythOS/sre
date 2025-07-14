import React from 'react';

interface ArcadeEmbedProps {
  src: string;
  title: string;
}

export default function Arcade({ src, title }: ArcadeEmbedProps) {
  return (
    <div className="arcade-wrap">
    <iframe
      className="arcade-frame"
      src={src}
      title={title}
      frameBorder="0"
      loading="lazy"
      allow="clipboard-write"
      allowFullScreen
      />
       <style>{`
        .arcade-wrap {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
        .arcade-frame {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          color-scheme: light;
          border: none;
        }
        :root[data-theme='dark'] .arcade-frame {
          color-scheme: dark;
        }
      `}</style>
    </div>
  );
}