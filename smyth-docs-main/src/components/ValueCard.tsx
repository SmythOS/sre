import React from 'react';

export interface ValueCardProps {
  title: string;
  description: string;
  highlightColor?: string; 
}

const ValueCard: React.FC<ValueCardProps> = ({
  title,
  description,
  highlightColor = '#3efcc2', // YHellow -> #ffff00
}) => {
  return (
    <div
      style={{
        padding: '1rem',
        margin: '0.5rem 0',
        fontFamily: 'sans-serif',
      }}
    >
      <h3
        style={{
          fontWeight: 'bold',
          display: 'inline',
          backgroundColor: highlightColor,
          padding: '0 0.25rem',
          borderRadius: '4px',
        }}
      >
        {title}
      </h3>
      <p style={{ marginTop: '0.75rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
        {description}
      </p>
    </div>
  );
};

export default ValueCard;
