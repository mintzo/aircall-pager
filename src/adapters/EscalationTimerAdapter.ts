import { IncidentReport } from './repositories/IncidentReportRepository';

export interface IncidentEscalationRequest {
  incidentId: IncidentReport['id'];
}

export interface EscalationTimerAdapter {
  setEscalationTimer(incidentId: IncidentReport['id']): Promise<void>;
}
