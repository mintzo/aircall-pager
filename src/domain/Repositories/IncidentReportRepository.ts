export interface ServiceAlert {
  message: string;
  serviceIdentifier: string;
  type: string;
}
export interface IncidentReport {
  id: string;
  serviceIdentifier: string;
  message: string;
  createdAt: string;
  policyLevel: number;
  status: IncidentStatus;
  type: ServiceAlert['type'];
}

export enum IncidentStatus {
  NOT_ACKNOWLEDGED,
  ACKNOWLEDGED,
  RESOLVED,
}

export class InstanceNotFoundError extends Error {}
export interface IncidentReportRepository {
  createIncident(newIncident: Omit<IncidentReport, 'createdAt'>): Promise<IncidentReport>;
  updateIncidentStatus(
    incidentId: IncidentReport['id'],
    status: IncidentStatus,
  ): Promise<IncidentReport>;
  updateIncidentPolicyLevel(
    incidentId: IncidentReport['id'],
    level: IncidentReport['policyLevel'],
  ): Promise<IncidentReport>;
  getLatestIncidentByServiceAndType(
    serviceIdentifier: IncidentReport['serviceIdentifier'],
    type: IncidentReport['type'],
  ): Promise<IncidentReport>;
  getLatestIncidentByStatus(
    serviceIdentifier: IncidentReport['serviceIdentifier'],
    status: IncidentReport['status'],
  ): Promise<IncidentReport>;
}
