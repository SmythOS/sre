import React from "react";

const SvgRuntime: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
    <svg width={16} height={16} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5.661 3.025h4.682c1.6287 0 2.6374.884 2.6328 2.5083v4.93c0 1.6242-1.0093 2.5128-2.638 2.5128H5.661c-1.6236 0-2.6374-.9042-2.6374-2.5544V5.533c0-1.6242 1.0138-2.5083 2.6374-2.5083z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6986 3.0248V2M7.999 3.025v-1.025M5.299 3.025v-1.025M5.299 12.9752V14m2.7-1.025v1.025m2.7-1.025v1.025M3.025 5.2994H2m1.025 2.7h-1.025m1.025 2.7h-1.025M12.975 10.6989h1.025m-1.025-2.7h1.025m-1.025-2.7h1.025"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        clipRule="evenodd"
        d="M9.1163 5.6302h-2.23c-.7739 0-1.2572.421-1.2572 1.1948v2.33c0 .786.4833 1.2169 1.2571 1.2169h2.2275c.7765 0 1.257-.424 1.257-1.1975V6.825c0-.7738-.4785-1.1948-1.2544-1.1948z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ));

  export default SvgRuntime;