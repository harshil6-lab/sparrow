/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_STORY_URL?: string;
  readonly VITE_FEATURE_SOLAR?: string;
  readonly VITE_LEARN_CLIP_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_COGNITO_REGION?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_DOMAIN?: string;
  readonly VITE_COGNITO_GOOGLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
