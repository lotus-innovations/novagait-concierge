/** esbuild loads .css as text (scripts/build-widget.mjs); type it as string. */
declare module "*.css" {
  const content: string;
  export default content;
}
