import { LedgerEventStatus } from './entities';
import { createLedgerSubmitResume } from './submit-resume';

describe('createLedgerSubmitResume', () => {
  it('is not armed before anything happens', () => {
    expect(createLedgerSubmitResume().shouldResume()).toBe(false);
  });

  it('re-arms a submit the device interrupted', () => {
    const resume = createLedgerSubmitResume();

    resume.issued();
    resume.deviceLeft();

    expect(resume.shouldResume()).toBe(true);
  });

  it.each([
    LedgerEventStatus.SignatureCompleted,
    LedgerEventStatus.SignatureCanceled,
    LedgerEventStatus.SignatureFailed,
    LedgerEventStatus.MsgSignatureCompleted,
    LedgerEventStatus.MsgSignatureCanceled,
    LedgerEventStatus.MsgSignatureFailed,
  ])('does not re-arm once the device reported %s', status => {
    const resume = createLedgerSubmitResume();

    resume.issued();
    resume.outcomeReported(status);
    resume.deviceLeft();

    expect(resume.shouldResume()).toBe(false);
  });

  it.each([LedgerEventStatus.CasperAppNotLoaded, LedgerEventStatus.DeviceLocked])(
    'still re-arms after %s, which interrupts without answering',
    status => {
      const resume = createLedgerSubmitResume();

      resume.issued();
      resume.outcomeReported(status);
      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(true);
    },
  );

  it('does not re-arm when nothing is outstanding', () => {
    const resume = createLedgerSubmitResume();

    resume.deviceLeft();

    expect(resume.shouldResume()).toBe(false);
  });

  it('arms when the user submits with the device away', () => {
    const resume = createLedgerSubmitResume();

    resume.awaitingConnect();

    expect(resume.shouldResume()).toBe(true);
  });

  it('spends the arm on a resume but keeps the submit outstanding', () => {
    const resume = createLedgerSubmitResume();

    resume.issued();
    resume.deviceLeft();
    resume.resumed();

    expect(resume.shouldResume()).toBe(false);

    resume.deviceLeft();

    expect(resume.shouldResume()).toBe(true);
  });

  describe('a dropped flow', () => {
    it('does not re-arm', () => {
      const resume = createLedgerSubmitResume();

      resume.issued();
      resume.dropped();
      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(false);
    });

    it('stays dropped when the device leaves again after returning', () => {
      const resume = createLedgerSubmitResume();

      resume.issued();
      resume.deviceLeft();
      resume.dropped();
      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(false);
    });
  });

  describe('overlapping submits', () => {
    it('keeps the original outstanding when the resumed submit settles first', () => {
      const resume = createLedgerSubmitResume();

      const settleFirst = resume.issued();
      resume.deviceLeft();
      resume.resumed();

      // The re-issued submit short-circuits on the client's own guard and settles at once.
      const settleResumed = resume.issued();
      settleResumed();

      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(true);

      resume.resumed();
      settleFirst();
      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(false);
    });

    it('settles a submit only once however often its release is called', () => {
      const resume = createLedgerSubmitResume();

      const settle = resume.issued();
      const settleSecond = resume.issued();

      settle();
      settle();
      settle();

      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(true);

      resume.resumed();
      settleSecond();
      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(false);
    });

    it('ignores a release held by a submit the caller already dropped', () => {
      const resume = createLedgerSubmitResume();

      const settleDropped = resume.issued();
      resume.dropped();

      resume.issued();
      settleDropped();

      resume.deviceLeft();

      expect(resume.shouldResume()).toBe(true);
    });
  });
});
