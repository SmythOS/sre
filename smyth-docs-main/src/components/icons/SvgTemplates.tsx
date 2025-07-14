import React from "react";

export const SvgTemplates: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
  <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      clipRule="evenodd"
      d="M2 4.333C2 2.583 2.018 2 4.333 2S6.667 2.583 6.667 4.333c0 1.75.007 2.333-2.333 2.333S2 6.083 2 4.333zM9.334 4.333C9.334 2.583 9.352 2 11.667 2S14 2.583 14 4.333c0 1.75.007 2.333-2.333 2.333S9.334 6.083 9.334 4.333zM2 11.667c0-1.75.019-2.333 2.333-2.333S6.667 9.917 6.667 11.667C6.667 13.417 6.674 14 4.333 14S2 13.417 2 11.667zM9.334 11.667c0-1.75.019-2.333 2.333-2.333S14 9.917 14 11.667c0 1.75.007 2.333-2.333 2.333S9.334 13.417 9.334 11.667z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));
export default SvgTemplates;
