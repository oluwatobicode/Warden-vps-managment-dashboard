export const GENERIC_MESSAGES = {
  not_found: 'Resource not found',
  forbidden: 'You do not have permission to perform this action',
  validation_failed: 'Validation failed',
  internal_error: 'Something went wrong. Please try again',
  rate_limited: 'Too many requests. Please try again later',
} as const;

export const AUTH_MESSAGES = {
  magic_link_sent:
    'If an account can be created for that email, a sign-in link has been sent',
  magic_link_invalid: 'This sign-in link is invalid or has expired',
  invalid_credentials: 'Invalid email or password',
  account_suspended: 'Your access to this organization has been suspended',
  unauthenticated: 'You need to sign in to continue',
  session_expired: 'Your session has expired. Please sign in again',
  refresh_invalid: 'Session could not be refreshed. Please sign in again',
  logged_out: 'Logged out successfully',
  logged_out_everywhere: 'Logged out of all devices',
  oauth_state_invalid: 'Sign-in could not be completed. Please try again',
  oauth_email_missing: 'Your provider account has no verified email address',
  oauth_account_linked: 'Account linked successfully',
  reset_code_sent:
    'If an account with a password exists for that email, a reset code has been sent',
  reset_code_invalid: 'This code is invalid or has expired',
  password_reset: 'Password updated. Sign in with your new password',
  password_set_code_sent: 'We emailed you a 6-digit code',
  password_already_set:
    'You already have a password. Change it with your current one',
  password_none: "You don't have a password yet. Add one with an emailed code",
  password_wrong: 'Your current password is not right',
  password_changed: 'Password changed. Other devices were signed out',
  password_added: 'Password added. You can now sign in with it too',
  too_many_codes: 'Too many codes requested. Try again in an hour',
} as const;

export const CANVAS_MESSAGES = {
  saved: 'Layout saved',
  wrong_services:
    'Some of these services are not in this environment, so nothing was saved',
} as const;

export const ACCOUNT_MESSAGES = {
  profile_updated: 'Profile updated',
  signed_out_others: 'Signed out of other devices',
} as const;

export const LOGIN_MESSAGES = {
  login_success: 'Logged in successfully',
} as const;

export const SIGNUP_MESSAGES = {
  onboarding_required: 'Finish setting up your account to continue',
  onboarding_expired: 'Your sign-up session has expired. Please start again',
  account_created: 'Account created successfully',
  email_taken: 'An account with this email already exists',
  wrong_onboarding_route:
    'This sign-up must be completed through the route matching how you signed in',
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
  already_in_another_org: 'This member belongs to anther organization already',
} as const;

export const PROJECT_MESSAGES = {
  created: 'Project created successfully',
  updated: 'Project updated successfully',
  deleted: 'Project deleted',
  not_found: 'Project not found',
  slug_taken: 'A project with this name already exists in your organization',
  has_assigned_services:
    "Unassign this project's services from their servers before deleting it",
} as const;

export const ENVIRONMENT_MESSAGES = {
  created: 'Environment created',
  updated: 'Environment updated',
  deleted: 'Environment deleted',
  not_found: 'Environment not found',
  name_taken: 'This project already has an environment with that name',
  last_environment: 'A project must have at least one environment',
  has_assigned_services:
    "Unassign this environment's services from their servers before deleting it",
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
  type_not_available: 'This service type is not available yet',
  has_server: 'Unassign this service from its server before deleting it',
  server_not_deploy: 'Services can only run on DEPLOY servers',
  service_running: 'Stop this service before moving it to another server',
  database_stays: 'A database stays on the server that holds its data',
  delete_database_elsewhere:
    'Delete databases from their own page (it asks whether to keep the data)',
} as const;

export const DATABASE_MESSAGES = {
  not_found: 'Database not found',
  variable_taken:
    'This environment already has a variable with that name. Pick another name',
  busy: 'This database is already being created or restarted. Wait for it to finish',
  confirm_name: 'Type the database name to confirm deleting its data',
  not_queued: 'Could not start the job. Try again in a moment',
  build_server: 'Databases can only run on DEPLOY servers',
  no_server:
    'Pick a server: this environment has no default server yet (Project settings → Environments)',
  restarting: 'Restarting the database',
  deleting: 'Deleting the database',
} as const;

export const BACKUP_MESSAGES = {
  not_found: 'Backup not found',
  no_storage:
    'No backup storage is set up. Add a bucket in Settings → Backup storage',
  not_running: 'The database is not running, so it cannot be backed up',
  in_progress: 'A backup or restore of this database is already running',
  not_restorable: 'Only finished backups can be restored or downloaded',
  confirm_name: 'Type the database name to confirm the restore',
  restoring: 'Restoring the backup',
  storage_saved: 'Backup storage saved',
  storage_removed:
    'Your own bucket was removed. New backups go to Warden storage, if it is set up',
  storage_unreachable: 'Could not write to that bucket',
  storage_private_host:
    'The endpoint must be a public hostname, not an IP address or a local name',
  storage_missing:
    'The storage this backup was saved to is no longer set up, so it cannot be read',
} as const;

