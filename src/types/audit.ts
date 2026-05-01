/** Matches the microsoft.graph.auditActor resource */
export interface AuditActor {
  type: string;
  userPrincipalName: string | null;
  applicationDisplayName: string | null;
  userId: string | null;
  ipAddress: string | null;
  servicePrincipalName: string | null;
}

/** Matches the microsoft.graph.auditProperty resource */
export interface AuditProperty {
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Matches the microsoft.graph.auditResource resource */
export interface AuditResource {
  displayName: string;
  type: string;
  resourceId: string;
  modifiedProperties: AuditProperty[];
}

/** Matches the microsoft.graph.auditEvent resource */
export interface AuditEvent {
  id: string;
  displayName: string;
  componentName: string;
  actor: AuditActor;
  activity: string;
  activityDateTime: string;
  activityType: string;
  activityOperationType: string;
  activityResult: string;
  correlationId: string;
  resources: AuditResource[];
  category: string;
}

/** Resolved actor info cached in memory */
export interface ResolvedActor {
  displayName: string;
  upn: string;
}

/** Filter state for the audit page */
export interface AuditFilters {
  from: Date;
  to: Date;
  categories: string[];
  actorSearch: string;
  freeText: string;
}

/** Pivot view options */
export type AuditPivot = 'timeline' | 'byResource' | 'byActor';
