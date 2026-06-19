import * as fs from "node:fs/promises";
import * as path from "node:path";
import { minify, type MinifierOptions } from "html-minifier-next";
import { HTMLElement, parse, TextNode } from "node-html-parser";
import type { OutputOptions, Plugin } from "rollup";
import {
  addNewLine,
  appendNodeFactory,
  getChildElement,
  isChunk,
  isFile,
  normalizePrefix,
} from "./util.js";

/** Configuration for an injected entry or external resource */
export interface Injected extends Record<string, unknown> {
  /** Which tag to use for injection. */
  tag?: "script" | "link" | "style";

  /**
   * Whether CORS must be used when fetching the resource.
   *
   * If the attribute is `undefined`, the resource is fetched without a CORS
   * request.
   *
   * [Details](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#crossorigin)
   */
  crossorigin?: "anonymous" | "use-credentials";

  /** The type of script represented for {@link Script} or the content linked to for {@link Link} */
  type?: string;
}

/** Injected script */
export interface Script extends Injected {
  tag: "script";
  /** Whether to add or not the `nomodule` attribute. */
  nomodule?: boolean;
}

/** Injected script with the `src` attribute set */
export interface SrcScript extends Script {
  /** A file or a link to the script. */
  src: string;
}

/** Injected script with the text child node */
export interface TextScript extends Script {
  /** Script text. */
  text: string;
}

/** Injected link */
export interface Link extends Injected {
  tag: "link";
  /** Relationship of the linked document. */
  rel?: string;
  /**
   * Specifies the type of content being loaded
   * when {@link Link.rel} is set to `"preload"` or `"prefetch"`.
   */
  as?: string;
}

/** Generated and injected entry */
export type Entry = Script | Link;

/** External (not generated) and injected link */
export interface ExternalLink extends Link {
  /** A link to the external resource. */
  href: string;
}

/** Injected style */
export interface Style extends Injected {
  tag: "style";
  /** Style text. */
  text: string;
}

/** External (not generated) and injected resource */
export type External = SrcScript | TextScript | ExternalLink | Style;

/**
 * HTML2 Plugin Options
 *
 * @category Main API
 */
export interface RollupHTML2PluginOptions {
  /**
   * A path to an HTML template file or an HTML string.
   *
   * @example
   * ```js
   * 'src/index.html'
   * ```
   *
   * @example
   * ```js
   * '<html lang="en"><head><meta charset="utf-8"></head><body></body></html>'
   * ```
   */
  template: string;

  /**
   * A file name of the resulting HTML document.
   *
   * ⚠️ Mandatory if the {@link RollupHTML2PluginOptions.template} option is set to an HTML.
   *
   * @default
   * ```js
   * path.basename(template)
   * ```
   *
   * @example
   * ```js
   * 'index.html'
   * ```
   */
  fileName?: string;

  /**
   * Defines whether to inject bundled files or not.
   * If set to `false` then bundled files are not injected.
   * If set to `"head"` or `"body"` then script tags are injected to
   * the selected element.
   *
   * @default
   * ```js
   * true
   * ```
   */
  inject?: boolean | "head" | "body";

  /**
   * Sets the title of the output HTML document.
   */
  title?: string;

  /**
   * A file path of the favicon of the output HTML document. The provided file
   * will be emitted as an asset.
   */
  favicon?: string;

  /**
   * A set of metadata of the output HTML document. The provided object is
   * handled as pairs `name: content`.
   *
   * @example
   * ```js
   * {
   *   description: 'Generated with Rollup',
   * }
   * ```
   */
  meta?: Record<string, string>;

  /**
   * A set of options for injected records, where key is the name of the
   * generated entry or chunk and value is a set of
   * [link](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
   * or [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script)
   * attributes.
   *
   * If not set then only the generated output of the input entries will be
   * inserted without additional attributes.
   *
   * If {@link Injected.tag | tag} of an entry is not set then it will be determined
   * based on other attributes and file extension.
   *
   * @example
   * ```js
   * {
   *   index: {
   *     type: 'module',
   *   },
   * }
   * ```
   */
  entries?: Record<string, Entry>;

  /**
   * An array or set of names of entries to exclude from injection.
   *
   * @example
   * ```js
   * ['worker']
   * ```
   */
  exclude?: string[] | Set<string>;

