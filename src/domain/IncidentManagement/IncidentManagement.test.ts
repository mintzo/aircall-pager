import 'reflect-metadata';
import { container } from 'tsyringe';
import { stub, SinonStub } from 'sinon';

import { IncidentManagement } from './IncidentManagement';
import { Logger } from '../../infrastructure/Logger';
import {
  IncidentReportRepository,
  IncidentStatus,
} from '../Repositories/IncidentReportRepository';
import { DI_SYMBOLS } from '../../DI_SYMBOLS';

describe('Incident Management', () => {
  const stubs = {
    logger: { error: stub(), info: stub() } as Logger,
    incidentRepository: {
      updateIncidentPolicyLevel: <any>stub(),
      updateIncidentStatus: <any>stub(),
    } as IncidentReportRepository,
  };

  container.register(DI_SYMBOLS.Logger, { useValue: stubs.logger });
  container.register(DI_SYMBOLS.IncidentReportRepository, { useValue: stubs.incidentRepository });

  const incidentManagement = container.resolve(IncidentManagement);

  beforeEach(() => {
    (<SinonStub>stubs.incidentRepository.updateIncidentPolicyLevel).reset();
    (<SinonStub>stubs.incidentRepository.updateIncidentStatus).reset();
  });

  describe('Engineer acknowledgement', () => {
    describe('Incident exists', () => {
      test('set incident as acknowledged when reported as acknowledged', async () => {
        const incidentId = 'UUID_TEST_ID';
        await incidentManagement.acknowledgeIncident(incidentId);
        expect(
          (<SinonStub>stubs.incidentRepository.updateIncidentStatus).calledOnceWith(
            incidentId,
            IncidentStatus.ACKNOWLEDGED,
          ),
        ).toBe(true)
      });
      test('set incident as resolved when reported as healthy', async () => {
        const incidentId = 'UUID_TEST_ID';
        await incidentManagement.resolveIncident(incidentId);
        expect(
          (<SinonStub>stubs.incidentRepository.updateIncidentStatus).calledOnceWith(
            incidentId,
            IncidentStatus.RESOLVED,
          ),
        ).toBe(true)
      });
    });
    describe('Incident dos not exists', () => {
      test('throw error when trying to acknowledge', async () => {
        const incidentId = 'UUID_TEST_ID';
        (<SinonStub>stubs.incidentRepository.updateIncidentStatus).rejects('error')
        await expect(
          incidentManagement.acknowledgeIncident(incidentId)
        ).rejects.toStrictEqual(Error('Error acknowledging incident'))
      });
      test('throw error when trying to resolve', async () => {
        const incidentId = 'UUID_TEST_ID';
        (<SinonStub>stubs.incidentRepository.updateIncidentStatus).rejects('error')
        await expect(
          incidentManagement.resolveIncident(incidentId)
        ).rejects.toStrictEqual(Error('Error resolving incident'))
      });
    });
  });
});
