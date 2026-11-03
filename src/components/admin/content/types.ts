/** Shapes shared between src/server/queries/content.ts and the client editors. */
export interface LinkTarget {
  group: "Store" | "Collections" | "Pages" | "Products";
  label: string;
  /** Arabic name when the merchant translated it (shown in the Arabic dashboard) */
  labelAr?: string;
  href: string;
  image?: string;
}

export interface ProductOption {
  id: string;
  title: string;
  image: string;
  price: number;
  status: string;
}
