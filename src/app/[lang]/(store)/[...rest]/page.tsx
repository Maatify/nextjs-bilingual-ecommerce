import { notFound } from "next/navigation";

/** Any unknown storefront URL → the localized 404 (app/[lang]/(store)/not-found.tsx) inside the store chrome. */
export default function CatchAll(): never {
  notFound();
}
