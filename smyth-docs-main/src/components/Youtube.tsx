import React from 'react';

interface Props {
  videoId: string;
  title?: string;
}

const Youtube = ({ videoId, title = 'YouTube Video' }: Props) => {
  return (
    <div className="youtube-wrap">
    <iframe
      className="youtube-frame"
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
      ></iframe>

      <style>{`
        .youtube-wrap {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          margin: 1rem 0;
          border-radius: 8px;
          background-color: #000;
        }
        .youtube-frame {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
      `}</style>
    </div>
  );
};

export default Youtube;
