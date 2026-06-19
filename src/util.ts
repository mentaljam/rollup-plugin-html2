import * as fs from "node:fs/promises";
import type { PathLike } from "node:fs";
import * as path from "node:path";
import { HTMLElement, TextNode } from "node-html-parser";
import type { OutputAsset, OutputChunk, PluginContext } from "rollup";
import type { Entry, External, TextScript } from "./index.js";

export function addNewLine(node: HTMLElement): TextNode {
  return node.appendChild(new TextNode("\n  ", node));
}

export function getChildElement(
  node: HTMLElement,
  tag: string,
  append = true,
): HTMLElement {
  let child = node.querySelector(tag);
  if (!child) {
    child = new HTMLElement(tag, {}, "", node, [-1, -1]);
    if (append) {
      node.appendChild(child);
    } else {
      node.childNodes.unshift(child);
    }
  }
  return child;
}

type NodeAppender = (
  options?: Partial<Entry | External>,
  filePath?: string,
) => void;

export function appendNodeFactory(
  context: PluginContext,
  head: HTMLElement,
  scriptParent: HTMLElement,
): NodeAppender {
  return (options = {}, filePath) => {
    // Check if `as` is set
    const asSet = "as" in options;
    // Try to detect the tag if not set
    if (!options.tag) {
      if (asSet || "rel" in options) {
        // Seems to be a link
        options.tag = "link";
      } else if (filePath) {
        // Detect from the extension
        options.tag = /.+\.m?js$/.test(filePath) ? "script" : "link";
      }
    }
    const isLink = options.tag === "link";
    if (isLink) {
      if (!asSet && options.rel === "preload") {
        context.error(
          'One or more entries or externals have the `rel` option \
set to "preload" but no `as` option defined',
        );
      }
    }
    if (filePath) {
      if (isLink) {
        options.href = filePath;
      } else {
        options.src = filePath;
      }
    } else if (!("src" in options || "href" in options || "text" in options)) {
      context.error(
        "One of `src`, `href`, or `text` property must be defined explicitly for `externals`",
      );
    }
    if (
      isLink &&
      !options.rel &&
      typeof options.href === "string" &&
      path.extname(options.href) == ".css"
    ) {
      options.rel = "stylesheet";
    }
    const { tag, text, ...attrs } = options as TextScript;
    const parent = tag === "script" ? scriptParent : head;
    addNewLine(parent);
    const entry = new HTMLElement(tag, {}, "", parent, [-1, -1]);
    for (const [key, val] of Object.entries(attrs)) {
      entry.setAttribute(key, val === true ? "" : String(val));
    }
    parent.appendChild(entry);
    if (text) {
      entry.appendChild(new TextNode(text, entry));
    }
  };
}

export function normalizePrefix(prefix = ""): string {
  return prefix.endsWith("/") ? prefix : prefix + "/";
}

export function isChunk(item: OutputAsset | OutputChunk): item is OutputChunk {
  return item.type === "chunk";
}

export async function isFile(path: PathLike): Promise<boolean> {
  try {
    const stats = await fs.lstat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}
