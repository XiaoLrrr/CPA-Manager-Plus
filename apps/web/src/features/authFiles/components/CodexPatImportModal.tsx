import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconEye, IconEyeOff } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import styles from './CodexPatImportModal.module.scss';

type CodexPatImportModalProps = {
  open: boolean;
  saving: boolean;
  disabled?: boolean;
  onClose: () => void;
  onImport: (token: string) => Promise<void>;
};

const FORM_ID = 'codex-pat-import-form';

export function CodexPatImportModal({
  open,
  saving,
  disabled = false,
  onClose,
  onImport,
}: CodexPatImportModalProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);

  const reset = () => {
    setToken('');
    setError('');
    setVisible(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (saving || disabled) return;
    if (!token.trim()) {
      setError(t('auth_files.codex_pat_required'));
      return;
    }

    setError('');
    try {
      await onImport(token);
      reset();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : t('auth_files.codex_pat_error_validation_failed')
      );
    }
  };

  const visibilityLabel = t(
    visible ? 'auth_files.codex_pat_hide_token' : 'auth_files.codex_pat_show_token'
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('auth_files.codex_pat_title')}
      width={560}
      closeDisabled={saving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            loading={saving}
            disabled={disabled || saving || !token.trim()}
          >
            {t('auth_files.codex_pat_submit')}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleImport();
        }}
      >
        <p className={styles.description}>{t('auth_files.codex_pat_description')}</p>
        <Input
          label={t('auth_files.codex_pat_label')}
          type={visible ? 'text' : 'password'}
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            if (error) setError('');
          }}
          placeholder="at-..."
          autoComplete="off"
          spellCheck={false}
          disabled={saving || disabled}
          hint={t('auth_files.codex_pat_hint')}
          error={error}
          rightElement={
            <button
              type="button"
              className={styles.visibilityButton}
              onClick={() => setVisible((current) => !current)}
              aria-label={visibilityLabel}
              title={visibilityLabel}
              disabled={saving || disabled}
            >
              {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
            </button>
          }
        />
      </form>
    </Modal>
  );
}
