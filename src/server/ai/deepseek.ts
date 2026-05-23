import type { ModelProviderConfig } from "../../shared/types.js";
import { createDeepSeekDefaultProvider, deepSeekRecommendedModels } from "../../shared/providerDefaults.js";

export function createDeepSeekDefaults(): ModelProviderConfig {
  return createDeepSeekDefaultProvider();
}

export { deepSeekRecommendedModels };
