import path from 'path';
import { createEdgeRoutine } from '../commands/commit/index.js';
import { displaySelectSpec } from '../commands/deploy/index.js';
import { ApiService } from '../libs/apiService.js';
import { readEdgeRoutineFile } from './fileUtils/index.js';
import { GetRoutineReq } from '../libs/interface.js';
import logger from '../libs/logger.js';
import t from '../i18n/index.js';
import prodBuild from '../commands/commit/prodBuild.js';
import { exit } from 'process';
import chalk from 'chalk';

export async function isRoutineExist(name: string) {
  const server = await ApiService.getInstance();
  const req: GetRoutineReq = { Name: name };
  const response = await server.getRoutine(req, false);
  return !!response;
}

export async function validRoutine(name: string) {
  const isCreatedRoutine = await isRoutineExist(name);
  if (!isCreatedRoutine) {
    logger.warn(
      `${t('routine_not_exist').d(
        'Routine does not exist, please create a new one. Run command:'
      )} ${chalk.greenBright('esa deploy')}`
    );
    exit(0);
  }
}

export async function checkRoutineExist(name: string, entry?: string) {
  const isCreatedRoutine = await isRoutineExist(name);
  if (!isCreatedRoutine) {
    logger.log(
      t('first_deploy').d(
        'This is the first time to deploy, we will create a new routine for you.'
      )
    );

    const entryFile = path.resolve(entry ?? '', 'src/index.js');
    await prodBuild(false, entryFile, entry);
    const code = readEdgeRoutineFile(entry) || '';
    const server = await ApiService.getInstance();
    const specList = await server.listRoutineSpecs();
    const spec = await displaySelectSpec(specList?.data.Specs ?? []);
    await createEdgeRoutine({
      name: name,
      specName: spec,
      code: code
    });
  }
}
