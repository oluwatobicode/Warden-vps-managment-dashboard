import { SetMetadata } from '@nestjs/common';

/** Marks a route an API token may call. Every other route refuses tokens. */
export const TOKEN_ALLOWED_KEY = 'tokenAllowed';
export const TokenAllowed = () => SetMetadata(TOKEN_ALLOWED_KEY, true);
