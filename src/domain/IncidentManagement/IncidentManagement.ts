import { inject, singleton } from 'tsyringe';
import { DI_SYMBOLS } from '../../DI_SYMBOLS';
import { Incident, IncidentReportRepository, IncidentStatus } from '../IncidentReportRepository';
import { Logger } from '../../infrastructure/Logger';

@singleton()
export class IncidentManagement {
  constructor(
    @inject(DI_SYMBOLS.Logger) private readonly logger: Logger,
    @inject(DI_SYMBOLS.IncidentReportRepository)
    private readonly incidentReportRepository: IncidentReportRepository,
  ) {}

  async acknowledgeIncident(incidentId: string): Promise<Incident> {
    try {
      const updatedIncident = await this.incidentReportRepository.updateIncidentStatus(
        incidentId,
        IncidentStatus.ACKNOWLEDGED,
      );
      return updatedIncident;
    } catch (error) {
      this.logger.error(error, { incidentId });
      throw new Error('Error acknowledging incident');
    }
  }

  async resolveIncident(incidentId: string): Promise<Incident> {
    try {
      const updatedIncident = await this.incidentReportRepository.updateIncidentStatus(
        incidentId,
        IncidentStatus.RESOLVED,
      );
      return updatedIncident;
    } catch (error) {
      this.logger.error(error, { incidentId });
      throw new Error('Error resolving incident');
    }
  }
}
