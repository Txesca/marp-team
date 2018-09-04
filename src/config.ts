import { Marp } from '@marp-team/marp-core'
import cosmiconfig from 'cosmiconfig'
import osLocale from 'os-locale'
import { ConverterOption, ConvertType } from './converter'
import resolveEngine, { ResolvableEngine } from './engine'
import { CLIError } from './error'

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type Overwrite<T, U> = Omit<T, Extract<keyof T, keyof U>> & U

export interface IMarpCLIArguments {
  allowLocalFiles?: boolean
  configFile?: string
  engine?: string
  html?: boolean
  output?: string
  pdf?: boolean
  template?: string
  theme?: string
}

export type IMarpCLIConfig = Overwrite<
  Omit<IMarpCLIArguments, 'configFile'>,
  {
    engine?: ResolvableEngine
    html?: ConverterOption['html']
    lang?: string
    options?: ConverterOption['options']
  }
>

export class MarpCLIConfig {
  args: IMarpCLIArguments = {}
  conf: IMarpCLIConfig = {}
  confPath?: string

  static moduleName = 'marp'

  static async fromArguments(args: IMarpCLIArguments) {
    const conf = new MarpCLIConfig()
    conf.args = args

    await conf.loadConf(args.configFile)
    return conf
  }

  async converterOption(): Promise<ConverterOption> {
    const engine = await (async () => {
      if (this.args.engine) return resolveEngine(this.args.engine)
      if (this.conf.engine)
        return resolveEngine(this.conf.engine, this.confPath)

      return resolveEngine(Marp)
    })()

    const output = this.args.output || this.conf.output

    return {
      output,
      allowLocalFiles:
        this.pickDefined(
          this.args.allowLocalFiles,
          this.conf.allowLocalFiles
        ) || false,
      engine: engine.klass,
      html: this.pickDefined(this.args.html, this.conf.html),
      lang: this.conf.lang || (await osLocale()).replace(/[_@]/g, '-'),
      options: this.conf.options || {},
      readyScript: engine.browserScript
        ? `<script defer>${engine.browserScript}</script>`
        : undefined,
      template: this.args.template || this.conf.template || 'bespoke',
      theme: this.args.theme || this.conf.theme,
      type:
        this.args.pdf ||
        this.conf.pdf ||
        `${output}`.toLowerCase().endsWith('.pdf')
          ? ConvertType.pdf
          : ConvertType.html,
    }
  }

  private pickDefined<T>(...args: T[]): T | undefined {
    return args.find(v => v !== undefined)
  }

  private async loadConf(confPath?: string) {
    const explorer = cosmiconfig(MarpCLIConfig.moduleName)

    try {
      const ret = await (confPath === undefined
        ? explorer.search()
        : explorer.load(confPath))

      if (ret) {
        this.confPath = ret.filepath
        this.conf = ret.config
      }
    } catch (e) {
      throw new CLIError(
        [
          'Could not find or parse configuration file.',
          e.name !== 'Error' && `(${e.name})`,
          confPath !== undefined && `[${confPath}]`,
        ]
          .filter(m => m)
          .join(' ')
      )
    }
  }
}

export default MarpCLIConfig.fromArguments
