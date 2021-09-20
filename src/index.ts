import * as fs from 'fs'
import {minify} from 'html-minifier'
import {HTMLElement, parse, TextNode} from 'node-html-parser'
import * as path from 'path'
import {
  OutputAsset,
  OutputChunk,
  PluginContext,
} from 'rollup'

import {
  Entry,
  External,
  IExtendedOptions,
  ITextScript,
  RollupPluginHTML2,
} from './types'

const addNewLine = (node: HTMLElement): TextNode => node.appendChild(new TextNode('\n  ', node))

const getChildElement = (
  node: HTMLElement,
  tag:  string,
  append = true
): HTMLElement => {
  let child = node.querySelector(tag)
  if (!child) {
    child = new HTMLElement(tag, {}, '', node)
    if (append) {
      node.appendChild(child)
    } else {
      node.childNodes.unshift(child)
    }
  }
  return child
}

const appendNodeFactory = (
  context: PluginContext,
  head:    HTMLElement,
  body:    HTMLElement,
) => (
  options:   Partial<Entry | External> = {},
  filePath?: string,
) => {
  // Check if `as` is set
  const asSet = 'as' in options
  // Try to detect the tag if not set
  if (!options.tag) {
    if (asSet || 'rel' in options) {
      // Seems to be a link
      options.tag = 'link'
    } else if (filePath) {
      // Detect from the extension
      options.tag = /.+\.m?js$/.test(filePath) ? 'script' : 'link'
    }
  }
  const isLink = options.tag === 'link'
  if (isLink) {
    if (!asSet && options.rel === 'preload') {
      context.error('One or more entries or externals have the `rel` option \
set to "preload" but no `as` option defined')
    }
  }
  if (filePath) {
    if (isLink) {
      options.href = filePath
    } else {
      options.src = filePath
    }
  } else if (!('src' in options || 'href' in options || 'text' in options)) {
    context.error('One of `src`, `href`, or `text` property must be defined explicitly for `externals`')
  }
  if (isLink && !options.rel && typeof options.href === 'string' && path.extname(options.href) == '.css') {
    options.rel = 'stylesheet'
  }
  const {tag, text, ...attrs} = (options as ITextScript)
  const attrsstr = Object.entries(attrs).reduce((prev, [key, val]) => {
    prev += key
    if (val !== true) {
      prev += '='
      prev += JSON.stringify(val)
    }
    prev += ' '
    return prev
  }, '')
  const parent = tag === 'script' ? body : head
  addNewLine(parent)
  const entry = new HTMLElement(tag, {}, attrsstr, parent)
  parent.appendChild(entry)
  if (text) {
    entry.appendChild(new TextNode(text, entry))
  }
}

const normalizePrefix = (
  prefix = '',
) => {
  if (!prefix.endsWith('/')) {
    prefix += '/'
  }
  return prefix
}

const isChunk = (item: OutputAsset | OutputChunk): item is OutputChunk => item.type === 'chunk'

const enum Cache {
  templateIsFile = 'templateIsFile',
}

