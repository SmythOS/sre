import React from 'react';
interface ButtonProps {
  href: string;
  title: string;
  description?: string;
  marginTop?: number;
}

const Button = ({ href, title, description, marginTop = 0 }: ButtonProps) => {
  return (
    <div className="smy-button-wrapper" style={{ marginTop }}>
    <a className="smy-button" href={href}>
      <div> <span className="smy-button-title">{title}</span>
          {description && <span className="smy-button-desc">{description}</span>}
        </div>
      </a>

      <style>{`
        .smy-button-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .smy-button {
          flex: 1;
          display: flex;
          align-items: center;
          padding: 20px;
          text-decoration: none;
          color: #08B68F;
          background-color: #ffffff;
          border: 2px solid #08B68F;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: system-ui, sans-serif;
        }
        .smy-button:hover {
          background-color: #08B68F;
          color: #ffffff;
        }
        .smy-button-title {
          font-weight: bold;
          font-size: 1.25rem;
          display: block;
        }
        .smy-button-desc {
          font-weight: 300;
          font-size: 0.875rem;
          display: block;
        }
        :root[data-theme='dark'] .smy-button {
          background-color: #1e293b;
          border-color: #3efcc2;
          color: #3efcc2;
        }
        :root[data-theme='dark'] .smy-button:hover {
          background-color: #3efcc2;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
};

export default Button;