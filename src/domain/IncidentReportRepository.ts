export interface Incident {
  id: string;
  serviceIdentifier: string;
  message: string;
  createdAt: string;
  policyLevel: number;
  status: IncidentStatus;
}

export enum IncidentStatus {
  NOT_ACKNOWLEDGED,
  ACKNOWLEDGED,
  RESOLVED,
}

export interface IncidentReportRepository {
  createIncident(): Promise<Incident>;
  updateIncidentStatus(incidentId: Incident['id'], status: IncidentStatus): Promise<Incident>;
  updateIncidentPolicyLevel(level: Incident["policyLevel"]): Promise<Incident>;
}
