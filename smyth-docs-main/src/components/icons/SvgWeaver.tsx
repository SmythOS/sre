import React from "react";

const SvgWeaver: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14 4.209c0-1.1046-.895-2-2-2H4c-1.1046 0-2 .8954-2 2v5.8555c0 1.1046.8954 2 2 2h1.4413a1 1 0 0 1 .707.293l1.145 1.145a1 1 0 0 0 1.414 0l1.145-1.145a1 1 0 0 1 .707-.293H12c1.1046 0 2-.8954 2-2z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.5 7.471-1 2.5-1.5-3.034-1.5 3.535-1.5-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.177 6.328A1.769 1.769 0 0 0 10 5.1496a1.769 1.769 0 0 0 1.177-1.1785A1.769 1.769 0 0 0 12.354 5.15 1.769 1.769 0 0 0 11.177 6.328z"
        fill="currentColor"
      />
    </svg>
  ));
  export default SvgWeaver;