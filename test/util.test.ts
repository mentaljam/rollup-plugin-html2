import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "node-html-parser";
import type { HTMLElement } from "node-html-parser";
import type { PluginContext } from "rollup";

import {
  appendNodeFactory,
  getChildElement,
  isChunk,
  normalizePrefix,
} from "../dist/util.js";

const pluginContextMock = {
  error(error): never {
    throw new Error(typeof error === "string" ? error : error.message);
  },
} as PluginContext

function getHtmlParts(): {
  body: HTMLElement;
  head: HTMLElement;
} {
  const document = parse("<html><head></head><body></body></html>");
  const head = document.querySelector("head");
  const body = document.querySelector("body");

  assert.ok(head);
  assert.ok(body);

  return { body, head };
}

test("getChildElement returns existing children and creates missing children", () => {
  const document = parse("<html><body></body></html>");
  const html = document.querySelector("html");

  assert.ok(html);
  assert.equal(getChildElement(html, "body").tagName, "BODY");

  const head = getChildElement(html, "head", false);
  const footer = getChildElement(html, "footer");

  assert.equal(head.tagName, "HEAD");
  assert.equal(footer.tagName, "FOOTER");
  assert.equal(html.childNodes.at(0), head);
  assert.equal(html.childNodes.at(-1), footer);
});

test("appendNodeFactory detects tags and writes expected attributes", () => {
  const { body, head } = getHtmlParts();
  const appendNode = appendNodeFactory(pluginContextMock, head, body);

  appendNode({ as: "script", rel: "preload" }, "preload.js");
  appendNode({}, "styles.css");
  appendNode({ async: true, tag: "script" }, "app.js");
  appendNode({ tag: "style", text: "body { margin: 0; }" });

  assert.ok(
    head.querySelector('link[rel="preload"][as="script"][href="preload.js"]'),
  );
  assert.ok(head.querySelector('link[rel="stylesheet"][href="styles.css"]'));
  assert.ok(body.querySelector('script[async][src="app.js"]'));
  assert.equal(head.querySelector("style")?.textContent, "body { margin: 0; }");
});

test("appendNodeFactory reports invalid external resource options", () => {
  const { body, head } = getHtmlParts();
  const appendNode = appendNodeFactory(pluginContextMock, head, body);

  assert.throws(
    () => appendNode({ tag: "link", rel: "preload" }),
    /rel` option.*preload.*no `as` option/s,
  );
  assert.throws(
    () => appendNode({ tag: "script" }),
    /One of `src`, `href`, or `text` property must be defined/,
  );
});

test("normalizePrefix", () => {
  assert.equal(normalizePrefix(), "/");
  assert.equal(normalizePrefix("assets"), "assets/");
  assert.equal(normalizePrefix("assets/"), "assets/");
});

test("isChunk", () => {
  assert.equal(isChunk({ type: "chunk" } as never), true);
  assert.equal(isChunk({ type: "asset" } as never), false);
});
