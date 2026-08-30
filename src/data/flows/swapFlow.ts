import { map } from 'rxjs';
import { v4 as uuid } from 'uuid';
import type { Observable } from 'rxjs';

import { createFlowHandle } from './runner';

import { calculateApprovalAmount, calculateMaxAmountWithSlippage } from '../../utils/amounts';
import { CSPR_NATIVE_TOKEN_ID } from '../../domain/constants';
import type {
  CasperNetwork,
  ICasperSigner,
  ICasperTransactionsRepository,
  IBuiltDexTransaction,
  IDexContractRepository,
  ILedgerEvent,
  ITransactionOutcome,
  ITransactionStatusRepository,
  ISwapFlowHandle,
  ISwapFlowResult,
  ISwapFlowRunner,
  IStartSwapFlowParams,
  SwapFlowEvent,
  SwapLeg,
} from '../../domain';

export interface ISwapFlowDeps {
  network: CasperNetwork;
  publicKey: string;
  signer: ICasperSigner;
  /** `apiVersion.startsWith('2.')` && (software key ? true : persisted Ledger capability). */
  supportsTransactionV1: boolean;
  dexContractRepository: IDexContractRepository;
  casperTransactionsRepository: Pick<ICasperTransactionsRepository, 'sendDexTransaction'>;
  transactionStatusRepository: ITransactionStatusRepository;
  /** Merged into `events$` so device prompts interleave with flow progress. */
  ledgerEvents$?: Observable<ILedgerEvent>;
  /** Classifies a signing rejection as a user cancellation. Default: never. */
  isCancellationError?: (error: unknown) => boolean;
}

const legSigningEvent = (leg: SwapLeg): SwapFlowEvent =>
  leg === 'approval' ? { type: 'approval:signing' } : { type: 'swap:signing' };

const legSentEvent = (leg: SwapLeg, hash: string): SwapFlowEvent =>
  leg === 'approval' ? { type: 'approval:sent', hash } : { type: 'swap:sent', hash };

const legConfirmedEvent = (leg: SwapLeg, outcome: ITransactionOutcome): SwapFlowEvent =>
  leg === 'approval' ? { type: 'approval:confirmed' } : { type: 'swap:confirmed', outcome };

/**
 * Builds, signs and submits one leg (approval or swap), then optionally waits for it to settle.
 * Returns `true` when the leg is done and the caller may proceed, `false` when it failed or was
 * cancelled — the caller is expected to stop the flow in that case.
 */
const submitLeg = async function* (
  deps: ISwapFlowDeps,
  signal: AbortSignal,
  leg: SwapLeg,
  { awaitSettlement }: { awaitSettlement: boolean },
  build: () => Promise<IBuiltDexTransaction>,
): AsyncGenerator<SwapFlowEvent, boolean> {
  if (signal.aborted) {
    yield { type: 'cancelled', leg };

    return false;
  }

  yield legSigningEvent(leg);

  let built: IBuiltDexTransaction;
  let hash: string;

  try {
    built = await build();
    hash = await deps.casperTransactionsRepository.sendDexTransaction({
      built,
      network: deps.network,
      signer: deps.signer,
    });
  } catch (error) {
    yield deps.isCancellationError?.(error)
      ? { type: 'cancelled', leg }
      : { type: 'failed', leg, error };

    return false;
  }

  if (signal.aborted) {
    yield { type: 'cancelled', leg };

    return false;
  }

  yield legSentEvent(leg, hash);

  if (!awaitSettlement) {
    return true;
  }

  let outcome: ITransactionOutcome;

  try {
    outcome = await deps.transactionStatusRepository.waitForTransaction({
      hash,
      network: deps.network,
      isDeploy: built.deploy !== undefined,
    });
  } catch (error) {
    yield { type: 'failed', leg, error };

    return false;
  }

  if (signal.aborted) {
    yield { type: 'cancelled', leg };

    return false;
  }

  if (outcome.status === 'failure') {
    yield {
      type: 'failed',
      leg,
      error: new Error(`Transaction failed: ${outcome.errorMessage ?? 'unknown reason'}`),
    };

    return false;
  }

  yield legConfirmedEvent(leg, outcome);

  return true;
};