  /**
   * Arrays of additional scripts and links that will be injected to the output
   * HTML document before or after the generated entries and chunks.
   *
   * {@link Injected.tag | Tag} is mandatory.
   *
   * @example
   * ```js
   * {
   *   before: [{
   *     tag:  'link',
   *     href: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
   *     crossorigin: 'use-credentials',
   *   }],
   *   after: [{
   *     tag:  'style',
   *     text: `
   *       body {
   *         margin:  0;
   *         height:  calc(100vh - 1px);
   *         display: flex;
   *       }
   *     `,
   *   }, {
   *     tag:  'script',
   *     text: 'console.log("Hello from external code!")',
   *   }],
   * }
   * ```
   * */
  externals?: {
    before?: External[];
    after?: External[];
  };

  /**
   * [Options](https://github.com/kangax/html-minifier#options-quick-reference)
   * to pass to the [html-minifier](https://github.com/kangax/html-minifier).
   * If the options is undefined or set to `false` then the output HTML will
   * not minified.
   *
   * @example
   * ```js
   * {
   *   removeComments:     true,
   *   collapseWhitespace: true,
   *   keepClosingSlash:   true,
   * }
   * ```
   */
  minify?: false | MinifierOptions;

  /**
   * A path to append to file references injected. This is useful for putting
   * files on a CDN after building.
   *
   * @example
   * ```js
   * '//www.example.com/foo'
   * ```
   * Which will generate:
   * ```html
   * <script src="//www.example.com/foo/main.js"></script>
   * ```
   */
  onlinePath?: string;
}

/**
 * Factory for the HTML2 plugin
 *
 * @category Main API
 */
export type RollupHTML2Plugin = (options: RollupHTML2PluginOptions) => Plugin;

let templateIsFile = false;