export const SERVER_MESSAGES = {
  created: 'Server added successfully',
  updated: 'Server updated',
  deleted: 'Server deleted',
  deploy_only: 'Services and databases run on DEPLOY servers only',
  default_of:
    'It’s the default server of {count} environment(s). Pick another default for them first (Project settings → Environments)',
  not_found: 'Server not found',
  duplicate_address: 'A server with this IP and port is already registered',
  has_services:
    'This server still runs {count} service(s). Remove or move them first',
  ssh_key_wrong_org: 'That SSH key does not belong to your organization',
  connection_ok: 'Connection successful',
  connection_failed: 'Could not connect to the server',
  cleanup_started: 'Docker cleanup started',
  cleanup_complete: 'Docker cleanup complete',
  cleanup_running: 'A cleanup is already running on this server',
  cleanup_not_queued: 'Could not start the cleanup. Try again in a moment',
  unreachable: 'Could not reach the server over SSH',
} as const;

export const SSH_KEY_MESSAGES = {
  created: 'SSH key has been created',
  deleted: 'SSH key deleted',
  not_found: 'SSH key not found',
  invalid_key: 'That is not a valid SSH private key',
  in_use: 'This key is still used by {count} server(s). Reassign them first',
  name_taken: 'An SSH key with this name already exists',
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
  name_taken: 'A notification channel with this name already exists',
  wrong_field_for_type: 'That field does not apply to this channel type',
  invalid_webhook: 'That is not a valid webhook URL for this channel type',
  test_sent: 'Test notification sent',
} as const;

export const DEPLOYMENT_MESSAGES = {
  queued: 'Deployment queued',
  not_found: 'Deployment not found',
  already_in_progress: 'A deployment is already in progress for this service',
  no_server: 'Assign this service to a server before deploying',
} as const;

export const VARIABLE_MESSAGES = {
  not_found: 'Variable not found',
  key_taken: 'A variable with this name already exists here',
  import_conflict:
    'Someone changed these variables while you were importing. Try again',
} as const;

export const DEPLOY_MESSAGES = {
  not_found: 'Deployment not found',
  service_not_found: 'Service not found',
  not_deployable: 'Only applications and workers are deployed this way',
  no_source: 'Set a GitHub repo or an image in the service’s Settings first',
  no_server: 'Pick a server for this service first',
  no_port: 'An application needs a port. Set it in the service’s Settings',
  no_proxy:
    'The proxy isn’t set up on this server yet. Open the server’s page and press "Set up proxy"',
  busy: 'This service is already deploying. Wait for it to finish, or cancel it',
  rollback_not_success: 'Only a deploy that went live can be rolled back to',
  rollback_is_live: 'That version is already live',
  cancel_not_running: 'That deploy has already finished',
  cancel_running:
    'Cancelling: it stops after the step it’s on (a build in progress finishes first)',
  not_queued: 'Could not start the deploy. Try again in a moment',
  installation_not_found: 'That GitHub connection doesn’t belong to this organization',
  repo_not_visible:
    'The Warden GitHub App can’t see that repo. Allow it on GitHub (Settings → GitHub → Manage), then try again',
  proxy_queued: 'Setting up the proxy',
  server_not_found: 'Server not found',
  proxy_build_server: 'The proxy runs on DEPLOY servers only',
  domain_taken: 'That domain is already used by a service',
  domain_not_found: 'Domain not found',
  domain_no_server: 'Pick a server for this service first: the domain must point at it',
  domain_web_only: 'Only applications (services with a port) get domains',
  busy_remove: '{name} is deploying right now. Wait for it to finish, or cancel it, then try again',
  remove_unreachable:
    'Couldn’t reach {server}, so nothing was removed. Try again, or delete anyway (its containers then stay on the server for you to remove)',
  nothing_live: 'Nothing is live yet: deploy it first',
  start_missing:
    'The stopped version is no longer on the server (removed by hand?). Deploy to start it again',
  start_failed: 'Couldn’t start it',
  start_crashed: 'It started, then stopped again straight away. Open the last deploy’s output to see why, or deploy again',
  has_databases:
    'Delete its databases first ({names}): each one asks whether to keep or delete its data',
  no_apps_found:
    'Nothing to deploy found in this repo (no package.json, Dockerfile or other app files)',
  name_taken_in_env: 'A service called "{name}" already exists in this environment',
} as const;

export const GITHUB_MESSAGES = {
  not_configured:
    'This Warden has no GitHub App set up yet (GITHUB_APP_* in the api and worker .env)',
  bad_state: 'That GitHub link expired or wasn’t started here. Press Connect GitHub again',
  install_failed: 'GitHub didn’t confirm the installation',
  not_found: 'GitHub connection not found',
  bad_signature: 'Bad signature',
  repo_not_found_app:
    'That repo or branch wasn’t found, or the Warden GitHub App isn’t allowed to read it',
  repo_not_found_public:
    'That repo or branch wasn’t found. If it’s private, connect GitHub (Settings → GitHub) and pick it there',
  rate_limited:
    'GitHub is limiting requests right now. Connect GitHub (Settings → GitHub) for a much higher limit, or try again in a few minutes',
} as const;

export const PROXY_MESSAGES = {
  server_not_found: 'Server not found',
  update_first:
    'This server’s proxy was set up before the editor existed. Press "Update proxy" first',
  fix_first: 'Fix the problems first',
  busy: 'Someone is applying a change to this server’s proxy right now. Try again in a moment',
  stale:
    'The config changed since you opened it (someone else saved). Reload to see their version, then make your change again',
  unreachable: 'Couldn’t reach {server}, so nothing was changed',
  version_not_found: 'That version doesn’t exist',
} as const;

