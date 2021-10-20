import 'reflect-metadata';
import { container } from 'tsyringe';
import { stub, SinonStub } from 'sinon';

import { PagingCoordinator } from './PagingCoordinator';
import { Logger } from '../../infrastructure/Logger';
import {
  IncidentReportRepository,
  IncidentStatus,
  InstanceNotFoundError,
  ServiceAlert,
} from '../../adapters/repositories/IncidentReportRepository';
import { DI_SYMBOLS } from '../../DI_SYMBOLS';
import { EscalationPolicyRepository } from '../../adapters/repositories/EscalationPolicyRepository';
import { ContactsPager } from '../ContactsPager/ContactsPager';
import { EscalationTimerAdapter, IncidentEscalationRequest } from '../../adapters/EscalationTimerAdapter';

describe('Paging Coordinator', () => {
  const stubs = {
    logger: { error: stub(), info: stub() } as Logger,
    incidentRepository: {
      getIncidentById: <any>stub(),
      updateIncidentPolicyLevel: <any>stub(),
      updateIncidentStatus: <any>stub(),
      createIncident: <any>stub(),
      getLatestIncidentByServiceAndType: <any>stub(),
      getLatestIncidentByStatus: <any>stub(),
    } as IncidentReportRepository,
    escalationPolicy: { getEscalationPolicy: <any>stub() } as EscalationPolicyRepository,
    contactPager: { pageContacts: <any>stub() } as ContactsPager,
    EscalationTimer: { setEscalationTimer: <any>stub() } as EscalationTimerAdapter,
  };

  container.register(DI_SYMBOLS.Logger, { useValue: stubs.logger });
  container.register(DI_SYMBOLS.IncidentReportRepository, { useValue: stubs.incidentRepository });
  container.register(DI_SYMBOLS.EscalationPolicyRepository, { useValue: stubs.escalationPolicy });
  container.register(DI_SYMBOLS.ContactsPager, { useValue: stubs.contactPager });
  container.register(DI_SYMBOLS.EscalationTimerAdapter, { useValue: stubs.EscalationTimer });

  const pagingCoordinator = container.resolve(PagingCoordinator);

  beforeEach(() => {
    (<SinonStub>stubs.incidentRepository.getIncidentById).reset();
    (<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).reset();
    (<SinonStub>stubs.incidentRepository.updateIncidentStatus).reset();
    (<SinonStub>stubs.incidentRepository.createIncident).reset();
    (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).reset();
    (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).reset();
    (<SinonStub>stubs.escalationPolicy.getEscalationPolicy).reset();
    (<SinonStub>stubs.contactPager.pageContacts).reset();
    (<SinonStub>stubs.EscalationTimer.setEscalationTimer).reset();

    (<SinonStub>stubs.incidentRepository.createIncident).resolves({ policyLevel: 0 });
    (<SinonStub>stubs.escalationPolicy.getEscalationPolicy).resolves({
      serviceIdentifier: '1',
      pagingContactsByPolicyLevel: [['contact1'], ['c2', 'c3']],
    });
  });

  describe('Service Alerts', () => {
    const testAlert: ServiceAlert = {
      message: 'AlertMessage',
      serviceIdentifier: '1',
      type: 'ServerDown',
    };

    describe('Service has an incident of the same type that is resolved', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.RESOLVED,
        });
      });
      test('create an incident, page engineers, and create escalation timer', async () => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
        await pagingCoordinator.processAlert(testAlert);
        expect((<SinonStub>stubs.incidentRepository.createIncident).calledWithMatch(testAlert)).toBeTruthy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeTruthy();
        expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeTruthy();
      });
      test('throw error when there is no service policy', () => {});
    });

    describe('Service has unresolved incident, but the alert is a different type', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.RESOLVED,
        });
      });
      test('create an incident, do not page engineers, and create escalation timer', async () => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).resolves({
          status: IncidentStatus.ACKNOWLEDGED,
        });
        await pagingCoordinator.processAlert(testAlert);
        expect((<SinonStub>stubs.incidentRepository.createIncident).calledWithMatch(testAlert)).toBeTruthy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
        expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeTruthy();
      });
    });

    const ignoreAlert = async () => {
      await pagingCoordinator.processAlert(testAlert);
      expect((<SinonStub>stubs.incidentRepository.createIncident).called).toBeFalsy();
      expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
      expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeFalsy();
    };
    describe('Service has an incident of the same type that is acknowledged', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.ACKNOWLEDGED,
        });
      });
      test('ignore alert', ignoreAlert);
    });
    describe('Service has an incident of the same type that not acknowledged', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.NOT_ACKNOWLEDGED,
        });
      });
      test('ignore alert', ignoreAlert);
    });
  });

  describe('Incident escalation timer', () => {
    const testEscalationRequest: IncidentEscalationRequest = { incidentId: '1' };
    describe('Service has an incident that is not acknowledged', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getIncidentById).resolves({
          id: testEscalationRequest.incidentId,
          status: IncidentStatus.NOT_ACKNOWLEDGED,
          policyLevel: 0,
        });
      });
      test('update incident policy level, page engineers, and create escalation timer', async () => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
        await pagingCoordinator.processEscalationRequest(testEscalationRequest);
        expect((<SinonStub>stubs.escalationPolicy.getEscalationPolicy).called).toBeTruthy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeTruthy();
        expect(
          (<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).calledWith(
            testEscalationRequest.incidentId,
            1,
          ),
        ).toBeTruthy();
      });
    });
    describe('Service has no incidents that are not acknowledged', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getIncidentById).resolves({
          id: testEscalationRequest.incidentId,
          status: IncidentStatus.RESOLVED,
        });
      });
      test('ignore timer escalation request', async () => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
        await pagingCoordinator.processEscalationRequest(testEscalationRequest);
        expect((<SinonStub>stubs.escalationPolicy.getEscalationPolicy).called).toBeFalsy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
        expect((<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).called).toBeFalsy();
      });
    });
  });
});
