import { inject, singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { DI_SYMBOLS } from '../../DI_SYMBOLS';
import {
  IncidentReport,
  IncidentReportRepository,
  IncidentStatus,
  InstanceNotFoundError,
  ServiceAlert,
} from '../../adapters/repositories/IncidentReportRepository';
import { Logger } from '../../infrastructure/Logger';
import { EscalationPolicy, EscalationPolicyRepository } from '../../adapters/repositories/EscalationPolicyRepository';
import { ContactsPager } from '../ContactsPager/ContactsPager';
import { EscalationTimerAdapter, IncidentEscalationRequest } from '../../adapters/EscalationTimerAdapter';

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

  private async createNewIncident(alert: ServiceAlert, contactsPaged?: boolean): Promise<IncidentReport> {
    const newIncident = await this.incidentReportRepository.createIncident({
      id: uuid(),
      serviceIdentifier: alert.serviceIdentifier,
      type: alert.type,
      message: alert.message,
      policyLevel: contactsPaged ? this.STARTING_POLICY_LEVEL : this.STARTING_POLICY_LEVEL - 1,
      status: IncidentStatus.NOT_ACKNOWLEDGED,
    });
    return newIncident;
  }

  private async setEscalationTimer(incident: IncidentReport) {
    this.logger.info('setting escalation timer', { incidentId: incident.id });
    return this.escalationTimerAdapter.setEscalationTimer(incident.id);
  }

  private async escalateIncident(incidentToEscalate: IncidentReport, escalationPolicy: EscalationPolicy) {
    const isLastPolicyLevel = incidentToEscalate.policyLevel + 1 > escalationPolicy.pagingContactsByPolicyLevel.length;

    if (!isLastPolicyLevel) {
      await this.contactsPager.pageContacts(
        escalationPolicy.pagingContactsByPolicyLevel[incidentToEscalate.policyLevel + 1],
      );
      await this.incidentReportRepository.updateIncidentPolicyLevel(
        incidentToEscalate.id,
        incidentToEscalate.policyLevel + 1,
      );
    }
  }

  public async processAlert(alert: ServiceAlert) {
    const shouldProcessAlert = await this.isAlertTypeResolved(alert);
    if (shouldProcessAlert) {
      const shouldPageContacts = !(await this.areAnyServiceIncidentsAcknowledged(alert.serviceIdentifier));
      const newIncident = await this.createNewIncident(alert, shouldPageContacts);
      if (shouldPageContacts) {
        const escalationPolicy = await this.escalationPolicyRepository.getEscalationPolicy(alert.serviceIdentifier);
        await this.contactsPager.pageContacts(escalationPolicy.pagingContactsByPolicyLevel[newIncident.policyLevel]);
      }
      await this.setEscalationTimer(newIncident);
    }
  }
  public async processEscalationRequest(escalationRequest: IncidentEscalationRequest) {
    const incidentToEscalate = await this.incidentReportRepository.getIncidentById(escalationRequest.incidentId);
    const serviceAlertsAcknowledge = await this.areAnyServiceIncidentsAcknowledged(
      incidentToEscalate.serviceIdentifier,
    );

    const shouldEscalateIncident =
      incidentToEscalate.status === IncidentStatus.NOT_ACKNOWLEDGED && !serviceAlertsAcknowledge;

    if (shouldEscalateIncident) {
      const escalationPolicy = await this.escalationPolicyRepository.getEscalationPolicy(
        incidentToEscalate.serviceIdentifier,
      );
      await this.escalateIncident(incidentToEscalate, escalationPolicy);
    } else {
      const shouldSnoozeTimer = serviceAlertsAcknowledge;
      if (shouldSnoozeTimer) {
        this.setEscalationTimer(incidentToEscalate);
      }
    }
  }
}