/**
 * The approve-then-swap sequence. The approval leg, when required, is always awaited on chain
 * before the swap is built — submitting the swap first spends the payment on a transaction that
 * reverts against a not-yet-landed allowance.
 */
const runSwap = async function* (
  deps: ISwapFlowDeps,
  params: IStartSwapFlowParams,
  signal: AbortSignal,
): AsyncGenerator<SwapFlowEvent> {
  const {
    firstToken,
    secondToken,
    path,
    quoteType,
    slippage,
    deadline,
    awaitSettlement = true,
  } = params;
  const isNative = firstToken.id === CSPR_NATIVE_TOKEN_ID;

  const requiredAmount = isNative
    ? firstToken.amountRaw
    : calculateMaxAmountWithSlippage(firstToken.amountRaw, slippage);

  // The grant is derived from the same amount the check is made against, so the approval always
  // clears the check it was made for.
  const approvalAmount = isNative ? firstToken.amountRaw : calculateApprovalAmount(requiredAmount);

  yield { type: 'approval:checking' };

  if (signal.aborted) {
    yield { type: 'cancelled', leg: 'approval' };

    return;
  }

  let approvalRequired: boolean;

  try {
    approvalRequired =
      !isNative &&
      (await deps.dexContractRepository.checkApprovalRequired({
        network: deps.network,
        contractPackageHash: firstToken.packageHash,
        publicKey: deps.publicKey,
        requiredAmount,
      }));
  } catch (error) {
    yield { type: 'failed', leg: 'approval', error };

    return;
  }

  if (signal.aborted) {
    yield { type: 'cancelled', leg: 'approval' };

    return;
  }

  if (!approvalRequired) {
    yield { type: 'approval:not-required' };
  } else {
    const approved = yield* submitLeg(deps, signal, 'approval', { awaitSettlement: true }, () =>
      deps.dexContractRepository.buildApprovalTransaction({
        network: deps.network,
        publicKey: deps.publicKey,
        contractPackageHash: firstToken.packageHash,
        amount: approvalAmount,
        useTransactionV1: deps.supportsTransactionV1,
      }),
    );

    if (!approved) {
      return;
    }
  }

  yield* submitLeg(deps, signal, 'swap', { awaitSettlement }, () =>
    deps.dexContractRepository.buildSwapTransaction({
      network: deps.network,
      publicKey: deps.publicKey,
      firstToken,
      secondToken,
      path,
      quoteType,
      slippage,
      deadline,
      useTransactionV1: deps.supportsTransactionV1,
    }),
  );
};

const toResult = (events: SwapFlowEvent[]): ISwapFlowResult => {
  const result: ISwapFlowResult = { status: 'success' };

  for (const event of events) {
    switch (event.type) {
      case 'approval:sent':
        result.approvalHash = event.hash;
        break;
      case 'swap:sent':
        result.swapHash = event.hash;
        break;
      case 'swap:confirmed':
        result.outcome = event.outcome;
        break;
      case 'failed':
        result.status = 'failed';
        result.error = event.error;
        break;
      case 'cancelled':
        result.status = 'cancelled';
        break;
      default:
        break;
    }
  }

  return result;
};

/** Builds the approve-then-swap flow as a hot, replayed handle per {@link IStartSwapFlowParams}. */
export const createSwapFlowRunner = (deps: ISwapFlowDeps): ISwapFlowRunner => {
  const active = new Map<string, ISwapFlowHandle>();

  return {
    start(params: IStartSwapFlowParams): ISwapFlowHandle {
      const id = uuid();

      const handle = createFlowHandle<SwapFlowEvent, ISwapFlowResult>({
        id,
        generator: signal => runSwap(deps, params, signal),
        sideEvents$: deps.ledgerEvents$?.pipe(
          map((event): SwapFlowEvent => ({ type: 'ledger', event })),
        ),
        toResult,
      });

      active.set(id, handle);
      handle.done.finally(() => active.delete(id)).catch(() => undefined);

      return handle;
    },
    getActive: (id: string): ISwapFlowHandle | null => active.get(id) ?? null,
  };
};
