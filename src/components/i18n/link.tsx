"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { localeHref } from "@/lib/i18n/store/config";
import { useLocale } from "./provider";

/**
 * Drop-in next/link that keeps the shopper in their language: string hrefs like "/products/x"
 * become "/ar/products/x" on Arabic pages. Usable from server and client components.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? localeHref(locale, href) : href} {...rest} />;
}
