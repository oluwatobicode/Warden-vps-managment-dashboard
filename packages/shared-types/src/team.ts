import { z } from "zod";
import { RoleSchema } from "./auth.js";
import { email, password } from "./field.js";

// ---------------------------------------------------------------------------
// Enums — mirror the Prisma enums exactly so response schemas accept real rows.
// ---------------------------------------------------------------------------
export const MembershipStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
]);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const InvitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
  "DECLINED",
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

// Request bodies

// POST /team/invitations
export const InviteMemberSchema = z.object({ email, role: RoleSchema });
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

// POST /auth/invitations/accept — the email comes from the invitation row
// (looked up by token), never from the body.
export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password,
});
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

// POST /auth/invitations/decline — public, token only.
export const DeclineInviteSchema = z.object({ token: z.string().min(1) });
export type DeclineInviteInput = z.infer<typeof DeclineInviteSchema>;

// PATCH /team/members/:id/role
export const UpdateMemberRoleSchema = z.object({ role: RoleSchema });
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

// Response shapes

export const MemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email,
  firstName: z.string(),
  lastName: z.string(),
  role: RoleSchema,
  status: MembershipStatusSchema,
  joinedAt: z.iso.datetime(),
});
export type Member = z.infer<typeof MemberSchema>;

export const InvitationSchema = z.object({
  id: z.string(),
  email,
  role: RoleSchema,
  status: InvitationStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof InvitationSchema>;
