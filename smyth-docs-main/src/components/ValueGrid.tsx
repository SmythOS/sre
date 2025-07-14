import React from 'react';

interface ValueGridProps {
  children: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
}

const ValueGrid: React.FC<ValueGridProps> = ({ children, textAlign = 'left' }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '2rem',
        margin: '2rem 0',
        textAlign, // apply alignment
      }}
    >
      {children}
    </div>
  );
};

export default ValueGrid;
