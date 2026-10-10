import type { AppEnv } from './target';
import { currentEnv } from './target';

type SkippableTest = {
  skip: (condition: boolean, reason: string) => void;
};

export function runIfEnv(test: SkippableTest, allowed: readonly AppEnv[]): void {
  const selected = currentEnv();
  test.skip(
    !allowed.includes(selected),
    `This test allows ${allowed.join(', ')}; selected environment is ${selected}.`,
  );
}
