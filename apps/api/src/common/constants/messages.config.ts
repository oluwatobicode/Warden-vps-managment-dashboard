export const GENERIC_MESSAGES = {
  not_found: 'Resource not found',
  forbidden: 'You do not have permission to perform this action',
  validation_failed: 'Validation failed',
  internal_error: 'Something went wrong. Please try again',
  rate_limited: 'Too many requests. Please try again later',
} as const;

export const AUTH_MESSAGES = {
  // magic link — same response whether or not the email exists
  magic_link_sent:
    'If an account can be created for that email, a sign-in link has been sent',
  magic_link_invalid: 'This sign-in link is invalid or has expired',
  // password login — never say which half was wrong
  invalid_credentials: 'Invalid email or password',
  account_suspended: 'Your access to this organization has been suspended',
  // session
  unauthenticated: 'You need to sign in to continue',
  session_expired: 'Your session has expired. Please sign in again',
  refresh_invalid: 'Session could not be refreshed. Please sign in again',
  logged_out: 'Logged out successfully',
  logged_out_everywhere: 'Logged out of all devices',
  // oauth
  oauth_state_invalid: 'Sign-in could not be completed. Please try again',
  oauth_email_missing: 'Your provider account has no verified email address',
  oauth_account_linked: 'Account linked successfully',
} as const;

export const LOGIN_MESSAGES = {
  login_success: 'Logged in successfully',
} as const;

export const SIGNUP_MESSAGES = {
  onboarding_required: 'Finish setting up your account to continue',
  onboarding_expired: 'Your sign-up session has expired. Please start again',
  account_created: 'Account created successfully',
  email_taken: 'An account with this email already exists',
} as const;

export const ORGANIZATION_MESSAGES = {
  created: 'Organization created successfully',
  updated: 'Organization updated successfully',
  deleted: 'Organization deleted',
  email_taken: 'An organization with this email already exists',
  not_found: 'Organization not found',
  delete_forbidden: 'Only an organization admin can delete the organization',
} as const;

export const TEAM_MESSAGES = {
  invitation_sent: 'Invitation sent',
  invitation_invalid: 'This invitation is invalid or has expired',
  invitation_revoked: 'Invitation revoked',
  already_member: 'This person is already a member of the organization',
  already_invited: 'An invitation for this email is already pending',
  member_removed: 'Member removed from the organization',
  member_role_updated: 'Member role updated',
  member_not_found: 'Member not found',
  cannot_remove_last_admin: 'An organization must keep at least one admin',
  cannot_change_own_role: 'You cannot change your own role',
} as const;

export const PROJECT_MESSAGES = {
  created: 'Project created successfully',
  updated: 'Project updated successfully',
  deleted: 'Project deleted',
  not_found: 'Project not found',
  slug_taken: 'A project with this name already exists in your organization',
} as const;

export const ENVIRONMENT_MESSAGES = {
  created: 'Environment created',
  updated: 'Environment updated',
  deleted: 'Environment deleted',
  not_found: 'Environment not found',
  name_taken: 'This project already has an environment with that name',
} as const;

export const SERVICE_MESSAGES = {
  created: 'Service created',
  updated: 'Service updated',
  deleted: 'Service deleted',
  not_found: 'Service not found',
  name_taken: 'This environment already has a service with that name',
  server_assigned: 'Service assigned to server',
  server_unassigned: 'Service removed from server',
  server_wrong_org: 'That server does not belong to your organization',
} as const;

export const SERVER_MESSAGES = {
  created: 'Server added successfully',
  updated: 'Server updated',
  deleted: 'Server deleted',
  not_found: 'Server not found',
  duplicate_address: 'A server with this IP and port is already registered',
  // Restrict on Service -> Server. Interpolate the count in the service layer.
  has_services:
    'This server still runs {count} service(s). Remove or move them first',
  ssh_key_wrong_org: 'That SSH key does not belong to your organization',
  connection_ok: 'Connection successful',
  connection_failed: 'Could not connect to the server',
  cleanup_started: 'Docker cleanup started',
  cleanup_complete: 'Docker cleanup complete',
} as const;

export const SSH_KEY_MESSAGES = {
  created: 'SSH key has been created',
  deleted: 'SSH key deleted',
  not_found: 'SSH key not found',
  invalid_key: 'That is not a valid SSH private key',
  // Restrict on Server -> SshKey. Interpolate the count in the service layer.
  in_use: 'This key is still used by {count} server(s). Reassign them first',
} as const;

export const API_TOKEN_MESSAGES = {
  created: 'API token created. Copy it now, it will not be shown again',
  revoked: 'API token revoked',
  not_found: 'API token not found',
  invalid: 'Invalid API token',
  expired: 'This API token has expired',
  insufficient_scope: 'This API token does not have permission for that action',
} as const;

export const NOTIFICATION_MESSAGES = {
  channel_created: 'Notification channel created',
  channel_updated: 'Notification channel updated',
  channel_deleted: 'Notification channel deleted',
  channel_not_found: 'Notification channel not found',
  test_sent: 'Test notification sent',
} as const;

export const DEPLOYMENT_MESSAGES = {
  queued: 'Deployment queued',
  not_found: 'Deployment not found',
  already_in_progress: 'A deployment is already in progress for this service',
  no_server: 'Assign this service to a server before deploying',
} as const;
