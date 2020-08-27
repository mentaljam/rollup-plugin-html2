import * as fs from "fs";
import { minify } from "html-minifier";
import { HTMLElement, parse, TextNode } from "node-html-parser";
import * as path from "path";
import { ModuleFormat, OutputAsset, OutputChunk, PluginContext } from "rollup";

import {
  Crossorigin,
  ExternalPosition,
  IExtendedOptions,
  IExternal,
  Inject,
  InjectType,
  RollupPluginHTML2,
  PreloadChunkTypeRecord,
  InjectCSSType,
} from "./types";

const getChildElement = (node: HTMLElement, tag: string, append = true): HTMLElement => {
  let child = node.querySelector(tag);
  if (!child) {
    child = new HTMLElement(tag, {});
    if (append) {
      node.appendChild(child);
    } else {
      node.childNodes.unshift(child);
    }
  }
  return child;
};

const addNewLine = (node: HTMLElement): TextNode => node.appendChild(new TextNode("\n  "));

const normalizePrefix = (prefix = "") => {
  if (prefix && !prefix.endsWith("/")) {
    prefix += "/";
  }
  return prefix;
};

const extensionToType = (ext: InjectType | string): string | null => {
  switch (ext) {
    case ".css":
      return "style";
    case ".js":
    case ".mjs":
      return "script";
    default:
      return null;
  }
};
const isChunk = (item: OutputAsset | OutputChunk): item is OutputChunk => item.type === "chunk";

const formatSupportsModules = (f?: ModuleFormat): boolean => f === "es" || f === "esm" || f === "module";

const checkBoolean = (context: PluginContext, name: string, value: unknown): void => {
  const type = typeof value;
  if (type !== "boolean" && type !== "undefined") {
    context.error(`Invalid \`${name}\` argument: ${JSON.stringify(value)}`);
  }
};

const checkModulesOption = (
  context: PluginContext,
  name: string,
  format: ModuleFormat | undefined,
  value: boolean | undefined
): void => {
  if (value) {
    context.error(`The \`${name}\` option is set to true but the output.format is ${format as string}, \
consider to use another format or switch off the option`);
  }
};

type InjectCSSAndJS = (
  file: OutputAsset | OutputChunk,
  type: InjectType | string,
  pos?: Inject,
  crossorigin?: Crossorigin
) => void;

const injectCSSandJSFactory = (
  head: HTMLElement,
  body: HTMLElement,
  modules: boolean | undefined,
  nomodule: boolean | undefined,
  injectCssType: InjectCSSType
): InjectCSSAndJS => {
  const moduleattr = modules ? 'type="module" ' : nomodule ? "nomodule " : "";

  return (file, type, pos, crossorigin): void => {
    const cors = crossorigin ? `crossorigin="${crossorigin}" ` : "";
    if (type === "style") {
      const parent = pos === "body" ? body : head;
      addNewLine(parent);
      if (injectCssType === "link") {
        parent.appendChild(new HTMLElement("link", {}, `rel="stylesheet" ${cors}href="${file.fileName}"`));
      } else {
        if (file.type === "asset") {
          const styleEl = new HTMLElement("style", {});
          styleEl.set_content(file.source.toString());
          head.appendChild(styleEl);
        }
      }
    } else {
      const parent = pos === "head" ? head : body;
      addNewLine(parent);
      parent.appendChild(new HTMLElement("script", {}, `${moduleattr}${cors}src="${file.fileName}"`));
    }
  };
};

type ExtrenalsProcessor = (pos: ExternalPosition) => void;

const extrenalsProcessorFactory = (
  injectCSSandJS: ReturnType<typeof injectCSSandJSFactory>,
  externals?: IExternal[]
): ExtrenalsProcessor => {
  if (!externals) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }
  return (processPos) => {
    for (const { pos, file, type, crossorigin } of externals) {
      if (pos === processPos) {
        injectCSSandJS(file, type || path.extname(file.fileName).slice(1), undefined, crossorigin);
      }
    }
  };
};

const enum Cache {
  templateIsFile = "templateIsFile",
}