const html2: RollupPluginHTML2 = ({
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
  name: 'html2',

  buildStart(): void {
    const deprecated = {
      preload:  'entries',
      modules:  'entries',
      nomodule: 'entries',
    }
    for (const o of Object.keys(options)) {
      if (o in deprecated) {
        this.error(`The \`${o}\` option is deprecated, use \`${deprecated[o as keyof typeof deprecated]}\` instead.`)
      } else {
        this.warn(`Ignoring unknown option \`${o}\``)
      }
    }

    if (externals && Array.isArray(externals)) {
      this.error('`externals` must be an object: `{before: [], after: []}`')
    }

    const templateIsFile = fs.existsSync(template)
    if (templateIsFile && fs.lstatSync(template).isFile()) {
      this.addWatchFile(template)
    } else if (!htmlFileName) {
      this.error('When `template` is an HTML string the `fileName` option must be defined')
    }
    this.cache.set(Cache.templateIsFile, templateIsFile)

    if (favicon && !(fs.existsSync(favicon) && fs.lstatSync(favicon).isFile())) {
      this.error("The provided favicon file does't exist")
    }

    if (typeof inject === 'string') {
      this.warn('Invalid `inject` must be `true`, `false` or `undefined`')
      inject = true
    }

    if (inject) {
      for (const name of exclude) {
        if (name in entries) {
          this.warn(`Excluding a configured entry "${name}"`)
        }
      }
    }

    const check = ({tag, ...others}: Entry | External) => {
      if (tag && tag !== 'link' && tag !== 'script' && tag !== 'style') {
        this.error(`Invalid value for the \`tag\` option: \
must be one of "link", "script" or "style"; received ${JSON.stringify(tag)}`)
      }
      const nmt = typeof others.nomodule
      if (nmt !== 'boolean' && nmt !== 'undefined') {
        this.error(`Invalid value for the \`nomodule\` option: \
must be one of \`boolean\`, \`undefined\`; received ${JSON.stringify(others.nomodule)}`)
      }
    }
    for (const e of Object.values(entries)) {
      check(e)
      if (e.tag as unknown === 'style') {
        this.error('An entry cannot have a `tag` property set to "style"')
      }
    }
    const {
      before = [],
      after  = [],
    } = externals || {}
    before.forEach(check)
    after.forEach(check)
  },

  outputOptions({
    dir,
    file: bundleFile,
    format,
  }): null {
    if (!htmlFileName) {
      let distDir = process.cwd()
      if (dir) {
        distDir = path.resolve(distDir, dir)
      } else if (bundleFile) {
        const bundleDir = path.dirname(bundleFile)
        distDir = path.isAbsolute(bundleDir) ? bundleDir : path.resolve(distDir, bundleDir)
      }
      // Template is always a file path
      htmlFileName = path.resolve(distDir, path.basename(template))
      if (htmlFileName === path.resolve(template)) {
        this.error(
          "Could't write the generated HTML to the source template, \
define one of the options: `file`, `output.file` or `output.dir`"
        )
      }
    }
    const modulesSupport = !!format && /^(esm?|module)$/.test(format)
    const checkModules = (e: Entry | External) => {
      if (e.type == 'module') {
        if (e.tag === 'script' && e.nomodule) {
          this.error('One or more entries or externals have \
the `nomodule` option enabled and `type` set to "module"')
        }
        if (!modulesSupport) {
          this.error(`One or more entries or externals have \
the \`type\` option set to "module" but the \`output.format\` \
is ${JSON.stringify(format)}, consider to use another format \
or change the \`type\``)
        }
      }
    }
    Object.values(entries).forEach(checkModules)
    const {
      before = [],
      after  = [],
    } = externals || {}
    before.forEach(checkModules)
    after.forEach(checkModules)
    return null
  },

  generateBundle(output, bundle): void {
    const data = this.cache.get<boolean>(Cache.templateIsFile)
      ? fs.readFileSync(template).toString()
      : template

    const doc = parse(data, {
      comment: true,
    })
    const html = doc.querySelector('html')
    if (!html) {
      this.error("The input template doesn't contain the `html` tag")
    }

    const head = getChildElement(html, 'head', false)
    const body = getChildElement(html, 'body')

    if (meta) {
      const nodes = head.querySelectorAll('meta')
      for (const [name, content] of Object.entries(meta)) {
        const oldMeta = nodes.find(n => n.attributes.name === name)
        const newMeta = new HTMLElement('meta', {}, `name="${name}" content="${content}"`, head)
        if (oldMeta) {
          head.exchangeChild(oldMeta, newMeta)
        } else {
          addNewLine(head)
          head.appendChild(newMeta)
        }
      }
    }

    // Inject favicons from the [rollup-plugin-favicons](https://github.com/mentaljam/rollup-plugin-favicons)
    const {__favicons_output: favicons = []} = output as IExtendedOptions
    for (const f of favicons) {
      head.appendChild(new TextNode(f, head))
      addNewLine(head)
    }

    if (title) {
      let node = head.querySelector('title')
      if (!node) {
        addNewLine(head)
        node = new HTMLElement('title', {}, '', head)
      }
      node.set_content(title)
    }

    const prefix = normalizePrefix(onlinePath)

    const appendNode = appendNodeFactory(this, head, body)

    const processExternal = (e: External) => {
      if (!e.tag) {
        this.error('`tag` property must be defined explicitly for `externals`')
      }
      appendNode(e)
    }
    const {
      before = [],
      after  = [],
    } = externals || {}

    // Inject externals before
    before.forEach(processExternal)

    // Inject generated files
    if (inject) {
      if (Array.isArray(exclude)) {
        exclude = new Set(exclude)
      }
      for (const file of Object.values(bundle)) {
        const {name, fileName} = file
        if (!name || !exclude.has(name)) {
          const filePath = prefix + fileName
          const options  = name ? entries[name] : undefined
          if (options || !isChunk(file) || file.isEntry) {
            appendNode(options, filePath)
          }
        }
      }
    }

    if (favicon) {
      const nodes    = head.querySelectorAll('link')
      const rel      = 'shortcut icon'
      const oldLink = nodes.find(n => n.attributes.rel === rel)
      const fileName = path.basename(favicon)
      const filePath = prefix + fileName
      const newLink  = new HTMLElement('link', {}, `rel="${rel}" href="${filePath}"`, head)
      if (oldLink) {
        head.exchangeChild(oldLink, newLink)
      } else {
        addNewLine(head)
        head.appendChild(newLink)
      }
      this.emitFile({
        fileName,
        source: fs.readFileSync(favicon),
        type:   'asset',
      })
    }

    // Inject externals after
    after.forEach(processExternal)

    let source = '<!doctype html>\n' + doc.toString()

    if (minifyOptions) {
      source = minify(source, minifyOptions)
    }

    // `file` has been checked in the `outputOptions` hook
    this.emitFile({
      fileName: path.basename(htmlFileName as string),
      source,
      type: 'asset',
    })
  },
})

export default html2
