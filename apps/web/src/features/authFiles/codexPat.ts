import { apiCallApi } from '@/services/api/apiCall';
import { createScopedApiRequestConfig, type ApiClientRequestScope } from '@/services/api/client';
import { getDefaultSessionAuthFileName } from '@/features/authFiles/sessionAuthConverter';

const CODEX_PAT_WHOAMI_URL = 'https://auth.openai.com/api/accounts/v1/user-auth-credential/whoami';
const CODEX_PAT_USER_AGENT = 'codex_cli_rs/0.200.1 (Ubuntu 22.4.0; x86_64) xterm-256color';

export type CodexPatIdentity = {
  email: string;
  chatgptUserId: string;
  chatgptAccountId: string;
  chatgptPlanType: string;
  chatgptAccountIsFedRamp: boolean;
};

export type CodexPatImportErrorCode =
  | 'invalid_prefix'
  | 'invalid_token'
  | 'invalid_response'
  | 'validation_failed';

export class CodexPatImportError extends Error {
  constructor(readonly code: CodexPatImportErrorCode) {
    super(code);
    this.name = 'CodexPatImportError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requiredString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const parseCodexPatIdentity = (value: unknown): CodexPatIdentity => {
  if (!isRecord(value)) throw new CodexPatImportError('invalid_response');

  const email = requiredString(value.email);
  const chatgptUserId = requiredString(value.chatgpt_user_id);
  const chatgptAccountId = requiredString(value.chatgpt_account_id);
  const chatgptPlanType = requiredString(value.chatgpt_plan_type);
  const chatgptAccountIsFedRamp = value.chatgpt_account_is_fedramp;

  if (
    !email ||
    !chatgptUserId ||
    !chatgptAccountId ||
    !chatgptPlanType ||
    typeof chatgptAccountIsFedRamp !== 'boolean'
  ) {
    throw new CodexPatImportError('invalid_response');
  }

  return {
    email,
    chatgptUserId,
    chatgptAccountId,
    chatgptPlanType,
    chatgptAccountIsFedRamp,
  };
};

export const validateCodexPersonalAccessToken = async (
  rawToken: string,
  requestScope: ApiClientRequestScope
): Promise<CodexPatIdentity> => {
  const accessToken = rawToken.trim();
  if (!accessToken.startsWith('at-')) throw new CodexPatImportError('invalid_prefix');

  try {
    const result = await apiCallApi.request(
      {
        method: 'GET',
        url: CODEX_PAT_WHOAMI_URL,
        header: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Originator: 'codex_cli_rs',
          'User-Agent': CODEX_PAT_USER_AGENT,
        },
      },
      { ...createScopedApiRequestConfig(requestScope), timeout: 25_000 }
    );

    if (result.statusCode === 401 || result.statusCode === 403) {
      throw new CodexPatImportError('invalid_token');
    }
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new CodexPatImportError('validation_failed');
    }
    return parseCodexPatIdentity(result.body);
  } catch (error) {
    if (error instanceof CodexPatImportError) throw error;
    throw new CodexPatImportError('validation_failed');
  }
};

export const buildCodexPatAuthJson = (rawToken: string, identity: CodexPatIdentity) => ({
  type: 'codex',
  access_token: rawToken.trim(),
  account_id: identity.chatgptAccountId,
  chatgpt_account_id: identity.chatgptAccountId,
  chatgpt_user_id: identity.chatgptUserId,
  email: identity.email,
  plan_type: identity.chatgptPlanType,
  chatgpt_plan_type: identity.chatgptPlanType,
  chatgpt_account_is_fedramp: identity.chatgptAccountIsFedRamp,
  auth_mode: 'personalAccessToken',
  openai_auth_mode: 'personal_access_token',
  token_type: 'Bearer',
});

export const getCodexPatAuthFileName = (identity: CodexPatIdentity) =>
  getDefaultSessionAuthFileName({
    type: 'codex',
    account_id: identity.chatgptAccountId,
    email: identity.email,
  });
