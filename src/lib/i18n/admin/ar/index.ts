import type { Widen } from "../core";
import type { AdminDict } from "../en";
import catalog from "./catalog";
import common from "./common";
import content from "./content";
import login from "./login";
import overview from "./overview";
import products from "./products";
import reviews from "./reviews";
import sales from "./sales";
import shell from "./shell";

export const ar: Widen<AdminDict> = { common, shell, login, overview, sales, products, catalog, content, reviews };
