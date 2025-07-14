import React from "react";

const SvgStudio: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
  <svg
    width={16}
    height={16}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g
      clipPath="url(#studioClip)"
      transform="translate(.5 -.33)"
      stroke="currentColor"
    >
      <path
        clipRule="evenodd"
        d="M1 7.9982c0-2.6252.0281-3.5 3.5-3.5s3.5.8748 3.5 3.5.011 3.5-3.5 3.5-3.5-.8748-3.5-3.5ZM9.334 3.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333S9.334 5.5816 9.334 3.8315zM9.334 12.8315c0-1.7501.0187-2.3333 2.3333-2.3333s2.3334.5832 2.3334 2.3333c0 1.7501.0073 2.3333-2.3334 2.3333s-2.3333-.5832-2.3333-2.3333z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m7.2236 11.051 2 1M7.7764 6.051l2-1" />
      <path
        d="M3 8.4982c.8649.8056 2.1521.6859 2.8225 0"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="studioClip">
        <path fill="currentColor" transform="translate(0 .4982)" d="M0 0h16v16H0z" />
      </clipPath>
    </defs>
  </svg>
));

export default SvgStudio;
