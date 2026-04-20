export const MemberRole = {
  Admin: 'Admin' as const,
  Member: 'Member' as const,
};
export type MemberRole = typeof MemberRole[keyof typeof MemberRole];
