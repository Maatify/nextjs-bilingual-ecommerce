import catalog from "./catalog";
import common from "./common";
import content from "./content";
import login from "./login";
import overview from "./overview";
import products from "./products";
import reviews from "./reviews";
import sales from "./sales";
import shell from "./shell";

export const en = { common, shell, login, overview, sales, products, catalog, content, reviews };
export type AdminDict = typeof en;
