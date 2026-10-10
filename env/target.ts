export type AppEnv = 'dev' | 'prod';

export type TargetSettings = {
  APP_ENV?: string;
  BASE_URL?: string;
  LOCAL_SANDBOX_DIR?: string;
};

export type Target = Readonly<{ name: AppEnv; baseURL: string }>;

const addresses: Record<AppEnv, string> = {
  dev: 'https://dev.ai-orchestration-courses.com',
  prod: 'https://ai-orchestration-courses.com',
};

export function resolveTarget(settings: TargetSettings = process.env): Target {
  if (settings.LOCAL_SANDBOX_DIR !== undefined) {
    throw new Error('LOCAL_SANDBOX_DIR is not supported.');
  }

  const name = settings.APP_ENV === undefined ? 'dev' : settings.APP_ENV;
  if (name !== 'dev' && name !== 'prod') {
    throw new Error('APP_ENV must be exactly dev or prod.');
  }

  const baseURL = addresses[name];
  if (settings.BASE_URL !== undefined && settings.BASE_URL !== baseURL) {
    throw new Error('BASE_URL must exactly match the selected course address.');
  }

  return { name, baseURL };
}

let pinned: Target | undefined;

export function getTarget(): Target {
  const selected = resolveTarget();
  if (pinned === undefined) {
    pinned = Object.freeze(selected);
  } else if (pinned.name !== selected.name || pinned.baseURL !== selected.baseURL) {
    throw new Error('The target changed during this process. Start a new process.');
  }
  return pinned;
}

export function currentEnv(): AppEnv {
  return getTarget().name;
}