const html2: RollupHTML2Plugin = ({
  entries = {},
  exclude = new Set(),
  externals,
  favicon,
  fileName: htmlFileName,
  inject = true,
  meta,
  minify: minifyOptions,
  onlinePath,
  template,
  title,
  ...options
}) => ({
  name: "html2",

  async buildStart(): Promise<void> {
    const deprecated = {
      preload: "entries",
      modules: "entries",
      nomodule: "entries",
    };
    for (const o of Object.keys(options)) {
      if (o in deprecated) {
        this.error(
          `The \`${o}\` option is deprecated, use \`${deprecated[o as keyof typeof deprecated]}\` instead.`,
        );
      } else {
        this.warn(`Ignoring unknown option \`${o}\``);
      }
    }

    if (externals && Array.isArray(externals)) {
      this.error("`externals` must be an object: `{before: [], after: []}`");
    }

    templateIsFile = await isFile(template);
    if (templateIsFile) {
      this.addWatchFile(template);
    } else if (!htmlFileName) {
      this.error(
        "When `template` is an HTML string the `fileName` option must be defined",
      );
    }

    if (favicon && !(await isFile(favicon))) {
      this.error("The provided favicon file does't exist");
    }

    if (typeof inject === "string" && inject !== "head" && inject !== "body") {
      this.warn(
        'Invalid `inject` must be `true | false | "head" | "body" | undefined`',
      );
      inject = true;
    }

    if (inject) {
      for (const name of exclude) {
        if (name in entries) {
          this.warn(`Excluding a configured entry "${name}"`);
        }
      }
    }

    const check = ({ tag, ...others }: Entry | External) => {
      if (tag && tag !== "link" && tag !== "script" && tag !== "style") {
        this.error(`Invalid value for the \`tag\` option: \
must be one of "link", "script" or "style"; received ${JSON.stringify(tag)}`);
      }
      const nmt = typeof others.nomodule;
      if (nmt !== "boolean" && nmt !== "undefined") {
        this.error(`Invalid value for the \`nomodule\` option: \
must be one of \`boolean\`, \`undefined\`; received ${JSON.stringify(others.nomodule)}`);
      }
    };
    for (const e of Object.values(entries)) {
      check(e);
      if ((e.tag as unknown) === "style") {
        this.error('An entry cannot have a `tag` property set to "style"');
      }
    }
    const { before = [], after = [] } = externals || {};
    before.forEach(check);
    after.forEach(check);
  },

  outputOptions({ dir, file: bundleFile, format }): null {
    if (!htmlFileName) {
      let distDir = process.cwd();
      if (dir) {
        distDir = path.resolve(distDir, dir);
      } else if (bundleFile) {
        const bundleDir = path.dirname(bundleFile);
        distDir = path.isAbsolute(bundleDir)
          ? bundleDir
          : path.resolve(distDir, bundleDir);
      }

      htmlFileName = path.basename(template);
      if (path.resolve(distDir, htmlFileName) === path.resolve(template)) {
        this.error(
          "Could't write the generated HTML to the source template, \
define one of the options: `file`, `output.file` or `output.dir`",
        );
      }
    }
    const modulesSupport = !!format && /^(esm?|module)$/.test(format);
    const checkModules = (e: Entry | External) => {
      if (e.type == "module") {
        if (e.tag === "script" && e.nomodule) {
          this.error(
            'One or more entries or externals have \
the `nomodule` option enabled and `type` set to "module"',
          );
        }
        if (!modulesSupport) {
          this.error(`One or more entries or externals have \
the \`type\` option set to "module" but the \`output.format\` \
is ${JSON.stringify(format)}, consider to use another format \
or change the \`type\``);
        }
      }
    };
    Object.values(entries).forEach(checkModules);
    const { before = [], after = [] } = externals || {};
    before.forEach(checkModules);
    after.forEach(checkModules);
    return null;
  },

  async generateBundle(output, bundle): Promise<void> {
    const data = templateIsFile
      ? await fs.readFile(template, { encoding: "utf-8" })
      : template;

    const doc = parse(data, { comment: true });
    const html = doc.querySelector("html");
    if (!html) {
      this.error("The input template does not contain the `html` tag");
    }

    const head = getChildElement(html, "head", false);
    const body = getChildElement(html, "body");

    if (meta) {
      const nodes = head.querySelectorAll("meta");
      for (const [name, content] of Object.entries(meta)) {
        const oldMeta = nodes.find((n) => n.attributes.name === name);
        const newMeta = new HTMLElement(
          "meta",
          {},
          `name="${name}" content="${content}"`,
          head,
          [-1, -1],
        );
        if (oldMeta) {
          head.exchangeChild(oldMeta, newMeta);
        } else {
          addNewLine(head);
          head.appendChild(newMeta);
        }
      }
    }

    // Inject favicons from the [rollup-plugin-favicons](https://github.com/mentaljam/rollup-plugin-favicons)
    const { __favicons_output: favicons = [] } = output as ExtendedOptions;
    for (const f of favicons) {
      head.appendChild(new TextNode(f, head));
      addNewLine(head);
    }

    if (title) {
      let node = head.querySelector("title");
      if (!node) {
        addNewLine(head);
        node = new HTMLElement("title", {}, "", head, [-1, -1]);
        head.appendChild(node);
      }
      node.set_content(title);
    }

    const prefix = normalizePrefix(onlinePath);

    const appendNode = appendNodeFactory(
      this,
      head,
      inject === "head" ? head : body,
    );

    const processExternal = (e: External) => {
      if (!e.tag) {
        this.error("`tag` property must be defined explicitly for `externals`");
      }
      appendNode(e);
    };
    const { before = [], after = [] } = externals || {};

    // Inject externals before
    before.forEach(processExternal);

    // Inject generated files
    if (inject) {
      if (Array.isArray(exclude)) {
        exclude = new Set(exclude);
      }
      for (const file of Object.values(bundle)) {
        const { name, fileName } = file;
        if (!name || !exclude.has(name)) {
          const filePath = prefix + fileName;
          const options = name ? entries[name] : undefined;
          if (options || !isChunk(file) || file.isEntry) {
            appendNode(options, filePath);
          }
        }
      }
    }

    if (favicon) {
      const nodes = head.querySelectorAll("link");
      const rel = "shortcut icon";
      const oldLink = nodes.find((n) => n.attributes.rel === rel);
      const fileName = path.basename(favicon);
      const filePath = prefix + fileName;
      const newLink = new HTMLElement(
        "link",
        {},
        `rel="${rel}" href="${filePath}"`,
        head,
        [-1, -1],
      );
      if (oldLink) {
        head.exchangeChild(oldLink, newLink);
      } else {
        addNewLine(head);
        head.appendChild(newLink);
      }
      this.emitFile({
        fileName,
        source: await fs.readFile(favicon),
        type: "asset",
      });
    }

    // Inject externals after
    after.forEach(processExternal);

    let source = doc.toString();

    if (minifyOptions) {
      source = await minify(source, minifyOptions);
    }

    // `file` has been checked in the `outputOptions` hook
    this.emitFile({
      fileName: htmlFileName,
      source,
      type: "asset",
    });
  },
});

/**
 * Interface for the extended output options
 *
 * The interface is use by the
 * [favicons plugin](https://github.com/mentaljam/rollup-plugin-favicons)
 * to pass generated tags to the HTML2 plugin.
 */
interface ExtendedOptions extends OutputOptions {
  /** Output of the `rollup-plugin-favicons` */
  __favicons_output?: string[];
}

export default html2;
