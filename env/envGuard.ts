import { currentEnv } from './target';

export function envGuard(action: string): void {
  if (currentEnv() === 'prod') {
    throw new Error(`Cannot ${action} on production.`);
  }
}
