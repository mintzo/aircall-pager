import { inject, singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { DI_SYMBOLS } from '../../DI_SYMBOLS';
import {
  IncidentReport,
  IncidentReportRepository,
  IncidentStatus,
  InstanceNotFoundError,
  ServiceAlert,
} from '../Repositories/IncidentReportRepository';
import { Logger } from '../../infrastructure/Logger';
import { EscalationPolicyRepository } from '../Repositories/EscalationPolicyRepository';
import { ContactsPager } from '../ContactsPager/ContactsPager';
import {
  EscalationTimerAdapter,
  IncidentEscalationRequest,
} from '../Adapters/EscalationTimerAdapter';

@singleton()
export class PagingCoordinator {
  constructor(
    @inject(DI_SYMBOLS.Logger) private readonly logger: Logger,
    @inject(DI_SYMBOLS.IncidentReportRepository)
    private readonly incidentReportRepository: IncidentReportRepository,
    @inject(DI_SYMBOLS.EscalationPolicyRepository)
    private readonly escalationPolicyRepository: EscalationPolicyRepository,
    @inject(DI_SYMBOLS.ContactsPager)
    private readonly contactsPager: ContactsPager,
    @inject(DI_SYMBOLS.EscalationTimerAdapter)
    private readonly escalationTimerAdapter: EscalationTimerAdapter,
  ) {}

  readonly STARTING_POLICY_LEVEL = 0;

  private async isAlertTypeResolved(alert: ServiceAlert): Promise<boolean> {
    try {
      const latestIncident = await this.incidentReportRepository.getLatestIncidentByServiceAndType(
        alert.serviceIdentifier,
        alert.type,
      );
      return latestIncident.status == IncidentStatus.RESOLVED;
    } catch (error) {
      if (error instanceof InstanceNotFoundError) {
        return true;
      }
      throw error;
    }
  }

  private async areAnyServiceIncidentsAcknowledged(
    serviceIdentifier: IncidentReport['serviceIdentifier'],
  ): Promise<boolean> {
    try {
      const latestIncident = await this.incidentReportRepository.getLatestIncidentByStatus(
        serviceIdentifier,
        IncidentStatus.ACKNOWLEDGED,
      );
      return latestIncident.status === IncidentStatus.ACKNOWLEDGED;
    } catch (error) {
      if (error instanceof InstanceNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  private async createNewIncident(alert: ServiceAlert): Promise<IncidentReport> {
    const newIncident = await this.incidentReportRepository.createIncident({
      id: uuid(),
      serviceIdentifier: alert.serviceIdentifier,
      type: alert.type,
      message: alert.message,
      policyLevel: this.STARTING_POLICY_LEVEL,
      status: IncidentStatus.NOT_ACKNOWLEDGED,
    });
    return newIncident;
  }

  private async setEscalationTimer(incident: IncidentReport) {
    this.logger.info('setting escalation timer', { incidentId: incident.id });
    return this.escalationTimerAdapter.setEscalationTimer(incident.id);
  }

  public async processAlert(alert: ServiceAlert) {
    const shouldProcessAlert = await this.isAlertTypeResolved(alert);
    if (shouldProcessAlert) {
      const newIncident = await this.createNewIncident(alert);
      const shouldPageContacts = !(await this.areAnyServiceIncidentsAcknowledged(
        alert.serviceIdentifier,
      ));
      if (shouldPageContacts) {
        const escalationPolicy = await this.escalationPolicyRepository.getEscalationPolicy(
          alert.serviceIdentifier,
        );
        await this.contactsPager.pageContacts(
          escalationPolicy.pagingContactsByPolicyLevel[newIncident.policyLevel],
        );
      }
      await this.setEscalationTimer(newIncident);
    }
  }
  // public async processEscalationRequest(escalationRequest: IncidentEscalationRequest) {

  // }
}
