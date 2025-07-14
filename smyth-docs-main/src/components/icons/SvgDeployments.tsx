import React from "react";

const SvgDeployments: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M8.957 5.385a1.075 1.075 0 1 1 1.522 1.522 1.075 1.075 0 0 1-1.522-1.522Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.247 2.346c-3.639-.247-8.129 3.112-8.612 6.892a1.248 1.248 0 0 0 .335.868l.911.911a1.248 1.248 0 0 0 .868.335c3.78-.483 7.138-4.973 6.892-8.612a.393.393 0 0 0-.394-.394Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.947 9.219-.21 2.954a.677.677 0 0 1-.374.605l-1.636.818a.677.677 0 0 1-.945-.392l-.765-1.87M6.811 5.086l-2.955.19a.677.677 0 0 0-.608.37l-.829 1.63a.677.677 0 0 0 .385.948l1.864.778M4.908 12.34c-.18 1.2-1.584.976-2.5 1.114.138-.916-.078-2.312 1.121-2.493"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ));
export default SvgDeployments;  