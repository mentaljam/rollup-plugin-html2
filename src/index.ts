import * as fs from 'fs'
import {minify} from 'html-minifier'
import {HTMLElement, parse, TextNode} from 'node-html-parser'
import * as path from 'path'
import {
  ModuleFormat,
  OutputAsset,
  OutputChunk,
  PluginContext,
} from 'rollup'

import {
  Crossorigin,
  ExternalPosition,
  IExtendedOptions,
  IExternal,
  Inject,
  InjectType,
  RollupPluginHTML2,
  PreloadChunk,
} from './types'


const getChildElement = (
  node: HTMLElement,
  tag: string,
  append = true,
): HTMLElement => {
  let child = node.querySelector(tag)
  if (!child) {
    child = new HTMLElement(tag, {})
    if (append) {
      node.appendChild(child)
    } else {
      node.childNodes.unshift(child)
    }
  }
  return child
}

const addNewLine = (node: HTMLElement): TextNode => node.appendChild(new TextNode('\n  '))

const normalizePrefix = (
  prefix = '',
) => {
  if (prefix && !prefix.endsWith('/')) {
    prefix += '/'
  }
  return prefix
}

const extensionToType = (
  ext: InjectType | string,
): string | null => {
  switch (ext) {
    case 'css': return 'style'
    case 'js' : return 'script'
    default   : return null
  }
}

interface IReducesBundle {
  entries:        Record<string, string>
  dynamicEntries: Record<string, string>
}

const isChunk = (item: OutputAsset | OutputChunk): item is OutputChunk => (
  item.type === 'chunk'
)

function getEntries(files: (OutputAsset | OutputChunk)[], preload: PreloadChunk[]) { 
  const bundleReducer = (
    prev: IReducesBundle,
    cur: OutputAsset | OutputChunk,
  ): IReducesBundle => {
    if (isChunk(cur)) {
      // Use full name with possible hash and without extension to process
      // possible CSS files and other assets with same name of entry
      const {name} = path.parse(cur.fileName)
      if (cur.isEntry) {
        prev.entries[name] = cur.name
      } else if (cur.isDynamicEntry || preload.find(x => x.name === cur.name)) {
        prev.dynamicEntries[name] = cur.name
      }
    }
    return prev
  }
  return files.reduce(bundleReducer,{
    dynamicEntries: {},
    entries: {},
  } as IReducesBundle);
}


const formatSupportsModules = (
  f?: ModuleFormat,
): boolean => (
     f === 'es'
  || f === 'esm'
  || f === 'module'
)

const checkEnum = <T, E extends Record<string, T>>(
  enumobj: E,
  val?: T,
): boolean => (
  !val || Object.values(enumobj).includes(val)
)

const checkBoolean = (
  context: PluginContext,
  name:    string,
  value:   unknown,
): void => {
  const type = typeof value
  if (type !== 'boolean' && type !== 'undefined') {
    context.error(`Invalid \`${name}\` argument: ${JSON.stringify(value)}`)
  }
}

const checkModulesOption = (
  context: PluginContext,
  name:    string,
  format:  ModuleFormat | undefined,
  value:   boolean | undefined,
): void => {
  if (value) {
    context.error(`The \`${name}\` option is set to true but the output.format is ${format as string}, \
consider to use another format or switch off the option`)
  }
}

type InjectCSSAndJS = (
  fileName:     string,
  type:         InjectType | string,
  pos?:         Inject,
  crossorigin?: Crossorigin,
) => void

const injectCSSandJSFactory = (
  head:     HTMLElement,
  body:     HTMLElement,
  modules:  boolean | undefined,
  nomodule: boolean | undefined,
): InjectCSSAndJS => {
  const moduleattr =
      modules  ? 'type="module" '
    : nomodule ? 'nomodule '
    : ''

  return (
    fileName,
    type,
    pos,
    crossorigin,
  ): void => {
    const cors = crossorigin ? `crossorigin="${crossorigin}" ` : ''
    if (type === InjectType.css) {
      const parent = pos === Inject.body ? body : head
      addNewLine(parent)
      parent.appendChild(new HTMLElement('link', {}, `rel="stylesheet" ${cors}href="${fileName}"`))
    } else {
      const parent = pos === Inject.head ? head : body
      addNewLine(parent)
      parent.appendChild(new HTMLElement('script', {}, `${moduleattr}${cors}src="${fileName}"`))
    }
  }
}

type ExtrenalsProcessor = (pos: ExternalPosition) => void

const extrenalsProcessorFactory = (
  injectCSSandJS: ReturnType<typeof injectCSSandJSFactory>,
  externals?: IExternal[],
): ExtrenalsProcessor => {
  if (!externals) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return (): void => {}
  }
  return (processPos): void => {
    for (const {pos, file, type, crossorigin} of externals) {
      if (pos === processPos) {
        injectCSSandJS(file, type || path.extname(file).slice(1), undefined, crossorigin)
      }
    }
  }
}

const enum Cache {
  templateIsFile = 'templateIsFile',
}

