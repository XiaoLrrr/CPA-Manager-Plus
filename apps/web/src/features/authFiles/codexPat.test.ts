import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiCallApi } from '@/services/api/apiCall';
import {
  buildCodexPatAuthJson,
  CodexPatImportError,
  getCodexPatAuthFileName,
  validateCodexPersonalAccessToken,
} from './codexPat';

vi.mock('@/services/api/apiCall', () => ({
  apiCallApi: { request: vi.fn() },
}));

const request = vi.mocked(apiCallApi.request);
const scope = { apiBase: 'http://127.0.0.1:8317', managementKey: 'manager-key' };

describe('Codex PAT import', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates with whoami and builds a non-refreshable Codex auth file', async () => {
    request.mockResolvedValue({
      statusCode: 200,
      hasStatusCode: true,
      header: {},
      bodyText: '',
      body: {
        email: 'user@example.com',
        chatgpt_user_id: 'user-123',
        chatgpt_account_id: 'acct-123',
        chatgpt_plan_type: 'plus',
        chatgpt_account_is_fedramp: false,
      },
    });

    const identity = await validateCodexPersonalAccessToken('  at-secret  ', scope);
    const authJson = buildCodexPatAuthJson('  at-secret  ', identity);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        header: expect.objectContaining({
          Authorization: 'Bearer at-secret',
          Originator: 'codex_cli_rs',
          'User-Agent': 'codex_cli_rs/0.200.1 (Ubuntu 22.4.0; x86_64) xterm-256color',
        }),
      }),
      expect.objectContaining({ timeout: 25_000 })
    );
    expect(authJson).toMatchObject({
      type: 'codex',
      access_token: 'at-secret',
      account_id: 'acct-123',
      auth_mode: 'personalAccessToken',
      openai_auth_mode: 'personal_access_token',
      token_type: 'Bearer',
    });
    expect(authJson).not.toHaveProperty('refresh_token');
    expect(authJson).not.toHaveProperty('id_token');
    expect(authJson).not.toHaveProperty('expired');
    expect(getCodexPatAuthFileName(identity)).toBe('codex-acct-123-user@example.com.json');
  });

  it('rejects invalid tokens and incomplete whoami responses before saving', async () => {
    await expect(validateCodexPersonalAccessToken('sk-not-a-pat', scope)).rejects.toMatchObject({
      code: 'invalid_prefix',
    } satisfies Partial<CodexPatImportError>);

    request.mockResolvedValue({
      statusCode: 200,
      hasStatusCode: true,
      header: {},
      bodyText: '',
      body: { email: 'user@example.com' },
    });
    await expect(validateCodexPersonalAccessToken('at-incomplete', scope)).rejects.toMatchObject({
      code: 'invalid_response',
    } satisfies Partial<CodexPatImportError>);
  });
});
