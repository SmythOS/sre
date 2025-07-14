// src/theme/Navbar/Content/index.tsx

import React from "react";

// We no longer import any default items from themeConfig.navbar.items.
// We simply return {children} so that our swizzled Navbar/index.tsx can 
// pass in the HeaderSubmenu directly.

export default function NavbarContent({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