const html2: RollupPluginHTML2 = ({
  template,
  file: deprecatedFileOption,
  fileName: htmlFileName,
  inject,
  title,
  favicon,
  meta,
  externals,
  preload = [],
  modules,
  nomodule,
  minify: minifyOptions,
  onlinePath,
  ...options
}) => ({
  name: 'html2',

  buildStart(): void {
    if (deprecatedFileOption) {
      this.error('The `file` option is deprecated, use the `fileName` instead.')
    }
    const templateIsFile = fs.existsSync(template)
    if (templateIsFile && fs.lstatSync(template).isFile()) {
      this.addWatchFile(template)
    } else if (!htmlFileName) {
      this.error('When `template` is an HTML string the `fileName` option must be defined')
    }
    this.cache.set(Cache.templateIsFile, templateIsFile)

    if (favicon && !(fs.existsSync(favicon) && fs.lstatSync(favicon).isFile())) {
      this.error('The provided favicon file does\'t exist')
    }

    if (typeof inject === 'string' && !(inject === Inject.head || inject === Inject.body)) {
      this.error('Invalid inject argument: ' + (inject as string))
    }

    if (externals) {
      for (const {pos, crossorigin} of externals) {
        if (!checkEnum(ExternalPosition, pos)) {
          this.error('Invalid position for the extrenal: ' + pos)
        }
        if (!checkEnum(Crossorigin, crossorigin)) {
          this.error('Invalid crossorigin argument for the extrenal: ' + (crossorigin as string))
        }
      }
    }

    checkBoolean(this, 'modules',  modules)
    checkBoolean(this, 'nomodule', nomodule)

    Object.keys(options).forEach(o => this.warn(`Ignoring unknown option "${o}"`))
  },

  outputOptions({dir, file: bundleFile, format}): null {
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
        this.error('Could\'t write the generated HTML to the source template, define one of the options: `file`, `output.file` or `output.dir`')
      }
    }
    if (modules && nomodule) {
      this.error('Options `modules` and `nomodule` cannot be set at the same time')
    }
    const modulesSupport = formatSupportsModules(format)
    checkModulesOption(this, 'modules',  format, modules  && !modulesSupport)
    checkModulesOption(this, 'nomodule', format, nomodule && modulesSupport)
    return null
  },

  generateBundle(output, bundle): void {
    const data = this.cache.get<boolean>(Cache.templateIsFile)
      ? fs.readFileSync(template).toString()
      : template

    const doc = parse(data, {
      pre: true,
      script: true,
      style: true,
    }) as HTMLElement & {valid: boolean}
    if (!doc.valid) {
      this.error('Error parsing template')
    }

    const html = doc.querySelector('html')
    if (!html) {
      this.error('The input template doesn\'t contain the `html` tag')
    }

    const head = getChildElement(html, 'head', false)
    const body = getChildElement(html, 'body')

    if (meta) {
      const nodes = head.querySelectorAll('meta')
      Object.entries(meta).forEach(([name, content]) => {
        const oldMeta = nodes.find(n => n.attributes.name === name)
        const newMeta = new HTMLElement('meta', {}, `name="${name}" content="${content}"`)
        if (oldMeta) {
          head.exchangeChild(oldMeta, newMeta)
        } else {
          addNewLine(head)
          head.appendChild(newMeta)
        }
      })
    }

    const {__favicons_output: favicons = []} = output as IExtendedOptions
    favicons.forEach(f => {
      head.appendChild(new TextNode(f))
      addNewLine(head)
    })

    if (title) {
      let node = head.querySelector('title')
      if (!node) {
        addNewLine(head)
        node = new HTMLElement('title', {})
        head.appendChild(node)
      }
      node.set_content(title)
    }

    if (favicon) {
      const nodes = head.querySelectorAll('link')
      const rel = 'shortcut icon'
      const oldLink = nodes.find(n => n.attributes.rel === rel)
      const fileName = path.basename(favicon)
      const newLink = new HTMLElement('link', {}, `rel="${rel}" href="${fileName}"`)
      if (oldLink) {
        head.exchangeChild(oldLink, newLink)
      } else {
        addNewLine(head)
        head.appendChild(newLink)
      }
      this.emitFile({
        fileName,
        source: fs.readFileSync(favicon),
        type: 'asset',
      })
    }

    const injectCSSandJS   = injectCSSandJSFactory(head, body, modules, nomodule)
    const processExternals = extrenalsProcessorFactory(injectCSSandJS, externals)

    // Inject externals before
    processExternals(ExternalPosition.before)

    // Inject generated files
    if (inject !== false) {
      const files = Object.values(bundle)
      // First of all get entries
      const { entries, dynamicEntries } = getEntries(files, preload);
      // Now process all files and inject only entries and preload files
      const prefix = normalizePrefix(onlinePath)
      files.forEach(({fileName}) => {
        const {name, ext} = path.parse(fileName)
        const injectType  = ext.slice(1)
        const filePath    = prefix + fileName
        if (name in entries) {
          injectCSSandJS(filePath, injectType, inject)
        } else if (name in dynamicEntries) {
          const preloadChunk = preload.find(x => x.name === name);
          if (preloadChunk) {
            if (!['module', 'preload', 'modulepreload'].includes(preloadChunk.type)) { 
              this.error('Preload type should be "module", "preload", "modulepreload"!');
            }
            const linkType = extensionToType(injectType)
            if (linkType) {
              addNewLine(head)
              head.appendChild(new HTMLElement('link', {}, `rel="${preloadChunk.type}" href="${filePath}" as="${linkType}"`))
            }
          }
        }
      })
    }

    // Inject externals after
    processExternals(ExternalPosition.after)

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
