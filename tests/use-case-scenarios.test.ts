import 'reflect-metadata';
import { container } from 'tsyringe';
import { stub, SinonStub } from 'sinon';
import {
  IncidentReportRepository,
  IncidentStatus,
  InstanceNotFoundError,
  ServiceAlert,
} from '../src/adapters/repositories/IncidentReportRepository';
import { Logger } from '../src/infrastructure/Logger';
import { EscalationPolicyRepository } from '../src/adapters/repositories/EscalationPolicyRepository';
import { ContactsPager } from '../src/domain/ContactsPager/ContactsPager';
import { EscalationTimerAdapter, IncidentEscalationRequest } from '../src/adapters/EscalationTimerAdapter';
import { DI_SYMBOLS } from '../src/DI_SYMBOLS';
import { PagingCoordinator } from '../src/domain/PagingCoordinator/PagingCoordinator';

describe('Use Case Scenarios ', () => {
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

  const testAlert: ServiceAlert = {
    message: 'AlertMessage',
    serviceIdentifier: '1',
    type: 'ServerDown',
  };
  const testEscalationRequest: IncidentEscalationRequest = { incidentId: '1' };

  describe('Given a Monitored Service in a Healthy State', () => {
    describe('Pager receives an Alert related to this Monitored Service', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.RESOLVED,
        });
      });
      test('notify all targets of the next level of the escalation policy & sets an acknowledgement delay', async () => {
        // use-case #1 in the task readme
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
        await pagingCoordinator.processAlert(testAlert);
        expect((<SinonStub>stubs.incidentRepository.createIncident).calledWithMatch(testAlert)).toBeTruthy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeTruthy();
        expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeTruthy();
      });
    });
  });

  describe('Given a Monitored Service in a Unhealthy State', () => {
    describe('corresponding Alert is not Acknowledged', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.NOT_ACKNOWLEDGED,
        });
      });
      describe('Pager receives the Acknowledgement Timeout', () => {
        beforeEach(() => {
          (<SinonStub>stubs.incidentRepository.getIncidentById).resolves({
            id: testEscalationRequest.incidentId,
            status: IncidentStatus.NOT_ACKNOWLEDGED,
            policyLevel: 0,
          });
        });
        test('notify all targets of the next level of the escalation policy & sets an acknowledgement delay', async () => {
          // use-case #2 in the task readme
          (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
          await pagingCoordinator.processEscalationRequest(testEscalationRequest);
          expect(
            (<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).calledWith(
              testEscalationRequest.incidentId,
              1,
            ),
          ).toBeTruthy();
          expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeTruthy();
          expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeTruthy();
        });
      });
    });

    describe('Pager received the Acknowledgement', () => {
      beforeEach(() => {
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.ACKNOWLEDGED,
        });
      });
      describe('receives the Acknowledgement Timeout', () => {
        beforeEach(() => {
          (<SinonStub>stubs.incidentRepository.getIncidentById).resolves({
            id: testEscalationRequest.incidentId,
            status: IncidentStatus.ACKNOWLEDGED,
            policyLevel: 0,
          });
        });
        test('do not notify any Target & do not set an acknowledgement delay', async () => {
          // use-case #3 in the task readme
          (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).resolves({
            status: IncidentStatus.ACKNOWLEDGED,
          });
          await pagingCoordinator.processEscalationRequest(testEscalationRequest);
          expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
          expect((<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).called).toBeFalsy();
          expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeFalsy();
        });
      });
    });

    describe('Pager receives an Alert related to this Monitored Service', () => {
      test('do not notify any Target & do not set an acknowledgement delay', async () => {
        // use-case #4 in the task readme
        (<SinonStub>stubs.incidentRepository.getLatestIncidentByServiceAndType).resolves({
          status: IncidentStatus.NOT_ACKNOWLEDGED,
        });
        await pagingCoordinator.processAlert(testAlert);
        expect((<SinonStub>stubs.incidentRepository.createIncident).called).toBeFalsy();
        expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
        expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeFalsy();
      });
    });

    describe('Pager received a Healthy event related to this Monitored Service', () => {
      describe('receives the Acknowledgement Timeout', () => {
        beforeEach(() => {
          (<SinonStub>stubs.incidentRepository.getIncidentById).resolves({
            id: testEscalationRequest.incidentId,
            status: IncidentStatus.RESOLVED,
            policyLevel: 0,
          });
        });
        test('Monitored Service becomes Healthy, the Pager doesn’t notify any Target and doesn’t set an acknowledgement delay', async () => {
          // use-case #5 in the task readme
          (<SinonStub>stubs.incidentRepository.getLatestIncidentByStatus).rejects(new InstanceNotFoundError());
          await pagingCoordinator.processEscalationRequest(testEscalationRequest);
          expect((<SinonStub>stubs.contactPager.pageContacts).called).toBeFalsy();
          expect((<SinonStub>stubs.EscalationTimer.setEscalationTimer).called).toBeFalsy();
        });
      });
    });
  });
});
