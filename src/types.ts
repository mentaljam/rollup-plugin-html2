import {Options as MinifyOptions} from 'html-minifier'
import {OutputOptions, Plugin} from 'rollup'

/** Which tag to inject */
type InjectTag =
  | 'script'
  | 'link'
  | 'style'

/**
 * Types indicates whether CORS must be used when fetching the resource
 *
 * If the attribute is `undefined`, the resource is fetched without a CORS
 * request.
 *
 * [Details](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
 */
type Crossorigin =
  /** A cross-origin request is performed, but no credential is sent. */
  | 'anonymous'
  /** A cross-origin request is performed along with a credential sent. */
  | 'use-credentials'

/** Configuration for an injected entry or external resource */
interface IInjected extends Record<string, unknown> {
  /** Which tag to use for injection. */
  tag?:          InjectTag
  /** Whether CORS must be used when fetching the resource. */
  crossorigin?:  Crossorigin
  /** The type of script represented for [[IScript]] or the content linked to for [[ILink]] */
  type?:         string
}

/** Injected script */
interface IScript extends IInjected {
  tag:           'script'
  /** Whether to add or not the `nomodule` attribute. */
  nomodule?:     boolean
}

/** Injected script with the `src` attribute set */
interface ISrcScript extends IScript {
  /** A file or a link to the script. */
  src:           string
}

/** Injected script with the text child node */
export interface ITextScript extends IScript {
  /** Script text. */
  text:          string
}

/** External (not generated) script */
export type ExternalScript = ISrcScript | ITextScript

/** Injected link */
interface ILink extends IInjected {
  tag:           'link'
  /** Relationship of the linked document. */
  rel?:          string
  /**
   * Specifies the type of content being loaded \
   * when [[rel]] is set to `"preload"` or `"prefetch"`.
   */
  as?:           string
}

/** Generated and injected entry */
export type Entry  = IScript | ILink

/** External (not generated) and injected link */
interface IExternalLink extends ILink {
  /** A link to the external resource. */
  href: string
}

/** Injected style */
interface IStyle extends IInjected {
  tag:           'style'
  /** Style text. */
  text:          string
}

/** External (not generated) and injected resource */
export type External = ExternalScript | IExternalLink | IStyle

/** HTML2 Plugin Options */
export interface IPluginOptions {
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
  template:    string

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
  fileName?:   string

  /**
   * Defines whether to inject bundled files or not.
   * If set to `false` then bundled files are not injected.
   *
   * @default
   * ```js
   * true
   * ```
   */
  inject?:     boolean

  /**
   * Sets the title of the output HTML document.
   */
  title?:      string

  /**
   * A file path of the favicon of the output HTML document. The provided file
   * will be emitted as an asset.
   */
  favicon?:    string

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
  meta?:       Record<string, string>

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
   * If [[tag|Entry.tag]] of an entry is not set then it will be determined
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
  entries?:    Record<string, Entry>

  /**
   * An array or set of names of entries to exclude from injection.
   *
   * @example
   * ```js
   * ['worker']
   * ```
   */
  exclude?:    string[] | Set<string>

  /**
   * Arrays of additional scripts and links that will be injected to the output
   * HTML document before or after the generated entries and chunks.
   *
   * [[tag|External.tag]] is mandatory.
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
  externals?:  {
    before?: External[]
    after?:  External[]
  }

  /**
   * @deprecated Use [[entries]] instead.
   */
  preload?:    string[]

  /**
   * @deprecated Use [[entries]] instead.
   */
  modules?:    boolean

  /**
   * @deprecated Use [[entries]] instead.
   */
  nomodule?:   boolean

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
  minify?:     false | MinifyOptions

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
  onlinePath?: string
}

/** Factory for the HTML2 plugin */
export type RollupPluginHTML2 = (options: IPluginOptions) => Plugin

/**
 * Interface for the extended output options
 *
 * The interface is use by the
 * [favicons plugin](https://github.com/mentaljam/rollup-plugin-favicons)
 * to pass generated tags to the HTML2 plugin.
 */
export interface IExtendedOptions extends OutputOptions {
  /** Output of the `rollup-plugin-favicons` */
  __favicons_output?: string[]
}
