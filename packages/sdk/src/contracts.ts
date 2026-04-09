import { Interface, ZeroAddress, toBeHex } from "ethers";

import type { PaymentTransaction } from "./types";
import { assertAmount, assertChecksumAddress, assertReference } from "./validation";

export const DEFAULT_MONAD_CHAIN_ID = 10143;

export const monadPayRouterAbi = [
  "event PaymentReceived(bytes32 indexed paymentReference, address indexed payer, address indexed merchant, address token, uint256 amount, string memo)",
  "function payWithToken(bytes32 paymentReference, address merchant, address token, uint256 amount, string memo)",
  "function payWithNative(bytes32 paymentReference, address merchant, string memo) payable",
] as const;

export const monadPayEscrowAbi = [
  "event Deposited(address payer, uint256 amount)",
  "event Released(address merchant, uint256 amount)",
  "event Refunded(address payer, uint256 amount)",
  "function deposit() payable",
  "function release()",
  "function refund()",
] as const;

export const monadPayRouterInterface = new Interface(monadPayRouterAbi);
export const monadPayEscrowInterface = new Interface(monadPayEscrowAbi);

export type BuildPaymentTransactionParams = {
  routerAddress: string;
  recipient: string;
  token: string;
  amount: bigint;
  reference: string;
  memo?: string;
};

export function buildPaymentTransaction(
  params: BuildPaymentTransactionParams
): PaymentTransaction {
  const routerAddress = assertChecksumAddress(params.routerAddress, "routerAddress");
  const recipient = assertChecksumAddress(params.recipient, "recipient");
  const token = assertChecksumAddress(params.token, "token");
  const amount = assertAmount(params.amount);
  const reference = assertReference(params.reference);
  const memo = params.memo ?? "";

  if (token === ZeroAddress) {
    return {
      to: routerAddress,
      data: monadPayRouterInterface.encodeFunctionData("payWithNative", [
        reference,
        recipient,
        memo,
      ]),
      value: toBeHex(amount),
    };
  }

  return {
    to: routerAddress,
    data: monadPayRouterInterface.encodeFunctionData("payWithToken", [
      reference,
      recipient,
      token,
      amount,
      memo,
    ]),
    value: "0x0",
  };
}
