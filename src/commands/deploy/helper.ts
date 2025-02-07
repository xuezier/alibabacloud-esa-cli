import SelectItems, { SelectItem } from '../../components/selectInput.js';
import { yesNoPrompt } from '../../components/yesNoPrompt.js';
import {
  CodeVersionProps,
  CreateRoutineReq,
  GetRoutineReq,
  PublishType
} from '../../libs/interface.js';
import { ApiService } from '../../libs/apiService.js';
import { descriptionInput } from '../../components/descriptionInput.js';
import { readEdgeRoutineFile } from '../../utils/fileUtils/index.js';
import { displaySelectSpec } from './index.js';
import {
  createEdgeRoutine,
  releaseOfficialVersion,
  uploadEdgeRoutineCode
} from '../commit/index.js';
import logger from '../../libs/logger.js';
import t from '../../i18n/index.js';
import { ProjectConfig } from './../../utils/fileUtils/interface.js';
import prodBuild from '../commit/prodBuild.js';

export function yesNoPromptAndExecute(
  message: string,
  execute: () => Promise<boolean>
): Promise<boolean> {
  return new Promise((resolve) => {
    yesNoPrompt(async (item: SelectItem) => {
      if (item.value === 'yes') {
        const result = await execute();
        resolve(result);
      } else {
        resolve(false);
      }
    }, message);
  });
}

export function promptSelectVersion(versionList: CodeVersionProps[]) {
  const items = versionList
    .filter((version) => version.CodeVersion !== 'unstable')
    .map((version, index) => ({
      label: version.CodeVersion,
      value: String(index)
    }));
  return new Promise<string>((resolve) => {
    const handleSelection = async (item: SelectItem) => {
      resolve(item.label);
    };

    SelectItems({ items, handleSelect: handleSelection });
  });
}

export function displaySelectDeployType(): Promise<PublishType> {
  logger.log(
    `📃 ${t('deploy_env_select_description').d('Please select which environment you want to deploy')}`
  );
  const selectItems: SelectItem[] = [
    { label: t('deploy_env_staging').d('Staging'), value: PublishType.Staging },
    {
      label: t('deploy_env_production').d('Production'),
      value: PublishType.Production
    },
    { label: t('deploy_env_canary').d('Canary'), value: PublishType.Canary }
  ];
  return new Promise<PublishType>((resolve) => {
    const handleSelection = async (item: SelectItem) => {
      resolve(item.value as PublishType);
    };
    SelectItems({ items: selectItems, handleSelect: handleSelection });
  });
}

export async function createAndDeployVersion(
  projectConfig: ProjectConfig,
  createUnstable = false,
  customEntry?: string
) {
  try {
    const server = await ApiService.getInstance();

    const description = await descriptionInput(
      createUnstable
        ? `🖊️ ${t('deploy_description_routine').d('Enter the description of the routine')}:`
        : `🖊️ ${t('deploy_description_version').d('Enter the description of the code version')}:`,
      false
    );
    await prodBuild(false, customEntry);
    const code = readEdgeRoutineFile();

    const specList = await server.listRoutineSpecs();
    let specName;
    if (createUnstable) {
      specName = await displaySelectSpec(specList?.data.Specs ?? []);
    } else {
      const req: GetRoutineReq = { Name: projectConfig.name ?? '' };
      const response = await server.getRoutine(req);
      specName = response?.data.Envs[0].SpecName ?? '50ms';
    }

    const edgeRoutine: CreateRoutineReq = {
      name: projectConfig.name,
      code: code || '',
      description: description,
      specName: specName
    };

    if (createUnstable) {
      return await createEdgeRoutine(edgeRoutine);
    } else {
      const uploadResult = await uploadEdgeRoutineCode(edgeRoutine);
      if (!uploadResult) {
        return false;
      }
      return await releaseOfficialVersion(edgeRoutine);
    }
  } catch (error) {
    logger.error(`
      ${t('deploy_error').d(
        'An error occurred during the creation or publishing process'
      )}: ${error}`);
    return false;
  }
}
