-- Campanhas de produto pela caixa do próprio sócio (Microsoft 365 via Graph), um e-mail por pessoa,
-- com abertura e clique medidos pelo ORQESTRAI (/api/email-marketing/t/o e /t/c).
ALTER TABLE email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_send_mode_check;
ALTER TABLE email_campaigns ADD CONSTRAINT email_campaigns_send_mode_check
  CHECK (send_mode IN ('broadcast', 'batch', 'mailbox'));

COMMENT ON COLUMN email_campaigns.send_mode IS
  'broadcast = Marketing do Resend; batch = lotes transacionais do Resend (100/dia no grátis); mailbox = um e-mail por pessoa pela caixa Microsoft 365 do remetente (from_email), com rastreio próprio do ORQESTRAI.';
