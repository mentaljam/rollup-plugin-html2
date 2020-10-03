import { Options as MinifyOptions } from "html-minifier";
import { OutputOptions, Plugin, OutputAsset } from "rollup";

/** Where to inject entries */
export type Inject =
  /** Inject to the `<head>` tag. */
  | "head"
  /** Inject to the `<body>` tag. */
  | "body";

/** Which type of file is injected */
export type InjectType = "script" | "style";
/** Where to insert the external */
export type ExternalPosition =
  /** Insert before generated entries. */
  | "before"
  /** Insert after generated entries. */
  | "after";

export type PreloadChunkTypeRecord = Record<
  string,
  {
    rel: "module" | "preload" | "modulepreload";
    type: InjectType;
  }
>;
export type PreloadChunkTypeArray = {
  name: string;
  rel: "module" | "preload" | "modulepreload";
  type: InjectType;
}[];
export type PreloadChunk = PreloadChunkTypeArray | PreloadChunkTypeRecord;
/**
 * Types indicates whether CORS must be used when fetching the resource
 *
 * If the attribute is `undefined`, the resource is fetched without a CORS
 * request.
 *
 * [Details](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
 */
export type Crossorigin =
  /** A cross-origin request is performed, but no credential is sent. */
  | "anonymous"
  /** A cross-origin request is performed along with a credential sent. */
  | "use-credentials";

/** An external resource configuration */
export interface IExternal {
  /** Whether CORS must be used when fetching the resource. */
  crossorigin?: Crossorigin;
  /** A file or a link to the resource. */
  file: OutputAsset;
  /** Where to insert the external. */
  pos: ExternalPosition;
  /** Which type of file is inserted. */
  type?: InjectType;
}
export type InjectCSSType = "style" | "link" | undefined;
/** HTML2 Plugin Options */
interface IPluginOptions {
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
   * ⚠️ Mandatory if the [[template]] option is set to an HTML.
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
   * @deprecated Use [[fileName]] instead.
   */
  file?: string;

  /**
   * Defines where to inject bundled files. If `undefined` then links to CSS
   * files are injected to the `<head>` and scripts are injected to the
   * `<body>`. If set to `false` then bundled files are not injected.
   */
  inject?: false | Inject;

  /**
   * Sets how file should be injected: in <style> attribute or in link to file
   */
  injectCssType?: InjectCSSType;
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
   * An array of additional files that will be injected to the output HTML
   * document. Only CSS and JS files are accepted. The optional
   * [[type|IExternal.type]] property points which type of file is injected.
   * If type is `undefined` then it is detected based on the file extension.
   * The [[pos|IExternal.pos]] property points when the file is inserted:
   * before processing the bundled files or after. The optional
   * [[crossorigin|IExternal.crossorigin]] property points whether to place
   * the CORS attribute to the generated tag.
   *
   * @example
   * ```js
   * [{
   *   file: 'https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css',
   *   pos:  'before',
   * }]
   * ```
   * */
  externals?: IExternal[];

  /**
   * An array or a set of names of dynamic chunks that will be injected to the
   * output HTML document as preload links.
   *
   * @example
   * ```js
   * ['lib']
   * ```
   */
  preload?: PreloadChunk;

  /**
   * Inject entries as modules. This only works if the output format supports
   * modules.
   *
   * ⚠️ Either [[modules]] or [[nomodule]] can be set at the same time.
   */
  modules?: boolean;

  /**
   * Add the `nomodule` attribute to the injected entries. This only works if
   * the output format does not support modules.
   *
   * ⚠️ Either [[modules]] or [[nomodule]] can be set at the same time.
   */
  nomodule?: boolean;

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
  minify?: false | MinifyOptions;

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

  exclude?: string[];
}

/** Factory for the HTML2 plugin */
export type RollupPluginHTML2 = (options: IPluginOptions) => Plugin;

/**
 * Interface for the extended output options
 *
 * The interface is use by the
 * [favicons plugin](https://github.com/mentaljam/rollup-plugin-favicons)
 * to pass generated tags to the HTML2 plugin.
 */
export interface IExtendedOptions extends OutputOptions {
  /** Output of the `rollup-plugin-favicons` */
  __favicons_output?: string[];
}