const html2: RollupPluginHTML2 = ({
  template,
  file: deprecatedFileOption,
  fileName: htmlFileName,
  inject,
  injectCssType,
  title,
  favicon,
  meta,
  externals,
  preload,
  exclude = [],
  modules,
  nomodule,
  minify: minifyOptions,
  onlinePath,
  ...options
}) => ({
  name: "html2",

  buildStart() {
    if (deprecatedFileOption) {
      this.error("The `file` option is deprecated, use the `fileName` instead.");
    }
    const templateIsFile = fs.existsSync(template);
    if (templateIsFile && fs.lstatSync(template).isFile()) {
      this.addWatchFile(template);
    } else if (!htmlFileName) {
      this.error("When `template` is an HTML string the `fileName` option must be defined");
    }
    this.cache.set(Cache.templateIsFile, templateIsFile);

    if (favicon && !(fs.existsSync(favicon) && fs.lstatSync(favicon).isFile())) {
      this.error("The provided favicon file does't exist");
    }

    if (typeof inject === "string" && !(inject === "head" || inject === "body")) {
      this.error("Invalid inject argument: " + (inject as string));
    }

    if (externals) {
      for (const { pos, crossorigin } of externals) {
        if (pos && pos !== "before" && pos !== "after") {
          this.error("Invalid position for the extrenal: " + (pos as string));
        }
        if (crossorigin && crossorigin !== "anonymous" && crossorigin !== "use-credentials") {
          this.error("Invalid crossorigin argument for the extrenal: " + (crossorigin as string));
        }
      }
    }

    checkBoolean(this, "modules", modules);
    checkBoolean(this, "nomodule", nomodule);

    Object.keys(options).forEach((o) => this.warn(`Ignoring unknown option "${o}"`));
  },

  outputOptions({ dir, file: bundleFile, format }): null {
    if (!htmlFileName) {
      let distDir = process.cwd();
      if (dir) {
        distDir = path.resolve(distDir, dir);
      } else if (bundleFile) {
        const bundleDir = path.dirname(bundleFile);
        distDir = path.isAbsolute(bundleDir) ? bundleDir : path.resolve(distDir, bundleDir);
      }
      // Template is always a file path
      htmlFileName = path.resolve(distDir, path.basename(template));
      if (htmlFileName === path.resolve(template)) {
        this.error(
          "Could't write the generated HTML to the source template, define one of the options: `file`, `output.file` or `output.dir`"
        );
      }
    }
    if (modules && nomodule) {
      this.error("Options `modules` and `nomodule` cannot be set at the same time");
    }
    const modulesSupport = formatSupportsModules(format);
    checkModulesOption(this, "modules", format, modules && !modulesSupport);
    checkModulesOption(this, "nomodule", format, nomodule && modulesSupport);
    return null;
  },

  generateBundle(output, bundle) {
    const data = this.cache.get<boolean>(Cache.templateIsFile)
      ? fs.readFileSync(template).toString()
      : template;

    const doc = parse(data, {
      pre: true,
      script: true,
      style: true,
    }) as HTMLElement & { valid: boolean };
    if (!doc.valid) {
      this.error("Error parsing template");
    }

    const html = doc.querySelector("html");
    if (!html) {
      this.error("The input template doesn't contain the `html` tag");
    }

    const head = getChildElement(html, "head", false);
    const body = getChildElement(html, "body");

    if (meta) {
      const nodes = head.querySelectorAll("meta");
      Object.entries(meta).forEach(([name, content]) => {
        const oldMeta = nodes.find((n) => n.attributes.name === name);
        const newMeta = new HTMLElement("meta", {}, `name="${name}" content="${content}"`);
        if (oldMeta) {
          head.exchangeChild(oldMeta, newMeta);
        } else {
          addNewLine(head);
          head.appendChild(newMeta);
        }
      });
    }

    const { __favicons_output: favicons = [] } = output as IExtendedOptions;
    favicons.forEach((f) => {
      head.appendChild(new TextNode(f));
      addNewLine(head);
    });

    if (title) {
      let node = head.querySelector("title");
      if (!node) {
        addNewLine(head);
        node = new HTMLElement("title", {});
        head.appendChild(node);
      }
      node.set_content(title);
    }

    if (favicon) {
      const nodes = head.querySelectorAll("link");
      const rel = "shortcut icon";
      const oldLink = nodes.find((n) => n.attributes.rel === rel);
      const fileName = path.basename(favicon);
      const newLink = new HTMLElement("link", {}, `rel="${rel}" href="${fileName}"`);
      if (oldLink) {
        head.exchangeChild(oldLink, newLink);
      } else {
        addNewLine(head);
        head.appendChild(newLink);
      }
      this.emitFile({
        fileName,
        source: fs.readFileSync(favicon),
        type: "asset",
      });
    }

    const injectCSSandJS = injectCSSandJSFactory(head, body, modules, nomodule, injectCssType);
    const processExternals = extrenalsProcessorFactory(injectCSSandJS, externals);

    // Inject externals before
    processExternals("before");

    // Inject generated files
    if (inject !== false) {
      const files = Object.values(bundle);
      const prefix = normalizePrefix(onlinePath);
      // Now process all files and inject only entries and preload files
      files.forEach((file) => {
        const { fileName } = file;
        const { ext } = path.parse(fileName);
        const filePath = prefix + fileName;

        const entryType = extensionToType(ext);
        if (!isChunk(file)) {
          if (entryType) injectCSSandJS(file, entryType, inject);
          return;
        }
        const { name } = file;
        if (file.isEntry && entryType && !exclude.includes(name)) {
          injectCSSandJS(file, entryType, inject);
        }
        if (!preload) return;
        let normalizedPreload: PreloadChunkTypeRecord = {};
        if (Array.isArray(preload)) {
          preload.forEach(({ name, type, rel }) => {
            normalizedPreload[name] = { type, rel };
          });
        } else normalizedPreload = preload;

        if (name in normalizedPreload) {
          const { rel, type } = normalizedPreload[name];
          addNewLine(head);
          head.appendChild(new HTMLElement("link", {}, `rel="${rel}" href="${filePath}" as="${type}"`));
        }
      });
    }
    // Inject externals after
    processExternals("after");

    let source = "<!doctype html>\n" + doc.toString();

    if (minifyOptions) {
      source = minify(source, minifyOptions);
    }

    // `file` has been checked in the `outputOptions` hook
    this.emitFile({
      fileName: path.basename(htmlFileName as string),
      source,
      type: "asset",
    });
  },
});

export default html2;
