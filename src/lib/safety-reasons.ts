// Why a player can be reported (shared by the report sheet and the server).
export const REPORT_REASONS = {
  offensive: 'Offensive name or content',
  'fake-results': 'Made-up or wrong results',
  harassment: 'Harassment or abuse',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
} as const
export type ReportReason = keyof typeof REPORT_REASONS
