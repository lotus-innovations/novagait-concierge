import fs from "node:fs";
import path from "node:path";

/**
 * Knowledge base loader. Reads every markdown file in kb/ once per process
 * and exposes them as titled documents. The kb/ directory is included in the
 * serverless bundle via outputFileTracingIncludes in next.config.ts.
 */

export interface KbDoc {
  /** Stable id derived from the filename, e.g. "insurance-faq". */
  id: string;
  /** Human-readable title from the first `# ` heading, e.g. "Insurance FAQ". */
  title: string;
  /** Full markdown body. */
  content: string;
}

let cache: KbDoc[] | null = null;

export function loadKb(dir = path.join(process.cwd(), "kb")): KbDoc[] {
  if (cache) return cache;
  const docs: KbDoc[] = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const heading = content.match(/^#\s+(.+)$/m);
    docs.push({
      id: file.replace(/\.md$/, ""),
      title: heading ? heading[1].trim() : file,
      content,
    });
  }
  cache = docs;
  return docs;
}

export function __resetKbCacheForTests() {
  cache = null;
}
