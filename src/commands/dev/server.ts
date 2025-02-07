import { ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import logger from '../../libs/logger.js';
import path from 'path';
import t from '../../i18n/index.js';
import { getDevConf, getRoot } from '../../utils/fileUtils/index.js';

interface Props {
  command: string;
}
class WorkerServer {
  private instance: ChildProcess | null = null;
  private restarting: boolean = false;
  private command: string;
  constructor(props: Props) {
    this.command = props.command || 'deno';
    this.start();
  }

  start() {
    if (this.instance) {
      return;
    }
    const root = getRoot();
    const inspectPort = getDevConf('inspectPort', 'dev', 9229);
    // @ts-ignore
    const id = global.id || '';
    let inspectOption = '--inspect';
    if (inspectPort !== 9229) {
      inspectOption = `--inspect=127.0.0.1:${inspectPort}`;
    }
    this.instance = spawn(
      this.command,
      [
        'run',
        '--no-lock',
        '--allow-net',
        '--allow-read',
        '--allow-write',
        inspectOption,
        path.join(root, `.dev/index-${id}.js`),
        id
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    this.instance.stdout?.setEncoding('utf8');
    this.instance.stdout?.on('data', this.stdoutHandler.bind(this));
    this.instance.stderr?.on('data', this.stderrHandler.bind(this));
    this.instance.on('close', this.closeHandler.bind(this));
    this.instance.on('error', this.errorHandler.bind(this));
  }

  private stdoutHandler(chunk: any) {
    logger.log(chunk.toString().trim());
  }

  private stderrHandler(chunk: any) {
    logger.subError(chunk.toString().trim());
  }

  private errorHandler(err: any) {
    console.log(err);
    logger.error(err.message ? err.message : err);
    this.instance && this.instance.kill();
  }

  private closeHandler(
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    if (this.restarting) {
      this.restarting = false;
      return;
    }
    logger.info(t('dev_server_closed').d('Worker server closed'));
    // @ts-ignore
    global.port = undefined;
  }

  runCommand(command: string) {
    this.instance?.stdin?.write(command);
  }

  stop(): Promise<0 | 1> {
    return new Promise((resolve) => {
      if (!this.instance) {
        resolve(0);
        return;
      }

      const onExit = (code: string, signal: string) => {
        this.instance = null;
        resolve(1);
      };

      this.instance.on('exit', onExit);
      this.instance.kill('SIGTERM');
    });
  }

  async restart() {
    this.restarting = true;
    await this.stop();
    this.start();
    logger.info(t('dev_server_restart').d('Worker server restarted'));
  }
}

export default WorkerServer;
